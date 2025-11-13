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

const uri = `mongodb+srv://${user}:${pass}@cluster0.lrsmj0e.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Test server root
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

    // Add new user if not exists
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;

      if (!email) return res.status(400).send({ message: 'Email is required' });

      const existingUser = await usersCollection.findOne({ email });

      if (existingUser) {
        return res.send({ message: 'User already exists.' });
      } else {
        const result = await usersCollection.insertOne(newUser);
        return res.send(result);
      }
    });

    // Get all users
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    // Get all products
    app.get('/products', async (req, res) => {
      const products = await productsCollection.find({}).toArray();
      res.send(products);
    });

    // Get latest 6 products for Home page
    app.get('/products/latest', async (req, res) => {
      const latestProducts = await productsCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(latestProducts);
    });


    //
    app.get('/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const product = await productsCollection.findOne(query);
    if (!product) {
      return res.status(404).send({ message: 'Product not found' });
    }
    res.send(product);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});


    // Add new product (Add Export)
    app.post('/products', async (req, res) => {
      const product = { ...req.body, createdAt: new Date() };
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    // Get all exports for a user
    app.get('/exports', async (req, res) => {
      const userEmail = req.query.userEmail;
      if (!userEmail) return res.status(400).send({ message: 'User email required' });

      const exports = await exportsCollection.find({ sellerEmail: userEmail }).toArray();
      res.send(exports);
    });

    // Add new export
    app.post('/exports', async (req, res) => {
      const exportData = { ...req.body, createdAt: new Date() };
      const result = await exportsCollection.insertOne(exportData);
      res.send(result);
    });

    // Update export (update product info)
    app.put('/exports/:id', async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await exportsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    // Delete export
    app.delete('/exports/:id', async (req, res) => {
      const id = req.params.id;
      const result = await exportsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Get all imports for a user
    app.get('/imports', async (req, res) => {
      const userEmail = req.query.userEmail;
      if (!userEmail) return res.status(400).send({ message: 'User email required' });

      const imports = await importsCollection.find({ userEmail }).toArray();
      res.send(imports);
    });

    // Add new import
    app.post('/imports', async (req, res) => {
      const { productId, importedQuantity, userEmail } = req.body;

      if (!productId || !importedQuantity || !userEmail) {
        return res.status(400).send({ message: 'All fields are required' });
      }

      const product = await productsCollection.findOne({ _id: new ObjectId(productId) });

      if (!product) return res.status(404).send({ message: 'Product not found' });
      if (importedQuantity > product.availableQuantity) {
        return res.status(400).send({ message: 'Import quantity exceeds available quantity' });
      }

      // Insert import record
      const importData = {
        productId,
        productName: product.productName,
        price: product.price,
        rating: product.rating,
        importedQuantity,
        userEmail,
        importedAt: new Date()
      };
      await importsCollection.insertOne(importData);

      // Update product availableQuantity
      await productsCollection.updateOne(
        { _id: new ObjectId(productId) },
        { $inc: { availableQuantity: -importedQuantity } }
      );

      res.send({ message: 'Product imported successfully' });
    });

    // Delete import
    app.delete('/imports/:id', async (req, res) => {
      const id = req.params.id;
      const importItem = await importsCollection.findOne({ _id: new ObjectId(id) });
      if (!importItem) return res.status(404).send({ message: 'Import not found' });

      // Restore product quantity
      await productsCollection.updateOne(
        { _id: new ObjectId(importItem.productId) },
        { $inc: { availableQuantity: importItem.importedQuantity } }
      );

      const result = await importsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Food & Beverage Trade Hub server is running on port: ${port}`);
});
