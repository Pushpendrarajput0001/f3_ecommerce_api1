const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb'); // Change from ObjectID to ObjectId

const app = express();
const PORT = 3000;
const MONGO_URI = 'mongodb+srv://andy:markf3ecommerce@atlascluster.gjlv4np.mongodb.net/?retryWrites=true&w=majority&appName=AtlasCluster';

app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// Middleware to parse JSON body
app.use(bodyParser.json());

const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// API endpoint to save user data
app.post('/usersregister', async (req, res) => {
  try {
    // Extract user data from request body
    const { email, password, storeName, walletAddress, cityAddress, localAddress, usdtRate, country,storeId } = req.body;

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();

    // Access the appropriate database and collection
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Check if the email already exists
    const existingUser = await collection.findOne({ email });
    if (existingUser) {
      // Close the MongoDB connection
      await client.close();
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create a document with user data
    const userDocument = {
      email,
      password,
      storeName,
      walletAddress,
      cityAddress,
      localAddress,
      usdtRate,
      storeId,
      country
    };

    // Insert the document into the collection
    await collection.insertOne(userDocument);

    // Close the MongoDB connection
    await client.close();

    // Respond with success message
    res.status(201).json({ message: 'User data saved successfully' });
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).json({ error: 'An error occurred while saving user data' });
  }
});

app.post('/login', async (req, res) => {
  try {
    // Extract email and password from request body
    const email = req.body.email;
    const password = req.body.password;

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();

    // Access the appropriate database and collection
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Check if the email exists
    const user = await collection.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Email not found' });
    }

    // Check if the password matches
    if (user.password !== password) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    // Successful login
    // Construct the user object to send back (excluding password)
    const userToSend = {
      email: user.email,
      storeName: user.storeName,
      storeId : user.storeId,
      walletAddress: user.walletAddress,
      cityAddress: user.cityAddress,
      localAddress: user.localAddress,
      usdRate: user.usdtRate,
      country: user.country
    };

    // Send the user data along with the success message
    res.status(200).json({ message: 'Login successful', user: userToSend });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'An error occurred during login' });
  } finally {
    // Close the MongoDB connection
    await client.close();
  }
});

app.post('/productsAdd', async (req, res) => {
  const DB_NAME = 'f3_ecommerce';
  const COLLECTION_NAME = 'users';
  
  try {
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true });
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Extract product data and images from request body
    const { email, productName, startedPrice, f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected, description,totalsolds, images } = req.body;

    // Convert base64 images to buffer
    const imageBuffers = images.map(image => Buffer.from(image, 'base64'));

    // Create document to insert into MongoDB
    const productDocument = {
      _id: new ObjectId(), // Use ObjectId instead of ObjectID
      productName,
      startedPrice: parseFloat(startedPrice),
      f3MarketPrice: parseFloat(f3MarketPrice),
      growthContribution: parseFloat(growthContribution),
      numberOfStocks: parseInt(numberOfStocks),
      unitItemSelected,
      description,
      totalsolds,
      images: imageBuffers
    };

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      // If user not found, return error
      return res.status(404).json({ error: 'User not found' });
    }

    // Add the product to the user's products array
    if (!user.products) {
      user.products = [];
    }
    user.products.push(productDocument);

    // Update the user's document in the collection
    await collection.updateOne({ email }, { $set: user });

    client.close();

    res.status(201).json({ message: 'Product added successfully', productId: productDocument._id });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/userLocations', async (req, res) => {
  try {
    await client.connect();

    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find users who have products associated with them
    const usersWithProducts = await collection.find({ products: { $exists: true, $not: { $size: 0 } } }).toArray();

    const countryMap = new Map();

    usersWithProducts.forEach(user => {
      const { country, cityAddress, localAddress } = user;

      const countryKey = country.toLowerCase();
      const cityKey = cityAddress.toLowerCase();

      if (!countryMap.has(countryKey)) {
        countryMap.set(countryKey, new Map());
      }

      const cityMap = countryMap.get(countryKey);

      if (!cityMap.has(cityKey)) {
        cityMap.set(cityKey, []);
      }

      const localAddresses = cityMap.get(cityKey);
      if (!localAddresses.includes(localAddress)) {
        localAddresses.push(localAddress);
      }
    });

    const countries = [];

    countryMap.forEach((cityMap, country) => {
      const countryName = country.charAt(0).toUpperCase() + country.slice(1);
      const countryObj = { country: countryName, cities: [] };

      cityMap.forEach((locals, city) => {
        const cityName = city.charAt(0).toUpperCase() + city.slice(1);
        const cityObj = { name: cityName, locals: locals };
        countryObj.cities.push(cityObj);
      });

      countries.push(countryObj);
    });

    res.status(200).json({ data: countries });
  } catch (error) {
    console.error('Error retrieving user countries and cities:', error);
    res.status(500).json({ error: 'An error occurred while fetching user locations' });
  } finally {
    await client.close();
  }
});

app.get('/allProducts', async (req, res) => {
  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find all users with products
    const usersWithProducts = await collection.find({ products: { $exists: true, $not: { $size: 0 } } }).toArray();

    // Extract all products from users
    let allProducts = [];
    usersWithProducts.forEach(user => {
      if (user.products && Array.isArray(user.products)) {
        allProducts = allProducts.concat(user.products);
      }
    });

    // Close MongoDB connection
    await client.close();

    // Send response with all products
    res.status(200).json({ products: allProducts });
  } catch (error) {
    console.error('Error retrieving all products:', error);
    res.status(500).json({ error: 'An error occurred while fetching all products' });
  }
});


// Start the server and bind it to a specific IP address
app.listen(PORT, '192.168.29.149', () => {
  console.log(`Server is running on http://192.168.29.149:${PORT}`);
});

