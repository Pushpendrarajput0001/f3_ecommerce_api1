const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const sharp = require('sharp');
const {ethers,JsonRpcProvider , formatEther, parseUnits, isAddress, ContractTransactionResponse, InfuraProvider} = require("ethers");
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
    const { email, password, storeName, walletAddress, cityAddress, localAddress, usdtRate, country,storeId,currencySymbol,currencyCode,flagWord } = req.body;

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();

    // Access the appropriate database and collection
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Check if the email already exists
    const existingUser = await collection.findOne({ email });
    const existingUserWallet = await collection.findOne({walletAddress});
    if (existingUser) {
      // Close the MongoDB connection
      await client.close();
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    if(existingUserWallet){
      await client.close();
      return res.status(401).json({error : 'User with this wallet already'})
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
      currencySymbol,
      currencyCode,
      flagWord,
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

async function getUserDetails(email) {
  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  // Find the user by email
  const user = await collection.findOne({ email });

  // Close MongoDB connection
  await client.close();

  // Filter out any nested maps from the user object
  const filteredUser = Object.keys(user).reduce((acc, key) => {
      if (!user[key] || typeof user[key] !== 'object') {
          acc[key] = user[key];
      }
      return acc;
  }, {});

  return filteredUser;
}

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
      flagWord : user.flagWord,
      currencySymbol : user.currencySymbol,
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
    const { email, productName, startedPrice, f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected, description, totalsolds, images, storeId, storeName,flagWord,offer } = req.body;

    // Resize and compress images
    const compressedImages = await Promise.all(images.map(async (image) => {
      // Resize and compress image using sharp
      compressedBuffer = await sharp(Buffer.from(image, 'base64'))
      .resize({ width: 150 }) // Set desired width (you can adjust this as needed)
      .png({ quality: 25 }) // Set desired PNG quality (you can adjust this as needed)
      .toBuffer();

      return compressedBuffer.toString('base64');
    }));

    // Create document to insert into MongoDB
    const productDocument = {
      _id: new ObjectId().toString(),
      productName,
      startedPrice,
      f3MarketPrice: parseFloat(f3MarketPrice),
      growthContribution: parseFloat(growthContribution),
      numberOfStocks: parseInt(numberOfStocks),
      unitItemSelected,
      description,
      totalsolds,
      storeId,
      storeName,
      offer,
      flagWord,
      images: compressedImages
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

      if (!countryMap.has(country)) {
        countryMap.set(country, new Map());
      }

      const cityMap = countryMap.get(country);

      if (!cityMap.has(cityAddress)) {
        cityMap.set(cityAddress, []);
      }

      const localAddresses = cityMap.get(cityAddress);
      if (!localAddresses.includes(localAddress)) {
        localAddresses.push(localAddress);
      }
    });

    const countries = [];

    countryMap.forEach((cityMap, country) => {
      const countryObj = { country: country, cities: [] };

      cityMap.forEach((locals, city) => {
        const cityObj = { name: city, locals: locals };
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

app.get('/userLocationsWithProducts', async (req, res) => {
  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
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

    // Close MongoDB connection
    await client.close();

    res.status(200).json({ data: countries });
  } catch (error) {
    console.error('Error retrieving user countries and cities:', error);
    res.status(500).json({ error: 'An error occurred while fetching user locations' });
  }
});

app.get("/userBalances", async (req, res) => {
  try {
      const { privateKey } = req.query;

      if (!privateKey) {
          return res.status(400).send("Please provide private key");
      }

      const provider = new JsonRpcProvider("https://bsc-dataseed.binance.org/");
      const wallet = new ethers.Wallet(privateKey, provider);

      // Define the F3 token contract ABI
      const ABI = require("./contract.json");
      const f3ContractAddress = "0xfB265e16e882d3d32639253ffcfC4b0a2E861467";
      const f3Contract = new ethers.Contract(f3ContractAddress, ABI, provider);

      // Fetch F3 token details
      const f3Name = await f3Contract.name();
      const f3Symbol = await f3Contract.symbol();
      const f3Decimals = await f3Contract.decimals();

      // Fetch F3 token balance
      const f3Balance = await f3Contract.balanceOf(wallet.address);

      // Fetch BNB balance
      const bnbBalance = await provider.getBalance(wallet.address);

      // Prepare response
      const response = {
          f3Balance: formatEther(f3Balance).toString(),
          bnbBalance: formatEther(bnbBalance).toString() 
      };

      // Convert any potential BigInt values in the response to strings
      const jsonString = JSON.stringify(response, (key, value) => {
          if (typeof value === 'bigint') {
              return value.toString();
          }
          return value;
      });

      return res.status(200).json(JSON.parse(jsonString));
  } catch (error) {
      console.error(error);
      return res.status(500).send("Internal Server Error");
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

app.get('/filteredProducts', async (req, res) => {
  try {
    const { country, city, localAddress } = req.query;

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Construct the filter based on the provided query parameters
    const filter = {};
    if (country) {
      filter['country'] = country;
    }
    if (city) {
      filter['cityAddress'] = city;
    }
    if (localAddress) {
      filter['localAddress'] = localAddress;
    }

    // Find users with matching filters and retrieve their products
    const usersWithMatchingAddress = await collection.find(filter).toArray();
    const matchingProducts = usersWithMatchingAddress.reduce((products, user) => {
      if (user.products && user.products.length > 0) {
        products.push(...user.products);
      }
      return products;
    }, []);

    // Close MongoDB connection
    await client.close();

    // Send response with filtered products
    res.status(200).json({ products: matchingProducts });
  } catch (error) {
    console.error('Error retrieving filtered products:', error);
    res.status(500).json({ error: 'An error occurred while fetching filtered products' });
  }
});

app.get('/specificStoreProducts', async (req, res) => {
  try {
    const { storeIdOrName } = req.query;

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Construct the filter based on the provided store ID or store name
    const filter = {};
    if (storeIdOrName) {
      filter['$or'] = [
        { 'storeId': storeIdOrName },
        { 'storeName': storeIdOrName }
      ];
    }

    // Find users with matching store ID or store name and retrieve their products
    const usersWithMatchingStore = await collection.find(filter).toArray();
    const matchingProducts = usersWithMatchingStore.reduce((products, user) => {
      if (user.products && user.products.length > 0) {
        products.push(...user.products);
      }
      return products;
    }, []);

    // Close MongoDB connection
    await client.close();

    // Send response with filtered products
    res.status(200).json({ products: matchingProducts });
  } catch (error) {
    console.error('Error retrieving filtered products:', error);
    res.status(500).json({ error: 'An error occurred while fetching filtered products' });
  }
});

app.post('/addProductToCart', async (req, res) => {
  try {
    const { email, productId } = req.body;

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if userCarts map exists, if not create it
    if (!user.userCarts) {
      user.userCarts = {}; // Create userCarts object
    }

    // Check if product already exists in the user's cart
    if (user.userCarts[productId]) {
      // If product already exists, send error response with status code 401
      res.status(401).json({ error: 'Product already exists in the cart' });
      return;
    }

    // Add product to user's cart
    user.userCarts[productId] = 1; // Default quantity is 1

    // Update the user document in the database
    await collection.updateOne(
      { email },
      { $set: { userCarts: user.userCarts } }
    );

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Product added to cart successfully' });
  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).json({ error: 'An error occurred while adding product to cart' });
  }
});

app.get('/userCartProducts', async (req, res) => {
  try {
    const { email } = req.query;

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if user has products in their cart
    if (!user.userCarts || Object.keys(user.userCarts).length === 0) {
      res.status(401).json({ error: 'No products in cart' });
      return;
    }

    // Extract product IDs from user's cart
    const productIds = Object.keys(user.userCarts);

    // Find product details for the product IDs in the user's cart
    const cartProducts = [];
    await Promise.all(productIds.map(async (productId) => {
      // Find product in all users
      const product = await collection.findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });
      if (product && product.products && product.products.length > 0) {
        cartProducts.push(product.products[0]);
      }
    }));

    // Close MongoDB connection
    await client.close();

    // Send response with cart products
    res.status(200).json({ products: cartProducts });
  } catch (error) {
    console.error('Error fetching user cart products:', error);
    res.status(500).json({ error: 'An error occurred while fetching user cart products' });
  }
});

app.post('/deleteCartProduct', async (req, res) => {
  try {
    const { email, productIds } = req.body; 

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const user = await collection.findOne({ email });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.userCarts) {
      res.status(400).json({ error: 'User has no items in the cart' });
      return;
    }

    productIds.forEach(productId => {
      if (!user.userCarts[productId]) {
        res.status(404).json({ error: `Product ${productId} not found in the cart` });
        return;
      }
      delete user.userCarts[productId];
    });

    await collection.updateOne(
      { email },
      { $set: { userCarts: user.userCarts } }
    );

    await client.close();

    res.status(200).json({ message: 'Product(s) removed from cart successfully' });
  } catch (error) {
    console.error('Error removing product from cart:', error);
    res.status(500).json({ error: 'An error occurred while removing product from cart' });
  }
});

app.post('/addCheckoutApproval', async (req, res) => {
  try {
    const { email, products } = req.body;

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if checkoutapproval map exists, if not create it
    if (!user.checkoutapproval) {
      user.checkoutapproval = {}; // Create checkoutapproval object
    }

    // Iterate through products to add or replace in the checkoutapproval map
    products.forEach(product => {
      const { productId, quantity, totalPrice, storeId } = product;

      // Check if checkoutapproval for the storeId already exists
      if (!user.checkoutapproval[storeId]) {
        user.checkoutapproval[storeId] = [];
      }

      // Add new product
      user.checkoutapproval[storeId].push({
        productId,
        quantity,
        totalPrice
      });
    });

    // Update the user document in the database
    await collection.updateOne(
      { email },
      { $set: { checkoutapproval: user.checkoutapproval } }
    );

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Checkout approvals added successfully' });
  } catch (error) {
    console.error('Error adding checkout approvals:', error);
    res.status(500).json({ error: 'An error occurred while adding checkout approvals' });
  }
});

app.get('/getBuyCheckedOutApproval', async (req, res) => {
  try {
    const { email } = req.query;

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Retrieve checkoutapproval object from user document
    const checkoutapproval = user.checkoutapproval;

    // Prepare an array to store the details of all products
    const productsDetails = [];

    // Iterate over each storeId in the checkoutapproval map
    for (const products of Object.values(checkoutapproval)) {
      // Iterate over each product in the store
      for (const product of Object.values(products)) {
        const { productId, quantity, totalPrice } = product;

        // Fetch product details from MongoDB
        const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

        // Add product details along with quantity and totalPrice
        productsDetails.push({
          productId,
          totalQuantity : quantity,
          totalPrice,
          ...productDetails
        });
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with productsDetails array
    res.status(200).json({ products: productsDetails});
  } catch (error) {
    console.error('Error retrieving checkout approvals:', error);
    res.status(500).json({ error: 'An error occurred while retrieving checkout approvals' });
  }
});

app.get('/getSellerProductsCheckoutById', async (req, res) => {
  try {
    const { sellerId } = req.query;
    console.log('Requested Seller ID:', sellerId);

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find all users with checkout approvals
    const usersWithCheckoutApprovals = await collection.find({ 'checkoutapproval': { $exists: true } }).toArray();

    if (!usersWithCheckoutApprovals || usersWithCheckoutApprovals.length === 0) {
      res.status(404).json({ error: 'No users found with checkout approvals' });
      return;
    }

    console.log('Users with Checkout Approvals:', usersWithCheckoutApprovals);

    // Prepare an array to store product details
    const products = [];

    // Iterate over each user with checkout approvals
    for (const user of usersWithCheckoutApprovals) {
      console.log('User:', user);
      
      if (user.checkoutapproval[sellerId]) {
        const sellerCheckoutApprovalsArray = user.checkoutapproval[sellerId];
        console.log('Checkout Approvals for Seller:', sellerCheckoutApprovalsArray);
        
        // Iterate over each checkout approval in the seller's array
        for (const checkoutApproval of sellerCheckoutApprovalsArray) {
          const { productId, quantity, totalPrice } = checkoutApproval;

          // Fetch product details from MongoDB
          const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

          // Add product details along with quantity, totalPrice, and storeId
          products.push({
            _id: productId,
            totalQuantity : quantity,
            totalPrice,
            productName: productDetails.products[0].productName,
            startedPrice: productDetails.products[0].startedPrice,
            f3MarketPrice: productDetails.products[0].f3MarketPrice,
            growthContribution: productDetails.products[0].growthContribution,
            numberOfStocks: productDetails.products[0].numberOfStocks,
            unitItemSelected: productDetails.products[0].unitItemSelected,
            description: productDetails.products[0].description,
            totalsolds: productDetails.products[0].totalsolds,
            storeId : productDetails.products[0].storeId,
            storeIdBuyer: user.storeId,
            walletAddressBuyer : user.walletAddress,
            flagWord : productDetails.products[0].flagWord,
            storeName: productDetails.products[0].storeName,
            images: productDetails.products[0].images
          });
        }
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with products array
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error retrieving seller products by ID:', error);
    res.status(500).json({ error: 'An error occurred while retrieving seller products by ID' });
  }
});

app.get('/deleteCheckoutapprovalsStore', async (req, res) => {
  try {
    const { storeId, buyerId } = req.query; 

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const user = await collection.findOne({ storeId: buyerId });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.checkoutapproval || !user.checkoutapproval[storeId]) {
      res.status(400).json({ error: `No checkout approvals found for storeId: ${storeId}` });
      return;
    }

    delete user.checkoutapproval[storeId];

    await collection.updateOne(
      { storeId: buyerId },
      { $set: { checkoutapproval: user.checkoutapproval } }
    );

    await client.close();

    res.status(200).json({ message: `Checkout approvals for storeId: ${storeId} removed successfully` });
  } catch (error) {
    console.error('Error removing checkout approvals:', error);
    res.status(500).json({ error: 'An error occurred while removing checkout approvals' });
  }
});

app.post('/updateProductAfterCheckoutApproval', async (req, res) => {
  try {
    const { products } = req.body;

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    for (const product of products) {
      const { productId, newStocks, newSolds } = product;

      // Find the product by productId
      const existingProduct = await collection.findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

      if (!existingProduct) {
        res.status(404).json({ error: `Product ${productId} not found in store` });
        return;
      }

      // Update the product's stocks and solds fields
      existingProduct.products[0].numberOfStocks = newStocks;
      existingProduct.products[0].totalsolds = newSolds;

      // Update the product in the database
      await collection.updateOne({ 'products._id': productId }, { $set: { 'products.$.numberOfStocks': newStocks, 'products.$.totalsolds': newSolds } });
    }

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Products updated successfully' });
  } catch (error) {
    console.error('Error updating products:', error);
    res.status(500).json({ error: 'An error occurred while updating products' });
  }
});

app.get('/deleteAndapprovalcheckoutsStore', async (req, res) => {
  try {
    const { storeId, buyerId } = req.query;

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const user = await collection.findOne({ storeId: buyerId });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.checkoutapproval || !user.checkoutapproval[storeId]) {
      res.status(400).json({ error: `No checkout approvals found for storeId: ${storeId}` });
      return;
    }

    // Copy the full array of store products
    const store_products = user.checkoutapproval[storeId];

    // If approvalcheckout does not exist, create an empty object
    if (!user.approvalcheckout) {
      user.approvalcheckout = {};
    }

    // If approvalcheckout does not have storeId as key or its value is not an array, create an empty array
    if (!user.approvalcheckout[storeId] || !Array.isArray(user.approvalcheckout[storeId])) {
      user.approvalcheckout[storeId] = [];
    }

    // Add new products to the existing array
    user.approvalcheckout[storeId] = [
      ...user.approvalcheckout[storeId],
      ...store_products
    ];

    // Delete the store from the checkoutapproval
    delete user.checkoutapproval[storeId];

    await collection.updateOne(
      { storeId: buyerId },
      { $set: { checkoutapproval: user.checkoutapproval, approvalcheckout: user.approvalcheckout } }
    );

    await client.close();

    res.status(200).json({ message: `Checkout approvals for storeId: ${storeId} removed successfully` });
  } catch (error) {
    console.error('Error removing checkout approvals:', error);
    res.status(500).json({ error: 'An error occurred while removing checkout approvals' });
  }
});

app.get('/getBuyersSectionProductcheckout', async (req, res) => {
  try {
    const { buyerId } = req.query;
    console.log('Buyer ID:', buyerId);

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the buyer by buyerId
    const buyer = await collection.findOne({ storeId: buyerId });

    if (!buyer) {
      res.status(404).json({ error: 'Buyer not found' });
      return;
    }

    // Check if the buyer has checkout approvals
    const checkoutApprovalMap = buyer.checkoutapproval;
    console.log('Type of checkoutApprovalMap:', typeof checkoutApprovalMap);
    console.log('Checkout Approval Map:', checkoutApprovalMap);
    if (!checkoutApprovalMap) {
      res.status(402).json({ error: 'Checkout approvals not found for the buyer' });
      return;
    }

    // Prepare an array to store product details
    const products = [];

    // Iterate over each store's checkout approval
    for (const sellerId in checkoutApprovalMap) {
      const sellerCheckoutApprovalsArray = checkoutApprovalMap[sellerId];

      // Iterate over each checkout approval in the seller's array
      for (const checkoutApproval of sellerCheckoutApprovalsArray) {
        const { productId, quantity, totalPrice } = checkoutApproval;

        // Fetch product details from MongoDB
        const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

        // Add product details along with quantity and totalPrice
        products.push({
          _id: productId,
          totalQuantity : quantity,
          totalPrice,
          productName: productDetails.products[0].productName,
          startedPrice: productDetails.products[0].startedPrice,
          f3MarketPrice: productDetails.products[0].f3MarketPrice,
          growthContribution: productDetails.products[0].growthContribution,
          numberOfStocks: productDetails.products[0].numberOfStocks,
          unitItemSelected: productDetails.products[0].unitItemSelected,
          description: productDetails.products[0].description,
          totalsolds: productDetails.products[0].totalsolds,
          storeId: productDetails.products[0].storeId,
          flagWord : productDetails.products[0].flagWord,
          storeName: productDetails.products[0].storeName,
          images: productDetails.products[0].images
        });
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with products array
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error retrieving buyer products by ID:', error);
    res.status(500).json({ error: 'An error occurred while retrieving buyer products by ID' });
  }
});

app.get('/getSellerSectionApprovedCheckout', async (req, res) => {
  try {
    const { sellerId } = req.query;
    console.log('Requested Seller ID:', sellerId);

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find all users with checkout approvals
    const usersWithApprovalsCheckout = await collection.find({ 'approvalcheckout': { $exists: true } }).toArray();

    if (!usersWithApprovalsCheckout || usersWithApprovalsCheckout.length === 0) {
      res.status(404).json({ error: 'No users found with checkout approvals' });
      return;
    }

    console.log('Users with Checkout Approvals:', usersWithApprovalsCheckout);

    // Prepare an array to store product details
    const products = [];

    // Iterate over each user with checkout approvals
    for (const user of usersWithApprovalsCheckout) {
      console.log('User:', user);
      
      if (user.approvalcheckout[sellerId]) {
        const sellerApprovalsCheckoutArray = user.approvalcheckout[sellerId];
        console.log('Approvals Checkout for Seller:', sellerApprovalsCheckoutArray);
        
        // Iterate over each checkout approval in the seller's array
        for (const approvalcheckout of sellerApprovalsCheckoutArray) {
          const { productId, quantity, totalPrice,paymentRequestedTimestamp } = approvalcheckout;

          // Fetch product details from MongoDB
          const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

          // Add product details along with quantity, totalPrice, and storeId
          products.push({
            _id: productId,
            totalQuantity : quantity,
            totalPrice,
            paymentRequestedTimestamp,
            productName: productDetails.products[0].productName,
            startedPrice: productDetails.products[0].startedPrice,
            f3MarketPrice: productDetails.products[0].f3MarketPrice,
            growthContribution: productDetails.products[0].growthContribution,
            numberOfStocks: productDetails.products[0].numberOfStocks,
            unitItemSelected: productDetails.products[0].unitItemSelected,
            description: productDetails.products[0].description,
            totalsolds: productDetails.products[0].totalsolds,
            storeId : productDetails.products[0].storeId,
            storeIdBuyer: user.storeId,
            walletAddressBuyer : user.walletAddress,
            flagWord : productDetails.products[0].flagWord,
            storeName: productDetails.products[0].storeName,
            images: productDetails.products[0].images
          });
        }
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with products array
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error retrieving seller products by ID:', error);
    res.status(500).json({ error: 'An error occurred while retrieving seller products by ID' });
  }
});

app.get('/getBuyersSectionApprovedCheckout', async (req, res) => {
  try {
    const { buyerId } = req.query;
    console.log('Buyer ID:', buyerId);

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the buyer by buyerId
    const buyer = await collection.findOne({ storeId: buyerId });

    if (!buyer) {
      res.status(404).json({ error: 'Buyer not found' });
      return;
    }

    // Check if the buyer has checkout approvals
    const approvalCheckoutMap = buyer.approvalcheckout;
    console.log('Type of checkoutApprovalMap:', typeof approvalCheckoutMap);
    console.log('Checkout Approval Map:', approvalCheckoutMap);
    if (!approvalCheckoutMap) {
      res.status(402).json({ error: 'Checkout approvals not found for the buyer' });
      return;
    }

    // Prepare an array to store product details
    const products = [];

    // Iterate over each store's checkout approval
    for (const sellerId in approvalCheckoutMap) {
      const sellerCheckoutApprovalsArray = approvalCheckoutMap[sellerId];

      // Iterate over each checkout approval in the seller's array
      for (const approvalcheckout of sellerCheckoutApprovalsArray) {
        const { productId, quantity, totalPrice,paymentRequestedTimestampBuyer } = approvalcheckout;

        // Fetch product details from MongoDB
        const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

        // Add product details along with quantity and totalPrice
        products.push({
          _id: productId,
          totalQuantity : quantity,
          totalPrice,
          paymentRequestedTimestampBuyer,
          productName: productDetails.products[0].productName,
          startedPrice: productDetails.products[0].startedPrice,
          f3MarketPrice: productDetails.products[0].f3MarketPrice,
          growthContribution: productDetails.products[0].growthContribution,
          numberOfStocks: productDetails.products[0].numberOfStocks,
          unitItemSelected: productDetails.products[0].unitItemSelected,
          description: productDetails.products[0].description,
          totalsolds: productDetails.products[0].totalsolds,
          storeId: productDetails.products[0].storeId,
          flagWord : productDetails.products[0].flagWord,
          storeName: productDetails.products[0].storeName,
          images: productDetails.products[0].images
        });
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with products array
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error retrieving buyer products by ID:', error);
    res.status(500).json({ error: 'An error occurred while retrieving buyer products by ID' });
  }
});

app.get('/updateRequestApprovedCheckout', async (req, res) => {
  try {
    const { storeId, sellerId, paymentRequestedTimestamp,totalF3Amount,totalGc,f3LiveOfThisTime } = req.query;

    console.log('Request received:', storeId, sellerId, paymentRequestedTimestamp,totalF3Amount,totalGc);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const user = await collection.findOne({ storeId });

    if (!user) {
      console.log(`User with storeId ${storeId} not found`);
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }

    if (typeof user.approvalcheckout !== 'object' || !user.approvalcheckout.hasOwnProperty(sellerId)) {
      console.log(`Seller with sellerId ${sellerId} not found in approvalcheckout object`);
      res.status(404).json({ error: `Seller with sellerId ${sellerId} not found in approvalcheckout object` });
      return;
    }

    const sellerArray = user.approvalcheckout[sellerId];

    const isAlreadyRequested = sellerArray.some((sellerObject) => {
      return sellerObject.paymentRequested === 'Yes' || sellerObject.paymentRequestedTimestamp === paymentRequestedTimestamp;
    });

    if (isAlreadyRequested) {
      sellerArray.forEach((sellerObject) => {
        if (sellerObject.paymentRequested === 'Yes') {
          sellerObject.paymentRequestedTimestamp = paymentRequestedTimestamp;
          sellerObject.f3LiveOfThisTime = f3LiveOfThisTime;
          sellerObject.startedDateAndTime = paymentRequestedTimestamp;
        }
      });
      
      await collection.updateOne({ storeId }, { $set: { [`approvalcheckout.${sellerId}`]: sellerArray } });

      console.log(`Payment requested timestamp updated successfully for sellerId ${sellerId}`);

      res.status(405).json({ error: `Payment has already been requested for sellerId ${sellerId}` });
      return;
    }

    if (typeof user.paymentRequestSeller === 'undefined') {
      user.paymentRequestSeller = {};
    }
    const copiedSellerArray = sellerArray.map((sellerObject) => {
      const { paymentRequested, paymentRequestedTimestamp, paymentRequestedBuyer, paymentRequestedTimestampBuyer, ...rest } = sellerObject;
      return { ...rest, totalF3Amount, totalGc,sellerId,f3LiveOfThisTime };
    });
    
    user.paymentRequestSeller[sellerId] = copiedSellerArray;

    sellerArray.forEach((sellerObject) => {
      if (!sellerObject.paymentRequested && !sellerObject.paymentRequestedTimestamp) {
        sellerObject.paymentRequested = 'Yes';
        sellerObject.paymentRequestedTimestamp = paymentRequestedTimestamp;
        sellerObject.totalF3Amount = totalF3Amount;
        sellerObject.totalGc = totalGc;
        sellerObject.f3LiveOfThisTime = f3LiveOfThisTime,
        sellerObject.storeIdProduct = sellerId;
        sellerObject.startedDateAndTime = paymentRequestedTimestamp;
      } else if (sellerObject.paymentRequested === 'Yes') {
        sellerObject.paymentRequestedTimestamp = paymentRequestedTimestamp;
      }
    });
    
    // Update the user in the database with the updated paymentRequestSeller
    await collection.updateOne(
      { storeId },
      { $set: { [`approvalcheckout.${sellerId}`]: sellerArray, paymentRequestSeller: user.paymentRequestSeller } }
    );

    // Close MongoDB connection
    await client.close();

    console.log(`Payment requested flag updated successfully for all sellers in storeId ${storeId}`);

    // Send response
    res.status(200).json({ message: 'Payment requested flag updated successfully for all sellers' });
  } catch (error) {
    console.error('Error updating payment requested flag:', error);
    res.status(500).json({ error: 'An error occurred while updating payment requested flag' });
  }
});

app.get('/updateRequestApprovedCheckoutBuyerSection', async (req, res) => {
  try {
    const { storeId, sellerId, paymentRequestedTimestamp,totalF3Amount,totalGc,f3LiveOfThisTime } = req.query;

    console.log('Request received:', storeId, sellerId, paymentRequestedTimestamp,totalF3Amount,totalGc);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by storeId
    const user = await collection.findOne({ storeId });

    if (!user) {
      console.log(`User with storeId ${storeId} not found`);
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }

    // Ensure that approvalcheckout is an object
    if (typeof user.approvalcheckout !== 'object' || !user.approvalcheckout.hasOwnProperty(sellerId)) {
      console.log(`Seller with sellerId ${sellerId} not found in approvalcheckout object`);
      res.status(404).json({ error: `Seller with sellerId ${sellerId} not found in approvalcheckout object` });
      return;
    }

    // Get the array corresponding to the sellerId
    const sellerArray = user.approvalcheckout[sellerId];

    // Check if paymentRequested and paymentRequestedTimestamp already exist in any object of the array
    const isAlreadyRequested = sellerArray.some((sellerObject) => {
      return sellerObject.paymentRequestedBuyer === 'Yes' || sellerObject.paymentRequestedTimestampBuyer === paymentRequestedTimestamp;
    });

    if (isAlreadyRequested) {
      // Update payment requested timestamp
      sellerArray.forEach((sellerObject) => {
        if (sellerObject.paymentRequestedBuyer === 'Yes') {
          sellerObject.paymentRequestedTimestampBuyer = paymentRequestedTimestamp;
          sellerObject.f3LiveOfThisTime = f3LiveOfThisTime;
          sellerObject.startedDateAndTime = paymentRequestedTimestamp;
        }
      });

      // Update the user in the database
      await collection.updateOne({ storeId }, { $set: { [`approvalcheckout.${sellerId}`]: sellerArray } });

      console.log(`Payment requested timestamp updated successfully for sellerId ${sellerId}`);

      // Send response indicating payment has already been requested
      return res.status(405).json({ error: `Payment has already been requested for sellerId ${sellerId}` });
    }

    if (!user.paymentRequestBuyer) {
      user.paymentRequestBuyer = {};
    }

    const copiedSellerArray = sellerArray.map((sellerObject) => {
      const { paymentRequested, paymentRequestedTimestamp, paymentRequestedBuyer, paymentRequestedTimestampBuyer, ...rest } = sellerObject;
      return { ...rest, totalF3Amount, totalGc,sellerId,f3LiveOfThisTime };
    });
    

    user.paymentRequestBuyer[sellerId] = copiedSellerArray;

    sellerArray.forEach((sellerObject) => {
      if (!sellerObject.paymentRequestedBuyer && !sellerObject.paymentRequestedTimestampBuyer) {
        sellerObject.paymentRequestedBuyer = 'Yes';
        sellerObject.paymentRequestedTimestampBuyer = paymentRequestedTimestamp;
        sellerObject.totalF3Amount = totalF3Amount;
        sellerObject.totalGc = totalGc;
        sellerObject.f3LiveOfThisTime = f3LiveOfThisTime,
        sellerObject.storeIdProduct = sellerId;
        sellerObject.startedDateAndTime = paymentRequestedTimestamp;;
      }else if(sellerObject.paymentRequestedBuyer === 'Yes'){
        sellerObject.paymentRequestedTimestampBuyer = paymentRequestedTimestamp
      }
    });

    // Update the user in the database
    await collection.updateOne(
      { storeId },
      { $set: { [`approvalcheckout.${sellerId}`]: sellerArray, paymentRequestBuyer: user.paymentRequestBuyer } }
    );

    // Close MongoDB connection
    await client.close();

    console.log(`Payment requested flag updated successfully for all sellers in storeId ${storeId}`);

    // Send response
    res.status(200).json({ message: 'Payment requested flag updated successfully for all sellers' });
  } catch (error) {
    console.error('Error updating payment requested flag:', error);
    res.status(500).json({ error: 'An error occurred while updating payment requested flag' });
  }
});

app.get('/getRequestsOfPayments', async (req, res) => {
  try {
    const { walletAddress } = req.query;

    console.log('Request received:', walletAddress);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by walletAddress
    const user = await collection.findOne({ walletAddress });

    if (!user) {
      console.log(`User with walletAddress ${walletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${walletAddress} not found` });
    }

    const response = {
      requests: []
    };

    // Check if paymentRequestSeller object exists
    if (!user.paymentRequestSeller) {
      const storeId = user.storeId;

      console.log(storeId);
      // Find other users who have seller requests with the same storeId
      const otherUsersWithSellerRequests = await collection.find({
        'paymentRequestSeller': {
          $exists: true,
        }
      }).toArray();
      
      const requestedStoreId = user.storeId; // Assuming user is the current user
      
      console.log('Requested StoreId:', requestedStoreId);
      
      // Iterate over otherUsersWithSellerRequests to find requests for the requested storeId
      for (const otherUser of otherUsersWithSellerRequests) {
        if (otherUser.paymentRequestSeller && otherUser.paymentRequestSeller[requestedStoreId]) {
          const storeIdRequests = otherUser.paymentRequestSeller[requestedStoreId];
          const buyerUser = await collection.findOne({ walletAddress: otherUser.walletAddress });
          if (buyerUser) {
            const buyerWalletAddress = buyerUser.walletAddress;
            const sellerProducts = storeIdRequests.map(product => ({
              productId: product.productId,
              quantity: product.quantity,
              totalPrice: product.totalPrice,
              totalF3: product.totalF3Amount,
              totalGc: product.totalGc,
              sellerWalletAddress: user.walletAddress, 
              dateAndTime : product.dateAndTime,
              startedDateAndTime : product.startedDateAndTime
            }));
            const sellerRequest = {
              totalF3: storeIdRequests[0].totalF3Amount,
              totalGc: storeIdRequests[0].totalGc,
              storeId: requestedStoreId,
              buyerWalletAddress: buyerWalletAddress, // Add buyer's wallet address to each product
              sellerWalletAddress: user.walletAddress, // The seller's wallet address is from the original user
              requestType: 'seller',
              products: sellerProducts
            };
            response.requests.push(sellerRequest);
          }
        }
      }};
     
            
      let sellerUsers = {};
      if (user.paymentRequestBuyer) {
        const storeIds = Object.keys(user.paymentRequestBuyer);
        for (const storeId of storeIds) {
          const sellerStore = user.paymentRequestBuyer[storeId][0].sellerId;
          const SellerUser = await collection.findOne({ storeId: sellerStore });
          sellerUsers[storeId] = SellerUser;
        }
        
        // Process buyer requests
        for (const storeId of storeIds) {
          const SellerUser = sellerUsers[storeId];
          const buyerProducts = user.paymentRequestBuyer[storeId].map(product => ({
            productId: product.productId,
            quantity: product.quantity,
            totalPrice: product.totalPrice,
            totalF3: product.totalF3Amount,
            totalGc: product.totalGc,
            sellerWalletAddress: product.sellerId,
            dateAndTime: product.dateAndTime,
            startedDateAndTime : product.startedDateAndTime
          }));
  
          const buyerRequest = {
            totalF3: user.paymentRequestBuyer[storeId][0].totalF3Amount,
            totalGc: user.paymentRequestBuyer[storeId][0].totalGc,
            storeId: user.paymentRequestBuyer[storeId][0].sellerId,
            sellerWalletAddress: SellerUser.walletAddress,
            buyerWalletAddress: user.walletAddress,
            requestType: 'buyer',
            products: buyerProducts
          };
  
          response.requests.push(buyerRequest);
        }
      }
    

    // Close MongoDB connection
    await client.close();

    console.log(`Payment requests retrieved successfully for walletAddress ${walletAddress}`);

    // Send response
    res.status(200).json(response);
  } catch (error) {
    console.error('Error retrieving payment requests:', error);
    res.status(500).json({ error: 'An error occurred while retrieving payment requests' });
  }
});

app.get('/updatePaymentRequestFlagAndMakeItApprovedSeller', async (req, res) => {
  try {
    const { buyerwalletAddress, dateAndTime, txhashBuyer, txhashGc, sellerStoreId } = req.query;

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by walletAddress
    const user = await collection.findOne({ walletAddress: buyerwalletAddress });

    if (!user) {
      console.log(`User with walletAddress ${buyerwalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerwalletAddress} not found` });
    }

    // Check if paymentRequestSeller object exists
    if (user.paymentRequestSeller && user.paymentRequestSeller[sellerStoreId]) {
      const storeIdRequests = user.paymentRequestSeller[sellerStoreId];

      // Update each request object with dateAndTime, txhashBuyer, and txhashGc
      storeIdRequests.forEach(request => {
        request.dateAndTime = dateAndTime;
        request.txhashBuyer = txhashBuyer;
        request.txhashGc = txhashGc;
      });
      
      // Create a copy of storeIdRequests for approvedRequestsSellers
      const newRequestObject = {
        'requestProducts': [...storeIdRequests]
      };
  
      // Ensure approvedPaymentRequestsSeller object exists and is an array
      user.approvedPaymentRequestsSeller = user.approvedPaymentRequestsSeller || {};

      // Add or update the approved requests under sellerStoreId in approvedPaymentRequestsSeller
      if (!Array.isArray(user.approvedPaymentRequestsSeller[sellerStoreId])) {
        console.log(`Creating new approvedPaymentRequestsSeller array for sellerStoreId ${sellerStoreId}`);
        user.approvedPaymentRequestsSeller[sellerStoreId] = [newRequestObject];
      } else {
        console.log(`Adding new request to existing approvedPaymentRequestsSeller array for sellerStoreId ${sellerStoreId}`);
        user.approvedPaymentRequestsSeller[sellerStoreId].push(newRequestObject);
      }

      // Save the updated user data
      await collection.updateOne({ walletAddress: buyerwalletAddress }, { $set: user });

      // Close MongoDB connection
      await client.close();

      console.log(`Payment requests updated and approved successfully for walletAddress ${buyerwalletAddress}`);

      // Send response
      res.status(200).json({ message: 'Payment requests updated and approved successfully', newRequestObject });
    } else {
      console.log(`Payment requests not found for sellerStoreId ${sellerStoreId}`);
      res.status(404).json({ error: `Payment requests not found for sellerStoreId ${sellerStoreId}` });
    }
  } catch (error) {
    console.error('Error updating and approving payment requests:', error);
    res.status(500).json({ error: 'An error occurred while updating and approving payment requests' });
  }
});

app.get('/updatePaymentRequestFlagAndMakeItApprovedBuyer', async (req, res) => {
  try {
    const { buyerwalletAddress, dateAndTime, txhashGc, sellerStoreId } = req.query;

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by walletAddress
    const user = await collection.findOne({ walletAddress: buyerwalletAddress });

    if (!user) {
      console.log(`User with walletAddress ${buyerwalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerwalletAddress} not found` });
    }

    // Check if paymentRequestSeller object exists
    if (user.paymentRequestBuyer && user.paymentRequestBuyer[sellerStoreId]) {
      const storeIdRequests = user.paymentRequestBuyer[sellerStoreId];

      // Update each request object with dateAndTime, txhashBuyer, and txhashGc
      storeIdRequests.forEach(request => {
        request.dateAndTime = dateAndTime;
        request.txhashGc = txhashGc;
      });
      
      // Create a copy of storeIdRequests for approvedRequestsSellers
      const newRequestObject = {
        'requestProducts': [...storeIdRequests]
      };
  
      // Ensure approvedPaymentRequestsSeller object exists and is an array
      user.approvedPaymentRequestsBuyer = user.approvedPaymentRequestsBuyer || {};

      // Add or update the approved requests under sellerStoreId in approvedPaymentRequestsSeller
      if (!Array.isArray(user.approvedPaymentRequestsBuyer[sellerStoreId])) {
        console.log(`Creating new approvedPaymentRequestsSeller array for sellerStoreId ${sellerStoreId}`);
        user.approvedPaymentRequestsBuyer[sellerStoreId] = [newRequestObject];
      } else {
        console.log(`Adding new request to existing approvedPaymentRequestsSeller array for sellerStoreId ${sellerStoreId}`);
        user.approvedPaymentRequestsBuyer[sellerStoreId].push(newRequestObject);
      }

      // Save the updated user data
      await collection.updateOne({ walletAddress: buyerwalletAddress }, { $set: user });

      // Close MongoDB connection
      await client.close();

      console.log(`Payment requests updated and approved successfully for walletAddress ${buyerwalletAddress}`);

      // Send response
      res.status(200).json({ message: 'Payment requests updated and approved successfully', newRequestObject });
    } else {
      console.log(`Payment requests not found for sellerStoreId ${sellerStoreId}`);
      res.status(404).json({ error: `Payment requests not found for sellerStoreId ${sellerStoreId}` });
    }
  } catch (error) {
    console.error('Error updating and approving payment requests:', error);
    res.status(500).json({ error: 'An error occurred while updating and approving payment requests' });
  }
});

app.get('/getApprovedSellerBuyerPaymentRequests', async (req, res) => {
  try {
    const { sellerStoreId } = req.query;

    console.log('Searching for approved payment requests for sellerStoreId:', sellerStoreId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const userSeller = await collection.findOne({ storeId : sellerStoreId });

    const response = {
      requests: []
    };
    // Find users with approvedPaymentRequestsSeller containing the specified sellerStoreId
    const usersWithApprovedRequests = await collection.aggregate([
      {
        $match: {
          'approvedPaymentRequestsSeller': { $exists: true }
        }
      },
      {
        $addFields: {
          approvedPaymentRequestsArray: { $objectToArray: '$approvedPaymentRequestsSeller' }
        }
      },
      {
        $match: {
          'approvedPaymentRequestsArray.k': sellerStoreId
        }
      }
    ]).toArray();

    const usersWithBuyerApprovedRequest = await collection.find({
      'storeId': sellerStoreId, // Replace 'userType' with the actual field name distinguishing sellerUser
      'approvedPaymentRequestsBuyer': {
        $exists: true,
      }
    }).toArray();
    console.log('buyerOnes',usersWithBuyerApprovedRequest)
    console.log('Found users with approved requests:', usersWithApprovedRequests);

    // Extract approved payment requests from users
    const approvedRequests = usersWithApprovedRequests.reduce((acc, user) => {
      if (user.approvedPaymentRequestsSeller && user.approvedPaymentRequestsSeller[sellerStoreId]) {
        const buyerWalletAddress = user.walletAddress;
        const sellerWalletAddress = userSeller.walletAddress
        const storeRequests = user.approvedPaymentRequestsSeller[sellerStoreId];
        storeRequests.forEach(storeRequest => {
          // Add the requestType field directly to each store request object
          const requestWithRequestType = {buyerWalletAddress,sellerWalletAddress, requestType: 'seller',...storeRequest,  };
          acc.push(requestWithRequestType);
        });
      }
      return acc;
    }, []);
    
    // Pushing to response.requests is done outside of the reduce loop
    response.requests.push(...approvedRequests);


    const approvedRequestsBuyers = usersWithBuyerApprovedRequest.reduce((acc, user) => {
      const buyerWalletAddress = user.walletAddress;
      const storeRequests = user.approvedPaymentRequestsBuyer;
      
      // Iterate over the keys of storeRequests object
      Object.keys(storeRequests).forEach(subRequestName => {
          const requestsArray = storeRequests[subRequestName];
          
          // Iterate over the array of requests for each subRequestName
          requestsArray.forEach(storeRequest => {
              const requestWithRequestType = { buyerWalletAddress, requestType: 'buyer', ...storeRequest };
              acc.push(requestWithRequestType);
          });
      });
      
      return acc;
  }, []);
  
    
    // Pushing to response.requests is done outside of the reduce loop
    response.requests.push(...approvedRequestsBuyers);
    

    console.log('buyersOne',usersWithBuyerApprovedRequest);

    console.log('Extracted approved requests:', approvedRequests, approvedRequestsBuyers);

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching approved payment requests:', error);
    res.status(500).json({ error: 'An error occurred while fetching approved payment requests' });
  }
});

app.get('/deleteBuyerRequestAndAddSalesHistory', async (req, res) => {
  try {
    const { buyerWalletAddress, storeId } = req.query;

    console.log('Deleting buyer request and adding to sales history for buyerWalletAddress:', buyerWalletAddress, 'and storeId:', storeId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user with the specified buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with walletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerWalletAddress} not found` });
    }

    // Find the paymentRequestBuyer map in the user document
    const paymentRequestBuyerMap = user.paymentRequestBuyer || {};
    const storeRequestsArray = paymentRequestBuyerMap[storeId] || [];

    // Make a copy of the storeRequestsArray
    const storeRequestsCopy = [...storeRequestsArray];

    // Add the copied array to salesHistoryBuyer map
    const salesHistoryBuyerMap = {
      ...user.salesHistoryBuyer, // Preserve existing sales history
      [storeId]: storeRequestsCopy
    };

    // Delete the array from paymentRequestBuyer map
    delete paymentRequestBuyerMap[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      {
        $set: {
          paymentRequestBuyer: paymentRequestBuyerMap,
          salesHistoryBuyer: salesHistoryBuyerMap // Update sales history
        }
      }
    );

    // Delete the array from approvalcheckout map only if it exists
    if (user.approvalcheckout && user.approvalcheckout[storeId]) {
      await collection.updateOne(
        { walletAddress: buyerWalletAddress },
        {
          $unset: {
            [`approvalcheckout.${storeId}`]: 1
          }
        }
      );
    }

    // Close MongoDB connection
    await client.close();

    console.log(`Buyer request deleted and added to sales history successfully for walletAddress ${buyerWalletAddress}`);

    // Send success response
    res.status(200).json({ message: 'Buyer request deleted and added to sales history successfully' });
  } catch (error) {
    console.error('Error deleting buyer request and adding to sales history:', error);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

app.get('/deleteSellerRequestAndAddSalesHistory', async (req, res) => {
  try {
    const { buyerWalletAddress, storeId } = req.query;

    console.log('Deleting buyer request and adding to sales history for buyerWalletAddress:', buyerWalletAddress, 'and storeId:', storeId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user with the specified buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with walletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerWalletAddress} not found` });
    }

    const paymentRequestSellerMap = user.paymentRequestSeller || {};
    const storeRequestsArray = paymentRequestSellerMap[storeId] || [];

    // Make a copy of the storeRequestsArray
    const storeRequestsCopy = [...storeRequestsArray];

    // Add the copied array to salesHistoryBuyer map
    const salesHistorySellerMap = {
      ...user.salesHistorySeller, // Preserve existing sales history
      [storeId]: storeRequestsCopy
    };

    // Delete the array from paymentRequestBuyer map
    delete paymentRequestSellerMap[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      {
        $set: {
          paymentRequestSeller: paymentRequestSellerMap,
          salesHistorySeller: salesHistorySellerMap // Update sales history
        }
      }
    );

    // Delete the array from approvalcheckout map only if it exists
    if (user.approvalcheckout && user.approvalcheckout[storeId]) {
      await collection.updateOne(
        { walletAddress: buyerWalletAddress },
        {
          $unset: {
            [`approvalcheckout.${storeId}`]: 1
          }
        }
      );
    }

    // Close MongoDB connection
    await client.close();

    console.log(`Buyer request deleted and added to sales history successfully for walletAddress ${buyerWalletAddress}`);

    // Send success response
    res.status(200).json({ message: 'Buyer request deleted and added to sales history successfully' });
  } catch (error) {
    console.error('Error deleting buyer request and adding to sales history:', error);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

app.get('/deleteBuyerUnApprovedRequest', async (req, res) => {
  try {
    const { buyerWalletAddress, storeId } = req.query;

    console.log('Deleting buyer request and adding to sales history for buyerWalletAddress:', buyerWalletAddress, 'and storeId:', storeId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user with the specified buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with walletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerWalletAddress} not found` });
    }

    // Find the paymentRequestBuyer map in the user document
    const paymentRequestBuyerMap = user.paymentRequestBuyer || {};
    const storeRequestsArray = paymentRequestBuyerMap[storeId] || [];

    delete paymentRequestBuyerMap[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      {
        $set: {
          paymentRequestBuyer: paymentRequestBuyerMap,
        }
      }
    );

    // Delete the specified strings from each object in the array
    if (user.approvalcheckout && user.approvalcheckout[storeId]) {
      const arrayToUpdate = user.approvalcheckout[storeId];
      const updatedArray = arrayToUpdate.map(item => {
        delete item.paymentRequestedBuyer;
        delete item.paymentRequestedTimestampBuyer
        ;
        return item;
      });

      await collection.updateOne(
        { walletAddress: buyerWalletAddress },
        {
          $set: {
            [`approvalcheckout.${storeId}`]: updatedArray
          }
        }
      );
    }

    // Close MongoDB connection
    await client.close();

    console.log(`Buyer request deleted and added to sales history successfully for walletAddress ${buyerWalletAddress}`);

    // Send success response
    res.status(200).json({ message: 'Buyer request deleted and added to sales history successfully' });
  } catch (error) {
    console.error('Error deleting buyer request and adding to sales history:', error);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

app.get('/deleteSellerUnApprovedRequest', async (req, res) => {
  try {
    const { buyerWalletAddress, storeId } = req.query;

    console.log('Deleting buyer request and adding to sales history for buyerWalletAddress:', buyerWalletAddress, 'and storeId:', storeId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user with the specified buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with walletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerWalletAddress} not found` });
    }

    // Find the paymentRequestBuyer map in the user document
    const paymentRequestSellerMap = user.paymentRequestSeller || {};
    const storeRequestsArray = paymentRequestSellerMap[storeId] || [];

    delete paymentRequestSellerMap[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      {
        $set: {
          paymentRequestSeller: paymentRequestSellerMap,
        }
      }
    );

    // Delete the specified strings from each object in the array
    if (user.approvalcheckout && user.approvalcheckout[storeId]) {
      const arrayToUpdate = user.approvalcheckout[storeId];
      const updatedArray = arrayToUpdate.map(item => {
        delete item.paymentRequested;
        delete item.paymentRequestedTimestamp;
        return item;
      });

      await collection.updateOne(
        { walletAddress: buyerWalletAddress },
        {
          $set: {
            [`approvalcheckout.${storeId}`]: updatedArray
          }
        }
      );
    }

    // Close MongoDB connection
    await client.close();

    console.log(`Buyer request deleted and added to sales history successfully for walletAddress ${buyerWalletAddress}`);

    // Send success response
    res.status(200).json({ message: 'Buyer request deleted and added to sales history successfully' });
  } catch (error) {
    console.error('Error deleting buyer request and adding to sales history:', error);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

app.get('/getSellerSectionSalesHistory', async (req, res) => {
  try {
    const { sellerId } = req.query;
    console.log('Requested Seller ID:', sellerId);

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find all users with checkout approvals
    const usersWithSalesHistorySeller = await collection.find({ 'salesHistorySeller': { $exists: true } }).toArray();

    if (!usersWithSalesHistorySeller || usersWithSalesHistorySeller.length === 0) {
      res.status(404).json({ error: 'No users found with checkout approvals' });
      return;
    }

    console.log('Users with Checkout Approvals:', usersWithSalesHistorySeller);

    // Prepare an array to store product details
    const products = [];

    // Iterate over each user with checkout approvals
    for (const user of usersWithSalesHistorySeller) {
      console.log('User:', user);
      
      if (user.salesHistorySeller[sellerId]) {
        const sellerSalesHistoryArray = user.salesHistorySeller[sellerId];
        console.log('Approvals Checkout for Seller:', sellerSalesHistoryArray);
        
        // Iterate over each checkout approval in the seller's array
        for (const saleshistory of sellerSalesHistoryArray) {
          const { productId, quantity, totalPrice,paymentRequestedTimestamp,totalF3Amount,totalGc,f3LiveOfThisTime } = saleshistory;

          // Fetch product details from MongoDB
          const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

          // Add product details along with quantity, totalPrice, and storeId
          products.push({
            _id: productId,
            totalQuantity : quantity,
            totalPrice,
            paymentRequestedTimestamp,
            totalF3Amount,
            totalGc,
            f3LiveOfThisTime,
            productName: productDetails.products[0].productName,
            startedPrice: productDetails.products[0].startedPrice,
            f3MarketPrice: productDetails.products[0].f3MarketPrice,
            growthContribution: productDetails.products[0].growthContribution,
            numberOfStocks: productDetails.products[0].numberOfStocks,
            unitItemSelected: productDetails.products[0].unitItemSelected,
            description: productDetails.products[0].description,
            totalsolds: productDetails.products[0].totalsolds,
            storeId : productDetails.products[0].storeId,
            storeIdBuyer: user.storeId,
            walletAddressBuyer : user.walletAddress,
            flagWord : productDetails.products[0].flagWord,
            storeName: productDetails.products[0].storeName,
            images: productDetails.products[0].images
          });
        }
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with products array
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error retrieving seller products by ID:', error);
    res.status(500).json({ error: 'An error occurred while retrieving seller products by ID' });
  }
});

app.get('/getBuyersSectionSalesHistory', async (req, res) => {
  try {
    const { buyerId } = req.query;
    console.log('Buyer ID:', buyerId);

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the buyer by buyerId
    const buyer = await collection.findOne({ storeId: buyerId });

    if (!buyer) {
      res.status(404).json({ error: 'Buyer not found' });
      return;
    }

    // Check if the buyer has checkout approvals
    const SalesHistoryMap = buyer.salesHistoryBuyer;
    console.log('Type of checkoutApprovalMap:', typeof SalesHistoryMap);
    console.log('Checkout Approval Map:', SalesHistoryMap);
    if (!SalesHistoryMap) {
      res.status(402).json({ error: 'Checkout approvals not found for the buyer' });
      return;
    }

    // Prepare an array to store product details
    const products = [];

    // Iterate over each store's checkout approval
    for (const sellerId in SalesHistoryMap) {
      const sellerSalesHistoryArray = SalesHistoryMap[sellerId];

      // Iterate over each checkout approval in the seller's array
      for (const saleshistory of sellerSalesHistoryArray) {
        const { productId, quantity, totalPrice,paymentRequestedTimestampBuyer,totalF3Amount,totalGc,f3LiveOfThisTime } = saleshistory;

        // Fetch product details from MongoDB
        const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

        // Add product details along with quantity and totalPrice
        products.push({
          _id: productId,
          totalQuantity : quantity,
          totalPrice,
          paymentRequestedTimestampBuyer,
          totalF3Amount,
          totalGc,
          f3LiveOfThisTime,
          productName: productDetails.products[0].productName,
          startedPrice: productDetails.products[0].startedPrice,
          f3MarketPrice: productDetails.products[0].f3MarketPrice,
          growthContribution: productDetails.products[0].growthContribution,
          numberOfStocks: productDetails.products[0].numberOfStocks,
          unitItemSelected: productDetails.products[0].unitItemSelected,
          description: productDetails.products[0].description,
          totalsolds: productDetails.products[0].totalsolds,
          storeId: productDetails.products[0].storeId,
          flagWord : productDetails.products[0].flagWord,
          storeName: productDetails.products[0].storeName,
          images: productDetails.products[0].images
        });
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with products array
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error retrieving buyer products by ID:', error);
    res.status(500).json({ error: 'An error occurred while retrieving buyer products by ID' });
  }
});

app.get('/getUserDetails', async (req, res) => {
  try {
      const { email } = req.query;

      console.log('Request received:', email);

      const userDetails = await getUserDetails(email);

      console.log(`User details retrieved successfully for email ${email}`);

      // Send response with user details
      res.status(200).json(userDetails);
  } catch (error) {
      console.error('Error retrieving user details:', error);
      res.status(500).json({ error: 'An error occurred while retrieving user details' });
  }
});


app.listen(PORT, '192.168.29.149', () => {
  console.log(`Server is running on http://192.168.29.149:${PORT}`);
});

