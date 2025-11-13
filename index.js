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
  res.send('Smart server is running');
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const db = client.db('my-import-db');
    const productsCollection = db.collection('products');
    const bidsCollection = db.collection('myExport');
    const usersCollection = db.collection('myImport');


    // USERS API - Add new user if not exists
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;

      if (!email) {
        return res.status(400).send({ message: 'Email is required' });
      }

      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'User already exists. No need to insert again' });
      } else {
        const result = await usersCollection.insertOne(newUser);
        return res.send(result);
      }
    });

    // Example GET users
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    // Example GET products
    app.get('/products', async (req, res) => {
      const products = await productsCollection.find({}).toArray();
      res.send(products);
    });

    // Example POST product
    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}






run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Smart server is running on port: ${port}`);
});
