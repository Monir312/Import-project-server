const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB credentials
const user = encodeURIComponent(process.env.DB_USER);
const pass = encodeURIComponent(process.env.DB_PASS);
const uri = `mongodb+srv://${user}:${pass}@cluster0.lrsmj0e.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Root
app.get('/', (req, res) => {
  res.send('Food & Beverage Trade Hub server is running');
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const db = client.db('my-import-db');
    const usersCollection = db.collection('users');
    const productsCollection = db.collection('products');
    const importsCollection = db.collection('imports');
    const exportsCollection = db.collection('exports');

    app.post('/users', async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) return res.send({ message: 'User already exists.' });

      const result = await usersCollection.insertOne(req.body);
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });


    app.post('/products', async (req, res) => {
      try {
        const { productName, description, price, availableQuantity, pictureURL, sellerName, rating, subCategory, originCountry } = req.body;
        if (!productName || !price || !availableQuantity || !pictureURL) {
          return res.status(400).send({ message: "Product Name, Price, Quantity & Image URL are required" });
        }

        const product = {
          productName,
          description,
          price,
          availableQuantity,
          pictureURL,
          sellerName,
          rating: rating || 0,
          subCategory: subCategory || "General",
          originCountry: originCountry || "Unknown",
          createdAt: new Date()
        };

        const result = await productsCollection.insertOne(product);
        res.send(result);
      } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).send({ message: "Failed to add product" });
      }
    });

    app.get('/products', async (req, res) => {
      const products = await productsCollection.find({}).toArray();
      res.send(products);
    });

    app.get('/products/latest', async (req, res) => {
      const latestProducts = await productsCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(latestProducts);
    });

    app.get('/products/:id', async (req, res) => {
      try {
        const product = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!product) return res.status(404).send({ message: 'Product not found' });
        res.send(product);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.post('/imports', async (req, res) => {
      try {
        const { productId, importedQuantity, userEmail } = req.body;
        if (!productId || !importedQuantity || !userEmail) return res.status(400).send({ message: 'All fields are required' });

        const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
        if (!product) return res.status(404).send({ message: 'Product not found' });
        if (importedQuantity > product.availableQuantity) return res.status(400).send({ message: 'Import quantity exceeds available quantity' });

        const importData = {
          productId,
          productName: product.productName,
          pictureURL: product.pictureURL,
          price: product.price,
          rating: product.rating,
          originCountry: product.originCountry || "Unknown",
          importedQuantity,
          userEmail,
          importedAt: new Date()
        };

        const result = await importsCollection.insertOne(importData);

        await productsCollection.updateOne(
          { _id: new ObjectId(productId) },
          { $inc: { availableQuantity: -importedQuantity } }
        );

        res.send({ success: true, message: 'Product imported successfully', insertedId: result.insertedId });
      } catch (error) {
        console.error("Error adding import:", error);
        res.status(500).send({ message: 'Failed to import product' });
      }
    });

    app.get('/imports', async (req, res) => {
      const userEmail = req.query.userEmail;
      if (!userEmail) return res.status(400).send({ message: 'User email required' });

      const userImports = await importsCollection.find({ userEmail }).toArray();
      res.send(userImports);
    });

    app.delete('/imports/:id', async (req, res) => {
      try {
        const importItem = await importsCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!importItem) return res.status(404).send({ message: 'Import not found' });

        await productsCollection.updateOne(
          { _id: new ObjectId(importItem.productId) },
          { $inc: { availableQuantity: importItem.importedQuantity } }
        );

        const result = await importsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 1) res.send({ success: true, message: 'Import deleted successfully' });
        else res.status(400).send({ message: 'Failed to delete import' });
      } catch (error) {
        console.error("Error deleting import:", error);
        res.status(500).send({ message: 'Server error while deleting import' });
      }
    });

     // Add export
    app.post('/exports', async (req, res) => {
      try {
        const {
          sellerEmail,
          productName,
          pictureURL,
          price,
          rating,
          originCountry,
          availableQuantity
        } = req.body;

        if (!sellerEmail || !productName) 
          return res.status(400).send({ message: "sellerEmail & productName required" });

        const exportData = {
          sellerEmail,
          productName,
          pictureURL,
          price,
          rating: rating || 0,
          originCountry: originCountry || "Unknown",
          availableQuantity: availableQuantity || 0,
          createdAt: new Date()
        };

        const result = await exportsCollection.insertOne(exportData);
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error("Error adding export:", error);
        res.status(500).send({ message: "Failed to add export" });
      }
    });

    app.get('/exports', async (req, res) => {
      try {
        const userEmail = req.query.userEmail;
        if (!userEmail) return res.status(400).send({ message: 'User email required' });

        const exports = await exportsCollection.find({ sellerEmail: userEmail }).toArray();
        res.send(exports);
      } catch (error) {
        console.error("Error fetching exports:", error);
        res.status(500).send({ message: "Failed to fetch exports" });
      }
    });



    app.put("/exports/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { _id, ...updateData } = req.body;

        const result = await exportsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update export" });
      }
    });

    app.delete('/exports/:id', async (req, res) => {
      try {
        const result = await exportsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 1) res.send({ success: true });
        else res.status(400).send({ message: "Failed to delete export" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to delete export" });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Food & Beverage Trade Hub server is running on port: ${port}`);
});
