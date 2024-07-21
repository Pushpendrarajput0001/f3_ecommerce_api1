const Web3 = require('web3');
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const { MongoClient, ObjectId } = require('mongodb');
const sharp = require('sharp');
const axios = require('axios');
const { ethers, JsonRpcProvider, formatEther, parseUnits, isAddress, ContractTransactionResponse, InfuraProvider } = require("ethers");
const { error } = require('console');
const { parse } = require('path');
const app = express();
const PORT = 5000;
const MONGO_URI = 'mongodb+srv://andy:markf3ecommerce@atlascluster.gjlv4np.mongodb.net/?retryWrites=true&w=majority&appName=AtlasCluster';
app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// Middleware to parse JSON 
app.use(bodyParser.json());

const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// API endpoint to save user data
app.post('/usersregister', async (req, res) => {
  try {
    // Extract user data from request body
    const { email, password, storeName, walletAddress, cityAddress, localAddress, usdtRate, country, storeId, currencySymbol, currencyCode, flagWord, alpha3Code, applicantId, kycStatusUser, fullName, kycSessionId } = req.body;

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();

    // Access the appropriate database and collection
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Check if the email already exists
    const existingUser = await collection.findOne({ email });
    const existingUserWallet = await collection.findOne({ walletAddress });
    if (existingUser) {
      // Close the MongoDB connection
      await client.close();
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    if (existingUserWallet) {
      await client.close();
      return res.status(401).json({ error: 'User with this wallet already' })
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
      country,
      alpha3Code,
      applicantId,
      kycStatusUser,
      fullName,
      kycSessionId
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
      storeId: user.storeId,
      walletAddress: user.walletAddress,
      cityAddress: user.cityAddress,
      localAddress: user.localAddress,
      usdRate: user.usdtRate,
      flagWord: user.flagWord,
      currencySymbol: user.currencySymbol,
      country: user.country,
      alpha3Code: user.alpha3Code,
      applicantId: user.applicantId,
      kycStatusUser: user.kycStatusUser,
      kycSessionId: user.kycSessionId
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
    const { email, productName, startedPrice, f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected, description, totalsolds, images, storeId, storeName, flagWord, offer, sellerWalletAddress, resellers_reward } = req.body;

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
      sellerWalletAddress,
      resellers_reward,
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

    if (!user.productsbackup) {
      user.productsbackup = [];
    }
    user.productsbackup.push(productDocument);
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
    const product = await collection.findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if userCarts map exists, if not create it
    if (!user.userCarts) {
      user.userCarts = {};
    }

    // Check if product already exists in the user's cart
    if (user.userCarts[productId]) {
      // If product already exists, send error response with status code 401
      res.status(401).json({ error: 'Product already exists in the cart' });
      return;
    }

    // Add product to user's cart
    user.userCarts[productId] = 1; // Default quantity is 1

    // Check if userCartsProductsDetails map exists, if not create it
    if (!user.userCartsProductsDetails) {
      user.userCartsProductsDetails = {};
    }

    // Add product details to userCartsProductsDetails map
    const newObjectKey = uuid.v4();

    // Add product details to userCartsProductsDetails map using the generated UUID as key
    user.userCartsProductsDetails[newObjectKey] = { ...product.products[0] };
    // Update the user document in the database
    await collection.updateOne(
      { email },
      { $set: { userCarts: user.userCarts, userCartsProductsDetails: user.userCartsProductsDetails } }
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

    // Retrieve product details from userCartsProductsDetails map
    const cartProducts = [];
    Object.keys(user.userCartsProductsDetails).forEach((key) => {
      cartProducts.push(user.userCartsProductsDetails[key]);
    });


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

      // Delete the product with the matching _id from userCartsProductsDetails
      for (const key in user.userCartsProductsDetails) {
        if (user.userCartsProductsDetails.hasOwnProperty(key)) {
          const productDetail = user.userCartsProductsDetails[key];
          if (productDetail._id === productId) {
            delete user.userCartsProductsDetails[key];
          }
        }
      }
    });

    await collection.updateOne(
      { email },
      { $set: { userCarts: user.userCarts, userCartsProductsDetails: user.userCartsProductsDetails } }
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

    for (const product of products) {
      const { productId, quantity, totalPrice, storeId, offer } = product;

      let productDetails;
      for (const key in user.userCartsProductsDetails) {
        if (user.userCartsProductsDetails.hasOwnProperty(key)) {
          const productDetail = user.userCartsProductsDetails[key];
          if (productDetail._id === productId) {
            productDetails = productDetail;
            break;
          }
        }
      }

      console.log(productDetails);
      // Check if checkoutapproval for the storeId already exists
      if (!user.checkoutapproval[storeId]) {
        user.checkoutapproval[storeId] = [];
      }

      // Add new product with details
      user.checkoutapproval[storeId].push({
        productId,
        quantity,
        totalPrice,
        offerp: offer,
        productName: productDetails.productName,
        startedPrice: productDetails.startedPrice,
        f3MarketPrice: productDetails.f3MarketPrice,
        growthContribution: productDetails.growthContribution,
        numberOfStocks: productDetails.numberOfStocks,
        unitItemSelected: productDetails.unitItemSelected,
        description: productDetails.description,
        totalsolds: productDetails.totalsolds,
        storeId: productDetails.storeId,
        offer: productDetails.offer,
        resellers_reward: productDetails.resellers_reward ?? 0,
        storeIdBuyer: user.storeId,
        walletAddressBuyer: user.walletAddress,
        flagWord: productDetails.flagWord,
        storeName: productDetails.storeName,
        images: productDetails.images
      });
    }

    // Update the user document in the database
    await collection.updateOne(
      { email },
      { $set: { checkoutapproval: user.checkoutapproval } }
    );

    const seller = await collection.findOne({ storeId: products[0].storeId });
    const sellerOneSignalIdMap = seller.OneSignalId;

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: sellerOneSignalIdMap });
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
          totalQuantity: quantity,
          totalPrice,
          ...productDetails
        });
      }
    }

    // Close MongoDB connection
    await client.close();

    // Send response with productsDetails array
    res.status(200).json({ products: productsDetails });
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
          const { productId, quantity, totalPrice, productName, startedPrice,
            f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected,
            description, totalsolds, storeId, offer, storeIdBuyer, walletAddressBuyer,
            flagWord, storeName, images, resellers_reward } = checkoutApproval;

          // Fetch product details from MongoDB
          const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

          // Add product details along with quantity, totalPrice, and storeId
          products.push({
            _id: productId,
            totalQuantity: quantity,
            totalPrice,
            productName,
            startedPrice,
            f3MarketPrice,
            growthContribution,
            numberOfStocks,
            unitItemSelected,
            description,
            totalsolds,
            storeId,
            offer,
            resellers_reward,
            storeIdBuyer,
            walletAddressBuyer,
            flagWord,
            storeName,
            images
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
      const existingProductBackup = await collection.findOne({ 'productsbackup._id': productId }, { projection: { 'productsbackup.$': 1 } });

      if (!existingProduct) {
        res.status(404).json({ error: `Product ${productId} not found in store` });
        return;
      }

      // Update the product's stocks and solds fields
      existingProduct.products[0].numberOfStocks = newStocks;
      existingProduct.products[0].totalsolds = newSolds;

      existingProductBackup.productsbackup[0].numberOfStocks = newStocks;
      existingProductBackup.productsbackup[0].totalsolds = newSolds;

      // Update the product in the database
      await collection.updateOne({ 'products._id': productId }, { $set: { 'products.$.numberOfStocks': newStocks, 'products.$.totalsolds': newSolds } });
      await collection.updateOne({ 'productsbackup._id': productId }, { $set: { 'productsbackup.$.numberOfStocks': newStocks, 'productsbackup.$.totalsolds': newSolds } });
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
    const { storeId, buyerId, dateOfApprovalCheckout } = req.query;

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
    const store_products = user.checkoutapproval[storeId].map(product => ({
      ...product,
      dateOfApprovalCheckout: dateOfApprovalCheckout
    }));

    // If approvalcheckout does not exist, create an empty object
    if (!user.approvalcheckout) {
      user.approvalcheckout = {};
    }

    if (!user.approvalcheckoutBuyer) {
      user.approvalcheckoutBuyer = {};
    }

    // If approvalcheckout does not have storeId as key or its value is not an array, create an empty array
    if (!user.approvalcheckout[storeId] || !Array.isArray(user.approvalcheckout[storeId])) {
      user.approvalcheckout[storeId] = [];
    }

    if (!user.approvalcheckoutBuyer[storeId] || !Array.isArray(user.approvalcheckoutBuyer[storeId])) {
      user.approvalcheckoutBuyer[storeId] = [];
    }

    // Add new products to the existing array
    user.approvalcheckout[storeId] = [
      ...user.approvalcheckout[storeId],
      ...store_products
    ];

    user.approvalcheckoutBuyer[storeId] = [
      ...user.approvalcheckoutBuyer[storeId],
      ...store_products
    ];

    // Delete the store from the checkoutapproval
    delete user.checkoutapproval[storeId];

    await collection.updateOne(
      { storeId: buyerId },
      { $set: { checkoutapproval: user.checkoutapproval, approvalcheckout: user.approvalcheckout, approvalcheckoutBuyer: user.approvalcheckoutBuyer } }
    );

    await client.close();

    res.status(200).json({ message: user.OneSignalId });
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
        const { productId, quantity, totalPrice, productName, startedPrice,
          f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected,
          description, totalsolds, storeId, offer, storeIdBuyer, walletAddressBuyer,
          flagWord, storeName, images } = checkoutApproval;

        // Fetch product details from MongoDB
        const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

        // Add product details along with quantity and totalPrice
        products.push({
          _id: productId,
          totalQuantity: quantity,
          totalPrice,
          productName,
          startedPrice,
          f3MarketPrice,
          growthContribution,
          numberOfStocks,
          unitItemSelected,
          description,
          totalsolds,
          storeId,
          offer,
          walletAddressBuyer,
          flagWord,
          storeName,
          images
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
          const { productId, quantity, totalPrice, paymentRequestedTimestamp,
            productName, startedPrice,
            f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected,
            description, totalsolds, storeId, offer, storeIdBuyer, walletAddressBuyer,
            flagWord, storeName, images, dateOfApprovalCheckout } = approvalcheckout;

          // Fetch product details from MongoDB
          const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

          // Add product details along with quantity, totalPrice, and storeId
          products.push({
            _id: productId,
            totalQuantity: quantity,
            totalPrice,
            paymentRequestedTimestamp,
            productName,
            startedPrice,
            f3MarketPrice,
            growthContribution,
            numberOfStocks,
            unitItemSelected,
            description,
            totalsolds,
            storeId,
            storeIdBuyer: user.storeId,
            offer,
            walletAddressBuyer: user.walletAddress,
            flagWord,
            storeName,
            images,
            dateOfApprovalCheckout
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
    const approvalCheckoutMap = buyer.approvalcheckoutBuyer;
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
        const { productId, quantity, totalPrice, paymentRequestedTimestampBuyer,
          productName, startedPrice,
          f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected,
          description, totalsolds, storeId, offer, storeIdBuyer, walletAddressBuyer,
          flagWord, storeName, images, dateOfApprovalCheckout } = approvalcheckout;

        // Fetch product details from MongoDB
        const productDetails = await db.collection('users').findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

        // Add product details along with quantity and totalPrice
        products.push({
          _id: productId,
          totalQuantity: quantity,
          totalPrice,
          paymentRequestedTimestampBuyer,
          productName,
          startedPrice,
          f3MarketPrice,
          growthContribution,
          numberOfStocks,
          unitItemSelected,
          description,
          totalsolds,
          storeId,
          flagWord,
          offer,
          storeName,
          images,
          dateOfApprovalCheckout
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
    const { storeId, sellerId, paymentRequestedTimestamp, totalF3Amount, totalGc, f3LiveOfThisTime } = req.query;

    console.log('Request received:', storeId, sellerId, paymentRequestedTimestamp, totalF3Amount, totalGc);

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
    //const sellerArrayReq = user.paymentRequestSeller[sellerId];

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

      if (user.paymentRequestSeller[sellerId]) {
        const sellerArrayReq = user.paymentRequestSeller[sellerId];
        sellerArrayReq.forEach((sellerObjectRequest) => {
          if (sellerObjectRequest.startedDateAndTime) {
            sellerObjectRequest.startedDateAndTime = paymentRequestedTimestamp
          }

        });
        await collection.updateOne({ storeId }, { $set: { [`paymentRequestSeller.${sellerId}`]: sellerArrayReq } });
      } else {

      }

      await collection.updateOne({ storeId }, { $set: { [`approvalcheckout.${sellerId}`]: sellerArray } });

      console.log(`Payment requested timestamp updated successfully for sellerId ${sellerId}`);

      res.status(405).json({ error: `Payment has already been requested for sellerId ${sellerId}` });
      return;
    }

    if (typeof user.paymentRequestSeller === 'undefined') {
      user.paymentRequestSeller = {};
    }

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

    const copiedSellerArray = sellerArray.map((sellerObject) => {
      const { paymentRequested, paymentRequestedTimestamp, paymentRequestedBuyer, paymentRequestedTimestampBuyer, ...rest } = sellerObject;
      return { ...rest, totalF3Amount, totalGc, sellerId, f3LiveOfThisTime };
    });

    user.paymentRequestSeller[sellerId] = copiedSellerArray;


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
    const { storeId, sellerId, paymentRequestedTimestamp, totalF3Amount, totalGc, f3LiveOfThisTime } = req.query;

    console.log('Request received:', storeId, sellerId, paymentRequestedTimestamp, totalF3Amount, totalGc);

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
    if (typeof user.approvalcheckoutBuyer !== 'object' || !user.approvalcheckoutBuyer.hasOwnProperty(sellerId)) {
      console.log(`Seller with sellerId ${sellerId} not found in approvalcheckout object`);
      res.status(404).json({ error: `Seller with sellerId ${sellerId} not found in approvalcheckout object` });
      return;
    }

    const sellerArray = user.approvalcheckoutBuyer[sellerId];
    //const sellerArrayRequestIn = user.paymentRequestBuyer[sellerId];

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

      if (user.paymentRequestBuyer[sellerId]) {
        const sellerArrayReq = user.paymentRequestBuyer[sellerId];
        sellerArrayReq.forEach((sellerObjectRequest) => {
          if (sellerObjectRequest.startedDateAndTime) {
            sellerObjectRequest.startedDateAndTime = paymentRequestedTimestamp
          }

        });
        await collection.updateOne({ storeId }, { $set: { [`paymentRequestBuyer.${sellerId}`]: sellerArrayReq } });
      } else {

      }


      // Update the user in the database
      await collection.updateOne({ storeId }, { $set: { [`approvalcheckout.${sellerId}`]: sellerArray } });
      //await collection.updateOne({ storeId }, { $set: { [`paymentRequestBuyer.${sellerId}`]: sellerArrayRequestIn } });


      console.log(`Payment requested timestamp updated successfully for sellerId ${sellerId}`);

      // Send response indicating payment has already been requested
      return res.status(405).json({ error: `Payment has already been requested for sellerId ${sellerId}` });
    }

    if (!user.paymentRequestBuyer) {
      user.paymentRequestBuyer = {};
    }

    sellerArray.forEach((sellerObject) => {
      if (!sellerObject.paymentRequestedBuyer && !sellerObject.paymentRequestedTimestampBuyer) {
        sellerObject.paymentRequestedBuyer = 'Yes';
        sellerObject.paymentRequestedTimestampBuyer = paymentRequestedTimestamp;
        sellerObject.totalF3Amount = totalF3Amount;
        sellerObject.totalGc = totalGc;
        sellerObject.f3LiveOfThisTime = f3LiveOfThisTime,
          sellerObject.storeIdProduct = sellerId;
        sellerObject.startedDateAndTime = paymentRequestedTimestamp;;
      } else if (sellerObject.paymentRequestedBuyer === 'Yes') {
        sellerObject.paymentRequestedTimestampBuyer = paymentRequestedTimestamp
      }
    });

    const copiedSellerArray = sellerArray.map((sellerObject) => {
      const { paymentRequested, paymentRequestedTimestamp, paymentRequestedBuyer, paymentRequestedTimestampBuyer, ...rest } = sellerObject;
      return { ...rest, totalF3Amount, totalGc, sellerId, f3LiveOfThisTime };
    });


    user.paymentRequestBuyer[sellerId] = copiedSellerArray;


    await collection.updateOne(
      { storeId },
      { $set: { [`approvalcheckoutBuyer.${sellerId}`]: sellerArray, paymentRequestBuyer: user.paymentRequestBuyer } }
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

      const otherUsersWithSellerCreditRequest = await collection.find({
        'paymentRequestForCredit': {
          $exists: true,
        }
      }).toArray();

      const otherUsersWithResellersRewardRequest = await collection.find({
        'paymentRequestResellersReward': {
          $exists: true,
        }
      }).toArray();

      const otherUsersWithProfitShareRequest = await collection.find({
        'paymentRequestProfitShare': {
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
              dateAndTime: product.dateAndTime,
              startedDateAndTime: product.startedDateAndTime
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
      }

      for (const otherUser of otherUsersWithSellerCreditRequest) {
        if (otherUser.paymentRequestForCredit && otherUser.paymentRequestForCredit[requestedStoreId]) {
          const storeIdRequests = otherUser.paymentRequestForCredit[requestedStoreId];
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
              dateAndTime: product.dateAndTime,
              lccAmount: product.lccAmount,
              startedDateAndTime: product.startedDateAndTime,
              paymentRequestedTimestampForCredit: product.paymentRequestedTimestampForCredit,
              f3LiveOfThisTimeCredit: product.f3LiveOfThisTimeCredit
            }));
            const creditRequestRequest = {
              totalF3: storeIdRequests[0].totalF3Amount,
              totalGc: storeIdRequests[0].totalGc,
              storeId: requestedStoreId,
              buyerWalletAddress: buyerWalletAddress,
              sellerWalletAddress: user.walletAddress,
              requestType: 'Credit',
              products: sellerProducts
            };
            response.requests.push(creditRequestRequest);
          }
        }
      }

      for (const otherUser of otherUsersWithResellersRewardRequest) {
        if (otherUser.paymentRequestResellersReward && otherUser.paymentRequestResellersReward[requestedStoreId]) {
          const storeIdRequests = otherUser.paymentRequestResellersReward[requestedStoreId];
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
              dateAndTime: product.dateAndTime,
              lccAmount: product.lccAmount,
              startedDateAndTime: product.startedDateAndTime,
              paymentRequestedTimestampForCredit: product.paymentRequestedTimestampForCredit,
              f3LiveOfThisTimeCredit: product.f3LiveOfThisTimeCredit
            }));
            const creditRequestRequest = {
              totalF3: storeIdRequests[0].totalF3Amount,
              totalGc: storeIdRequests[0].totalGc,
              storeId: requestedStoreId,
              buyerWalletAddress: buyerWalletAddress,
              sellerWalletAddress: user.walletAddress,
              requestType: 'Credit',
              products: sellerProducts
            };
            const simpleJson = [
              {
                "id": 1,
                "name": "John Doe",
                "email": "john.doe@example.com",
                "age": 25
              },
              {
                "id": 2,
                "name": "Jane Smith",
                "email": "jane.smith@example.com",
                "age": 30
              },
              {
                "id": 3,
                "name": "Emily Johnson",
                "email": "emily.johnson@example.com",
                "age": 22
              },
              {
                "id": 4,
                "name": "Michael Brown",
                "email": "michael.brown@example.com",
                "age": 35
              },
              {
                "id": 5,
                "name": "Sarah Davis",
                "email": "sarah.davis@example.com",
                "age": 28
              }
            ];
            const resellerRequest = {
              totalF3: storeIdRequests[0].f3ValueOfWithdraw,
              totalReceivableAmount: storeIdRequests[0].receivableAmount,
              providerWalletAddress: storeIdRequests[0].providerWalletAddress,
              sellerWalletAddress: storeIdRequests[0].providerWalletAddress,
              payingWalletAddress: storeIdRequests[0].payingWalletAddress,
              buyerWalletAddress: storeIdRequests[0].payingWalletAddress,
              receivableAmount: storeIdRequests[0].receivableAmount,
              dateAndTime: storeIdRequests[0].dateAndTime,
              currencySymbol: storeIdRequests[0].currencySymbol,
              storeId: storeIdRequests[0].storeId,
              providerStoreId: storeIdRequests[0].providerStoreId,
              products: simpleJson,
              requestType: 'Resellers Reward'
            }
            response.requests.push(resellerRequest);
          }
        }
      }

      for (const otherUser of otherUsersWithProfitShareRequest) {
        if (otherUser.paymentRequestProfitShare && otherUser.paymentRequestProfitShare[requestedStoreId]) {
          const storeIdRequests = otherUser.paymentRequestProfitShare[requestedStoreId];
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
              dateAndTime: product.dateAndTime,
              lccAmount: product.lccAmount,
              startedDateAndTime: product.startedDateAndTime,
              paymentRequestedTimestampForCredit: product.paymentRequestedTimestampForCredit,
              f3LiveOfThisTimeCredit: product.f3LiveOfThisTimeCredit
            }));
            const creditRequestRequest = {
              totalF3: storeIdRequests[0].totalF3Amount,
              totalGc: storeIdRequests[0].totalGc,
              storeId: requestedStoreId,
              buyerWalletAddress: buyerWalletAddress,
              sellerWalletAddress: user.walletAddress,
              requestType: 'Credit',
              products: sellerProducts
            };
            const simpleJson = [
              {
                "id": 1,
                "name": "John Doe",
                "email": "john.doe@example.com",
                "age": 25
              },
              {
                "id": 2,
                "name": "Jane Smith",
                "email": "jane.smith@example.com",
                "age": 30
              },
              {
                "id": 3,
                "name": "Emily Johnson",
                "email": "emily.johnson@example.com",
                "age": 22
              },
              {
                "id": 4,
                "name": "Michael Brown",
                "email": "michael.brown@example.com",
                "age": 35
              },
              {
                "id": 5,
                "name": "Sarah Davis",
                "email": "sarah.davis@example.com",
                "age": 28
              }
            ];
            const resellerRequest = {
              totalF3: storeIdRequests[0].f3ValueOfWithdraw,
              totalReceivableAmount: storeIdRequests[0].receivableAmount,
              providerWalletAddress: storeIdRequests[0].providerWalletAddress,
              sellerWalletAddress: storeIdRequests[0].providerWalletAddress,
              payingWalletAddress: storeIdRequests[0].payingWalletAddress,
              buyerWalletAddress: storeIdRequests[0].payingWalletAddress,
              receivableAmount: storeIdRequests[0].receivableAmount,
              dateAndTime: storeIdRequests[0].dateAndTime,
              currencySymbol: storeIdRequests[0].currencySymbol,
              storeId: storeIdRequests[0].storeId,
              providerStoreId: storeIdRequests[0].providerStoreId,
              products: simpleJson,
              requestType: 'Profit Share'
            }
            response.requests.push(resellerRequest);
          }
        }
      }
    } else {
      const storeId = user.storeId;

      console.log(storeId);
      // Find other users who have seller requests with the same storeId
      const otherUsersWithSellerRequests = await collection.find({
        'paymentRequestSeller': {
          $exists: true,
        }
      }).toArray();

      const otherUsersWithSellerCreditRequest = await collection.find({
        'paymentRequestForCredit': {
          $exists: true,
        }
      }).toArray();

      const otherUsersWithResellersRewardRequest = await collection.find({
        'paymentRequestResellersReward': {
          $exists: true,
        }
      }).toArray();

      const otherUsersWithProfitShareRequest = await collection.find({
        'paymentRequestProfitShare': {
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
              dateAndTime: product.dateAndTime,
              startedDateAndTime: product.startedDateAndTime
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
      }

      for (const otherUser of otherUsersWithSellerCreditRequest) {
        if (otherUser.paymentRequestForCredit && otherUser.paymentRequestForCredit[requestedStoreId]) {
          const storeIdRequests = otherUser.paymentRequestForCredit[requestedStoreId];
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
              dateAndTime: product.dateAndTime,
              lccAmount: product.lccAmount,
              startedDateAndTime: product.startedDateAndTime,
              paymentRequestedTimestampForCredit: product.paymentRequestedTimestampForCredit,
              f3LiveOfThisTimeCredit: product.f3LiveOfThisTimeCredit
            }));
            const creditRequestRequest = {
              totalF3: storeIdRequests[0].totalF3Amount,
              totalGc: storeIdRequests[0].totalGc,
              storeId: requestedStoreId,
              buyerWalletAddress: buyerWalletAddress,
              sellerWalletAddress: user.walletAddress,
              requestType: 'Credit',
              products: sellerProducts
            };
            response.requests.push(creditRequestRequest);
          }
        }
      }

      for (const otherUser of otherUsersWithResellersRewardRequest) {
        if (otherUser.paymentRequestResellersReward && otherUser.paymentRequestResellersReward[requestedStoreId]) {
          const storeIdRequests = otherUser.paymentRequestResellersReward[requestedStoreId];
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
              dateAndTime: product.dateAndTime,
              lccAmount: product.lccAmount,
              startedDateAndTime: product.startedDateAndTime,
              paymentRequestedTimestampForCredit: product.paymentRequestedTimestampForCredit,
              f3LiveOfThisTimeCredit: product.f3LiveOfThisTimeCredit
            }));
            const creditRequestRequest = {
              totalF3: storeIdRequests[0].totalF3Amount,
              totalGc: storeIdRequests[0].totalGc,
              storeId: requestedStoreId,
              buyerWalletAddress: buyerWalletAddress,
              sellerWalletAddress: user.walletAddress,
              requestType: 'Credit',
              products: sellerProducts
            };
            const simpleJson = [
              {
                "id": 1,
                "name": "John Doe",
                "email": "john.doe@example.com",
                "age": 25
              },
              {
                "id": 2,
                "name": "Jane Smith",
                "email": "jane.smith@example.com",
                "age": 30
              },
              {
                "id": 3,
                "name": "Emily Johnson",
                "email": "emily.johnson@example.com",
                "age": 22
              },
              {
                "id": 4,
                "name": "Michael Brown",
                "email": "michael.brown@example.com",
                "age": 35
              },
              {
                "id": 5,
                "name": "Sarah Davis",
                "email": "sarah.davis@example.com",
                "age": 28
              }
            ];
            const resellerRequest = {
              totalF3: storeIdRequests[0].f3ValueOfWithdraw,
              totalReceivableAmount: storeIdRequests[0].receivableAmount,
              providerWalletAddress: storeIdRequests[0].providerWalletAddress,
              sellerWalletAddress: storeIdRequests[0].providerWalletAddress,
              payingWalletAddress: storeIdRequests[0].payingWalletAddress,
              receivableAmount: storeIdRequests[0].receivableAmount,
              dateAndTime: storeIdRequests[0].dateAndTime,
              currencySymbol: storeIdRequests[0].currencySymbol,
              storeId: storeIdRequests[0].storeId,
              providerStoreId: storeIdRequests[0].providerStoreId,
              products: simpleJson,
              requestType: 'Resellers Reward'
            }
            response.requests.push(resellerRequest);
          }
        }
      }

      for (const otherUser of otherUsersWithProfitShareRequest) {
        if (otherUser.paymentRequestProfitShare && otherUser.paymentRequestProfitShare[requestedStoreId]) {
          const storeIdRequests = otherUser.paymentRequestProfitShare[requestedStoreId];
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
              dateAndTime: product.dateAndTime,
              lccAmount: product.lccAmount,
              startedDateAndTime: product.startedDateAndTime,
              paymentRequestedTimestampForCredit: product.paymentRequestedTimestampForCredit,
              f3LiveOfThisTimeCredit: product.f3LiveOfThisTimeCredit
            }));
            const creditRequestRequest = {
              totalF3: storeIdRequests[0].totalF3Amount,
              totalGc: storeIdRequests[0].totalGc,
              storeId: requestedStoreId,
              buyerWalletAddress: buyerWalletAddress,
              sellerWalletAddress: user.walletAddress,
              requestType: 'Credit',
              products: sellerProducts
            };
            const simpleJson = [
              {
                "id": 1,
                "name": "John Doe",
                "email": "john.doe@example.com",
                "age": 25
              },
              {
                "id": 2,
                "name": "Jane Smith",
                "email": "jane.smith@example.com",
                "age": 30
              },
              {
                "id": 3,
                "name": "Emily Johnson",
                "email": "emily.johnson@example.com",
                "age": 22
              },
              {
                "id": 4,
                "name": "Michael Brown",
                "email": "michael.brown@example.com",
                "age": 35
              },
              {
                "id": 5,
                "name": "Sarah Davis",
                "email": "sarah.davis@example.com",
                "age": 28
              }
            ];
            const resellerRequest = {
              totalF3: storeIdRequests[0].f3ValueOfWithdraw,
              totalReceivableAmount: storeIdRequests[0].receivableAmount,
              providerWalletAddress: storeIdRequests[0].providerWalletAddress,
              sellerWalletAddress: storeIdRequests[0].providerWalletAddress,
              payingWalletAddress: storeIdRequests[0].payingWalletAddress,
              buyerWalletAddress: storeIdRequests[0].payingWalletAddress,
              receivableAmount: storeIdRequests[0].receivableAmount,
              dateAndTime: storeIdRequests[0].dateAndTime,
              currencySymbol: storeIdRequests[0].currencySymbol,
              storeId: storeIdRequests[0].storeId,
              providerStoreId: storeIdRequests[0].providerStoreId,
              products: simpleJson,
              requestType: 'Profit Share'
            }
            response.requests.push(resellerRequest);
          }
        }
      }
    };


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
          startedDateAndTime: product.startedDateAndTime
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

    let sellerUsersMania = {};
    if (user.viewManiaCartPaymentRequest) {
      const storeIds = Object.keys(user.viewManiaCartPaymentRequest);
      for (const storeId of storeIds) {
        const sellerStore = user.viewManiaCartPaymentRequest[storeId][0].sellerId;
        const SellerUser = await collection.findOne({ storeId: sellerStore });
        sellerUsersMania[storeId] = SellerUser;
      }

      // Process buyer requests
      for (const storeId of storeIds) {
        const SellerUser = sellerUsersMania[storeId];
        const buyerProducts = user.viewManiaCartPaymentRequest[storeId].map(product => ({
          productId: product.productId,
          quantity: product.totalQuantity,
          totalPrice: product.totalPrice,
          totalF3: product.totalF3Amount,
          totalGc: product.totalGc,
          sellerWalletAddress: product.sellerWalletAddress,
          dateAndTime: product.dateAndTime,
          startedDateAndTime: product.startedDateAndTime
        }));

        const buyerRequest = {
          totalF3: user.viewManiaCartPaymentRequest[storeId][0].totalF3Amount,
          totalGc: user.viewManiaCartPaymentRequest[storeId][0].totalGc,
          storeId: user.viewManiaCartPaymentRequest[storeId][0].storeId,
          sellerWalletAddress: user.viewManiaCartPaymentRequest[storeId][0].sellerWalletAddress,
          buyerWalletAddress: user.walletAddress,
          requestType: 'View Mania Cart',
          products: buyerProducts
        };

        response.requests.push(buyerRequest);
      }
    }

    // if (user.paymentRequestResellersReward) {
    //   const walletAddresses = Object.keys(user.paymentRequestResellersReward);
    //   for (const walletAddress of walletAddresses) {

    //     const resellerRequest = {
    //       totalF3: user.paymentRequestResellersReward[walletAddress][0].f3ValueOfWithdraw,
    //       totalReceivableAmount: user.paymentRequestResellersReward[walletAddress][0].receivableAmount,
    //       providerWalletAddress: user.paymentRequestResellersReward[walletAddress][0].providerWalletAddress,
    //       payingWalletAddress: user.paymentRequestResellersReward[walletAddress][0].payingWalletAddress,
    //       receivableAmount: user.paymentRequestResellersReward[walletAddress][0].receivableAmount,          
    //       dateAndTime: user.paymentRequestResellersReward[walletAddress][0].dateAndTime,
    //       currencySymbol: user.paymentRequestResellersReward[walletAddress][0].currencySymbol,
    //       storeId : user.paymentRequestResellersReward[walletAddress][0].storeId,
    //       providerStoreId : user.paymentRequestResellersReward[walletAddress][0].providerStoreId,
    //       requestType : 'Resellers Reward'
    //     }
    //     response.requests.push(resellerRequest);
    //   }
    // }
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

    const userSeller = await collection.findOne({ storeId: sellerStoreId });

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

    const usersWithCreditApprovedRequest = await collection.find({
      'storeId': sellerStoreId, // Replace 'userType' with the actual field name distinguishing sellerUser
      'approvedpaymentRequestForCredit': {
        $exists: true,
      }
    }).toArray();


    const usersWithManiaApprovedRequest = await collection.find({
      'storeId': sellerStoreId, // Replace 'userType' with the actual field name distinguishing sellerUser
      'approvedPaymentRequestsManiaView': {
        $exists: true,
      }
    }).toArray();
    console.log('buyerOnes', usersWithBuyerApprovedRequest)
    console.log('Found users with approved requests:', usersWithApprovedRequests);

    const usersWithResellersApprovedRequest = await collection.find({
      'storeId': sellerStoreId, // Replace 'userType' with the actual field name distinguishing sellerUser
      'ApprovedPaymentRequestResellersReward': {
        $exists: true,
      }
    }).toArray();


    const usersWithProfitShareApprovedRequest = await collection.find({
      'storeId': sellerStoreId, // Replace 'userType' with the actual field name distinguishing sellerUser
      'approvedProfitSharePayments': {
        $exists: true,
      }
    }).toArray();

    // Extract approved payment requests from users
    const approvedRequests = usersWithApprovedRequests.reduce((acc, user) => {
      if (user.approvedPaymentRequestsSeller && user.approvedPaymentRequestsSeller[sellerStoreId]) {
        const buyerWalletAddress = user.walletAddress;
        const sellerWalletAddress = userSeller.walletAddress
        const storeRequests = user.approvedPaymentRequestsSeller[sellerStoreId];
        storeRequests.forEach(storeRequest => {
          // Add the requestType field directly to each store request object
          const requestWithRequestType = { buyerWalletAddress, sellerWalletAddress, requestType: 'seller', ...storeRequest, };
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



    response.requests.push(...approvedRequestsBuyers);

    const approvedRequestsMania = usersWithManiaApprovedRequest.reduce((acc, user) => {
      const buyerWalletAddress = user.walletAddress;
      const storeRequests = user.approvedPaymentRequestsManiaView;

      // Iterate over the keys of storeRequests object
      Object.keys(storeRequests).forEach(subRequestName => {
        const requestsArray = storeRequests[subRequestName];

        // Iterate over the array of requests for each subRequestName
        requestsArray.forEach(storeRequest => {
          const requestWithRequestType = { buyerWalletAddress, requestType: 'View Mania Cart', ...storeRequest };
          acc.push(requestWithRequestType);
        });
      });

      return acc;
    }, []);



    response.requests.push(...approvedRequestsMania);


    const approvedRequestsCredit = usersWithCreditApprovedRequest.reduce((acc, user) => {
      const buyerWalletAddress = user.walletAddress;
      const storeRequests = user.approvedpaymentRequestForCredit;
      const sellerWalletAddress = userSeller.walletAddress


      // Iterate over the keys of storeRequests object
      Object.keys(storeRequests).forEach(subRequestName => {
        const requestsArray = storeRequests[subRequestName];

        // Iterate over the array of requests for each subRequestName
        requestsArray.forEach(storeRequest => {
          const requestWithRequestType = { sellerWalletAddress, buyerWalletAddress, requestType: 'Credit', ...storeRequest };
          acc.push(requestWithRequestType);
        });
      });

      return acc;
    }, []);

    response.requests.push(...approvedRequestsCredit);

    const approvedRequestsResellersReward = usersWithResellersApprovedRequest.reduce((acc, user) => {
      const buyerWalletAddress = user.walletAddress;
      const storeRequests = user.ApprovedPaymentRequestResellersReward;

      // Iterate over the keys of storeRequests object
      Object.keys(storeRequests).forEach(subRequestName => {
        const requestsArray = storeRequests[subRequestName];

        // Iterate over the array of requests for each subRequestName
        requestsArray.forEach(storeRequest => {
          if (storeRequest.requestProducts && Array.isArray(storeRequest.requestProducts)) {
            storeRequest.requestProducts.forEach(product => {
              const providerWalletAddress = product.providerWalletAddress;
              const rewardAmount = product.f3ValueOfWithdraw;
              const usdAmountRR = product.receivableAmount;
              const txHashResellersReward = product.txhash;
              const dateAndTimeOfApproved = product.dateAndTimeOfApproved;
              console.log(product);

              const requestWithRequestType = {
                buyerWalletAddress,
                sellerWalletAddress: providerWalletAddress,
                requestType: 'Resellers Reward',
                providerWalletAddress,
                rewardAmount,
                usdAmountRR,
                txHashResellersReward,
                dateAndTimeOfApproved,
                ...storeRequest
              };
              acc.push(requestWithRequestType);
            });
          }
        });

      });

      return acc;
    }, []);

    response.requests.push(...approvedRequestsResellersReward);

    const approvedRequestsProfitShare = usersWithProfitShareApprovedRequest.reduce((acc, user) => {
      const buyerWalletAddress = user.walletAddress;
      const storeRequests = user.approvedProfitSharePayments;

      // Iterate over the keys of storeRequests object
      Object.keys(storeRequests).forEach(subRequestName => {
        const requestsArray = storeRequests[subRequestName];

        // Iterate over the array of requests for each subRequestName
        requestsArray.forEach(storeRequest => {
          if (storeRequest.requestProducts && Array.isArray(storeRequest.requestProducts)) {
            storeRequest.requestProducts.forEach(product => {
              const providerWalletAddress = product.providerWalletAddress;
              const rewardAmount = product.f3ValueOfWithdraw;
              const usdAmountRR = product.receivableAmount;
              const txHashResellersReward = product.txhash;
              const dateAndTimeOfApproved = product.dateAndTimeOfApproved;
              console.log(product);

              const requestWithRequestType = {
                buyerWalletAddress,
                sellerWalletAddress: providerWalletAddress,
                requestType: 'Profit Share',
                providerWalletAddress,
                rewardAmount,
                usdAmountRR,
                txHashResellersReward,
                dateAndTimeOfApproved,
                ...storeRequest
              };
              acc.push(requestWithRequestType);
            });
          }
        });

      });

      return acc;
    }, []);

    response.requests.push(...approvedRequestsProfitShare);

    console.log('buyersOne', usersWithBuyerApprovedRequest);

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

    const existingBuyerHistory = user.salesHistoryBuyer && user.salesHistoryBuyer[storeId] ? user.salesHistoryBuyer[storeId] : [];

    // Combine existing sales history with new requests
    const updatedBuyerHistory = [...existingBuyerHistory, ...storeRequestsArray];
    // Add the copied array to salesHistoryBuyer map
    const salesHistoryBuyerMap = {
      ...user.salesHistoryBuyer,
      [storeId]: updatedBuyerHistory
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
    if (user.approvalcheckoutBuyer && user.approvalcheckoutBuyer[storeId]) {
      await collection.updateOne(
        { walletAddress: buyerWalletAddress },
        {
          $unset: {
            [`approvalcheckoutBuyer.${storeId}`]: 1
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

    const existingSalesHistory = user.salesHistorySeller && user.salesHistorySeller[storeId] ? user.salesHistorySeller[storeId] : [];

    // Combine existing sales history with new requests
    const updatedSalesHistory = [...existingSalesHistory, ...storeRequestsArray];

    // Update salesHistorySeller map
    const salesHistorySellerMap = {
      ...user.salesHistorySeller,
      [storeId]: updatedSalesHistory
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
    if (user.approvalcheckoutBuyer && user.approvalcheckoutBuyer[storeId]) {
      const arrayToUpdate = user.approvalcheckout[storeId];
      const updatedArray = arrayToUpdate.map(item => {
        delete item.paymentRequestedBuyer;
        delete item.paymentRequestedTimestampBuyer;
        delete item.startedDateAndTime
          ;
        return item;
      });

      await collection.updateOne(
        { walletAddress: buyerWalletAddress },
        {
          $set: {
            [`approvalcheckoutBuyer.${storeId}`]: updatedArray
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
        delete item.startedDateAndTime
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
          const { productId, quantity, totalPrice, paymentRequestedTimestamp, totalF3Amount, totalGc, f3LiveOfThisTime,
            productName, startedPrice,
            f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected,
            description, totalsolds, storeId, offer, storeIdBuyer, walletAddressBuyer,
            flagWord, storeName, dateAndTime, images, dateOfApprovalCheckout } = saleshistory;

          // Fetch product details from MongoDB
          const productDetails = await db.collection('users').findOne({ 'productsbackup._id': productId }, { projection: { 'productsbackup.$': 1 } });

          // Add product details along with quantity, totalPrice, and storeId
          products.push({
            _id: productId,
            totalQuantity: quantity,
            totalPrice,
            paymentRequestedTimestamp,
            totalF3Amount,
            totalGc,
            f3LiveOfThisTime,
            productName,
            startedPrice,
            f3MarketPrice,
            growthContribution,
            numberOfStocks,
            unitItemSelected,
            description,
            totalsolds,
            storeId,
            productOffer: offer,
            storeIdBuyer: user.storeId,
            walletAddressBuyer: user.walletAddress,
            flagWord,
            storeName,
            dateAndTime: dateAndTime,
            images,
            dateOfApprovalCheckout
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

    // Check if the buyer has sales history
    const SalesHistoryMap = buyer.salesHistoryBuyer;
    console.log('Type of SalesHistoryMap:', typeof SalesHistoryMap);
    console.log('Sales History Map:', SalesHistoryMap);
    if (!SalesHistoryMap) {
      res.status(402).json({ error: 'Sales history not found for the buyer' });
      return;
    }

    // Prepare an array to store product details
    const products = [];

    // Count the total number of sellers with KYC status 'completed'
    let kycCompletedSellerCount = 0;
    const sellerIds = Object.keys(SalesHistoryMap);
    for (const sellerId of sellerIds) {
      const seller = await collection.findOne({ storeId: sellerId });
      if (seller && seller.kycStatusUser === 'accepted') {
        kycCompletedSellerCount++;
      }
    }

    // Determine the KYC status of the buyer
    const kycOfBuyer = buyer.kycStatusUser ?? "incomplete";

    // Iterate over each store's sales history
    for (const sellerId in SalesHistoryMap) {
      const sellerSalesHistoryArray = SalesHistoryMap[sellerId];

      // Iterate over each sales history entry in the seller's array
      for (const salesHistory of sellerSalesHistoryArray) {
        const { productId, quantity, totalPrice, paymentRequestedTimestampBuyer, totalF3Amount, totalGc, f3LiveOfThisTime,
          productName, startedPrice, f3MarketPrice, growthContribution, numberOfStocks, unitItemSelected,
          description, totalsolds, storeId, offer, storeIdBuyer, walletAddressBuyer,
          flagWord, storeName, images, dateOfApprovalCheckout } = salesHistory;

        // Fetch product details from MongoDB
        const productDetails = await db.collection('users').findOne(
          { 'productsbackup._id': productId },
          { projection: { 'productsbackup.$': 1 } }
        );

        // Add product details along with the new fields
        products.push({
          _id: productId,
          totalQuantity: quantity,
          totalPrice,
          paymentRequestedTimestampBuyer,
          totalF3Amount,
          totalGc,
          f3LiveOfThisTime,
          productName,
          startedPrice,
          f3MarketPrice,
          growthContribution,
          numberOfStocks,
          unitItemSelected,
          description,
          totalsolds,
          storeId,
          productOffer: offer,
          flagWord,
          storeName,
          images,
          dateOfApprovalCheckout,
          kycOfAllSellers: kycCompletedSellerCount,
          kycOfBuyer
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

app.get('/refillStocksProducts', async (req, res) => {
  try {
    const { storeId, productId, newStocks } = req.query;

    // Check if required parameters are missing
    if (!storeId || !productId || !newStocks) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by storeId
    const existingUser = await collection.findOne({ storeId });

    if (!existingUser) {
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }

    // Find the product by productId within the user's products
    const existingProduct = existingUser.products.find(product => product._id === productId);
    const existingProductBackup = existingUser.productsbackup.find(product => product._id === productId);

    if (!existingProduct) {
      res.status(404).json({ error: `Product ${productId} not found in store` });
      return;
    }

    // Update the product's stocks field
    existingProduct.numberOfStocks = newStocks;
    existingProductBackup.numberOfStocks = newStocks;

    // Update the product in the database
    await collection.updateOne(
      { storeId, 'products._id': productId },
      { $set: { 'products.$.numberOfStocks': newStocks } }
    );

    await collection.updateOne(
      { storeId, 'productsbackup._id': productId },
      { $set: { 'productsbackup.$.numberOfStocks': newStocks } }
    );
    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Product stock updated successfully' });
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({ error: 'An error occurred while updating product stock' });
  }
});

app.get('/deleteProductOfUser', async (req, res) => {
  try {
    const { storeId, productId } = req.query;

    // Check if required parameters are missing
    if (!storeId || !productId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by storeId
    const existingUser = await collection.findOne({ storeId });

    if (!existingUser) {
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }

    // Find the index of the product by productId within the user's products
    const productIndex = existingUser.products.findIndex(product => product._id === productId);

    if (productIndex === -1) {
      res.status(404).json({ error: `Product ${productId} not found in store` });
      return;
    }

    // Remove the product from the array
    existingUser.products.splice(productIndex, 1);

    // // Update the user document in the database
    await collection.updateOne(
      { storeId },
      { $set: { products: existingUser.products } }
    );

    if (productId) {
      await collection.updateMany(
        { [`userCarts.${productId}`]: { $exists: true } },
        { $unset: { [`userCarts.${productId}`]: "" } }
      );
      const aggregationPipeline = [
        { $match: { 'userCartsProductsDetails': { $exists: true } } },
        { $project: { userCartsProductsArray: { $objectToArray: '$userCartsProductsDetails' } } },
        { $match: { 'userCartsProductsArray.v._id': productId } }
      ];

      const usersWithProduct = await collection.aggregate(aggregationPipeline).toArray();

      console.log(usersWithProduct)

      // Iterate through each user and delete the product from userCartsProductsDetails
      // Iterate through each user and delete the product from userCartsProductsDetails
      for (const user of usersWithProduct) {
        const userId = user._id;
        const existingUserDeleteFor = await collection.findOne({ _id: userId });
        const storeDe = await collection.findOne({ storeId: existingUserDeleteFor.storeId });
        const userStoreId = existingUserDeleteFor.storeId
        console.log(userId)
        //console.log(existingUserDeleteFor)
        //console.log('funsStore', storeDe)
        console.log('storeDirect', existingUserDeleteFor.storeId)
        //Check if the product exists in userCartsProductsDetails for this user
        if (storeDe.userCartsProductsDetails) {
          for (const key in storeDe.userCartsProductsDetails) {
            if (storeDe.userCartsProductsDetails.hasOwnProperty(key)) {
              const productDetail = storeDe.userCartsProductsDetails[key];
              console.log(productDetail);
              if (productDetail._id === productId) {
                delete storeDe.userCartsProductsDetails[key];
                console.log('yes', productId,)
              }
            }
          }
        }
        await collection.updateOne(
          { storeId: userStoreId },
          { $set: { userCartsProductsDetails: storeDe.userCartsProductsDetails } }
        );
      }
    }

    if (productId) {
      await collection.updateMany(
        { [`checkoutapproval.${storeId}`]: { $exists: true } },
        { $pull: { [`checkoutapproval.${storeId}`]: { productId } } }
      );
    }

    if (productId) {
      // await collection.updateMany(
      //   { [`approvalcheckout.${storeId}`]: { $exists: true } },
      //   { $pull: { [`approvalcheckout.${storeId}`]: { productId } } }
      // );
    }
    if (productId) {
      // await collection.updateMany(
      //   { [`approvalcheckoutBuyer.${storeId}`]: { $exists: true } },
      //   { $pull: { [`approvalcheckoutBuyer.${storeId}`]: { productId } } }
      // );
    }
    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'An error occurred while deleting product' });
  }
});

app.get('/updateOfferProduct', async (req, res) => {
  try {
    const { storeId, productId, newOffer } = req.query;

    // Check if required parameters are missing
    if (!storeId || !productId || !newOffer) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by storeId
    const existingUser = await collection.findOne({ storeId });

    if (!existingUser) {
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }

    // Find the product by productId within the user's products
    const existingProduct = existingUser.products.find(product => product._id === productId);
    const existingProductBackup = existingUser.productsbackup.find(product => product._id === productId);

    if (!existingProduct) {
      res.status(404).json({ error: `Product ${productId} not found in store` });
      return;
    }

    // Update the product's stocks field
    existingProduct.offer = newOffer;
    existingProductBackup.offer = newOffer;

    // Update the product in the database
    await collection.updateOne(
      { storeId, 'products._id': productId },
      { $set: { 'products.$.offer': newOffer } }
    );
    await collection.updateOne(
      { storeId, 'productsbackup._id': productId },
      { $set: { 'productsbackup.$.offer': newOffer } }
    );

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Product offer updated successfully' });
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({ error: 'An error occurred while updating product stock' });
  }
});

app.get('/updateResellersRewardProduct', async (req, res) => {
  try {
    const { storeId, productId, newRR } = req.query;

    // Check if required parameters are missing
    if (!storeId || !productId || !newRR) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by storeId
    const existingUser = await collection.findOne({ storeId });

    if (!existingUser) {
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }

    // Find the product by productId within the user's products
    const existingProduct = existingUser.products.find(product => product._id === productId);
    const existingProductBackup = existingUser.productsbackup.find(product => product._id === productId);

    if (!existingProduct) {
      res.status(404).json({ error: `Product ${productId} not found in store` });
      return;
    }

    // Update the product's RR field
    existingProduct.resellers_reward = newRR;
    existingProductBackup.resellers_reward = newRR;

    // Update the product in the database
    await collection.updateOne(
      { storeId, 'products._id': productId },
      { $set: { 'products.$.resellers_reward': newRR } }
    );
    await collection.updateOne(
      { storeId, 'productsbackup._id': productId },
      { $set: { 'productsbackup.$.resellers_reward': newRR } }
    );

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Product Reward updated successfully' });
  } catch (error) {
    console.error('Error updating product Reward:', error);
    res.status(500).json({ error: 'An error occurred while updating product Reward' });
  }
});

app.post('/updateProductDatas', async (req, res) => {
  const { storeId, productId, productName, productDescription, startedPrice, unitItem, imagesBase64 } = req.body;

  console.log('images', imagesBase64)
  // Check if required parameters are missing
  if (!storeId || !productId) {
    console.log(storeId, productId)
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const existingProduct = await collection.findOne({ 'products._id': productId }, { projection: { 'products.$': 1 } });

    if (!existingProduct) {
      res.status(404).json({ error: `Product ${productId} not found in store` });
      return;
    }

    if (productName) {
      existingProduct.products[0].productName = productName;
      await collection.updateOne({ 'products._id': productId }, { $set: { 'products.$.productName': productName } });
      await collection.updateOne({ 'productsbackup._id': productId }, { $set: { 'productsbackup.$.productName': productName } });
    }

    if (productDescription) {
      existingProduct.products[0].description = productDescription;
      await collection.updateOne({ 'products._id': productId }, { $set: { 'products.$.description': productDescription } });
      await collection.updateOne({ 'productsbackup._id': productId }, { $set: { 'productsbackup.$.description': productDescription } });
    }

    if (startedPrice) {
      existingProduct.products[0].startedPrice = startedPrice;
      await collection.updateOne({ 'products._id': productId }, { $set: { 'products.$.startedPrice': startedPrice } });
      await collection.updateOne({ 'productsbackup._id': productId }, { $set: { 'productsbackup.$.startedPrice': startedPrice } });
    }

    if (unitItem) {
      existingProduct.products[0].unitItemSelected = unitItem;
      await collection.updateOne({ 'products._id': productId }, { $set: { 'products.$.unitItemSelected': unitItem } });
      await collection.updateOne({ 'productsbackup._id': productId }, { $set: { 'productsbackup.$.unitItemSelected': unitItem } });
    }

    if (imagesBase64) {
      const compressedImages = await Promise.all(imagesBase64.map(async (image) => {
        // Resize and compress image using sharp
        compressedBuffer = await sharp(Buffer.from(image, 'base64'))
          .resize({ width: 150 }) // Set desired width (you can adjust this as needed)
          .png({ quality: 25 }) // Set desired PNG quality (you can adjust this as needed)
          .toBuffer();

        return compressedBuffer.toString('base64');
      }));

      // Update the product's images in the MongoDB collection
      await collection.updateOne(
        { 'products._id': productId },
        { $set: { 'products.$.images': compressedImages } }
      );
      await collection.updateOne(
        { 'productsbackup._id': productId },
        { $set: { 'productsbackup.$.images': compressedImages } }
      );
    }


    client.close();

    res.status(200).json({ message: 'Product data updated successfully' });

  } catch (error) {
    console.error('Error updating product data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/viewCartManiaRequest', async (req, res) => {
  try {
    const { storeId, sellerId, paymentRequestedTimestamp, totalF3Amount, totalGc, f3LiveOfThisTime, productDetails } = req.body;

    console.log('Request received:', storeId, sellerId, paymentRequestedTimestamp, totalF3Amount, totalGc, productDetails, f3LiveOfThisTime);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const user = await collection.findOne({ storeId });

    if (!user) {
      console.log(`User with storeId ${storeId} not found`);
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }

    const viewManiaCartPaymentRequest = user.viewManiaCartPaymentRequest || {}; // Initialize map if not exist

    if (viewManiaCartPaymentRequest[sellerId] && viewManiaCartPaymentRequest[sellerId].length > 0) {
      console.log(`Products already requested for sellerId ${sellerId}`);
      res.status(405).json({ error: `Products already requested for sellerId ${sellerId}` });
      return;
    }

    for (const product of productDetails) {
      const productId = product.productId;

      let productDetail;
      for (const key in user.userCartsProductsDetails) {
        if (user.userCartsProductsDetails.hasOwnProperty(key)) {
          const productFromUserCart = user.userCartsProductsDetails[key];
          if (productFromUserCart._id === productId) {
            productDetail = {
              ...productFromUserCart,
              productId: productId,
              totalQuantity: product.totalQuantity,
              quantity: product.totalQuantity,
              totalPrice: product.totalAmount,
              startedDateAndTime: paymentRequestedTimestamp,
              totalF3Amount: totalF3Amount,
              totalGc: totalGc,

              f3LiveOfThisTime: f3LiveOfThisTime
            };
            break;
          }
        }
      }

      if (productDetail) {
        if (!viewManiaCartPaymentRequest[sellerId]) {
          viewManiaCartPaymentRequest[sellerId] = [];
        }
        viewManiaCartPaymentRequest[sellerId].push(productDetail);
      }
    }

    await collection.updateOne(
      { storeId },
      { $set: { viewManiaCartPaymentRequest } }
    );

    // Close MongoDB connection
    await client.close();

    console.log(`Product details updated successfully for storeId ${storeId}`);

    // Send response
    res.status(200).json({ message: 'Product details updated successfully' });
  } catch (error) {
    console.error('Error updating product details:', error);
    res.status(500).json({ error: 'An error occurred while updating product details' });
  }
});

app.get('/deleteUnApprovedManiaRequest', async (req, res) => {
  try {
    const { buyerWalletAddress, storeId } = req.query;

    console.log('Deleting mania request for buyerWalletAddress:', buyerWalletAddress, 'and storeId:', storeId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user with the specified buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with walletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerWalletAddress} not found` });
    }

    // Find the viewManiaCartPaymentRequest map in the user document
    const viewManiaCartPaymentRequest = user.viewManiaCartPaymentRequest || {};
    const storeRequestsArray = viewManiaCartPaymentRequest[storeId] || [];

    // Extract product IDs from the existing requests
    const productIds = storeRequestsArray.map(product => product._id);

    productIds.forEach(productId => {
      if (!user.userCarts[productId]) {
        res.status(404).json({ error: `Product ${productId} not found in the cart` });
        return;
      }
      delete user.userCarts[productId];

      // Delete the product with the matching _id from userCartsProductsDetails
      for (const key in user.userCartsProductsDetails) {
        if (user.userCartsProductsDetails.hasOwnProperty(key)) {
          const productDetail = user.userCartsProductsDetails[key];
          if (productDetail._id === productId) {
            delete user.userCartsProductsDetails[key];
          }
        }
      }
    });

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      { $set: { userCarts: user.userCarts, userCartsProductsDetails: user.userCartsProductsDetails } }
    );


    // Delete the store request from viewManiaCartPaymentRequest
    delete viewManiaCartPaymentRequest[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      { $set: { viewManiaCartPaymentRequest } }
    );


    // Close MongoDB connection
    await client.close();

    console.log(`Mania request deleted ${buyerWalletAddress}`);

    // Send success response with extracted product IDs
    res.status(200).json({ message: 'Mania request deleted', productIds });
  } catch (error) {
    console.error('Error deleting Mania request and adding to sales history:', error);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

app.get('/deleteRequestAndAddApprovalCheckout', async (req, res) => {
  const { buyerWalletAddress, storeId, txhash, dataAndTime } = req.query;

  try {
    console.log('Deleting request and adding to approval checkout for buyerWalletAddress:', buyerWalletAddress, 'storeId:', storeId);

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user with the specified buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with walletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${buyerWalletAddress} not found` });
    }

    // Find the viewManiaCartPaymentRequest map in the user document
    const viewManiaCartPaymentRequest = user.viewManiaCartPaymentRequest || {};
    const storeRequestsArray = viewManiaCartPaymentRequest[storeId] || [];

    if (!storeRequestsArray || storeRequestsArray.length === 0) {
      console.log('No request found for deletion');
      return res.status(404).json({ error: 'No request found for deletion' });
    }

    // Copy the array of requests from viewManiaCartPaymentRequest
    const copiedRequestsArray = [...storeRequestsArray];

    const copiedRequestsArrayForApproval = storeRequestsArray.map(product => {
      const { sellerWalletAddress, startedDateAndTime, totalF3Amount, totalGc, f3LiveOfThisTime, dateAndTime, txhashSeller, ...rest } = product;
      return { ...rest, storeIdBuyer: user.storeId };
    });

    const copiedRequestsArrayForApprovalBuyer = storeRequestsArray.map(product => {
      const { sellerWalletAddress, startedDateAndTime, totalF3Amount, totalGc, f3LiveOfThisTime, dateAndTime, txhashSeller, ...rest } = product;
      return rest;
    });

    // Add copied array to approval checkout maps (buyer and seller)
    user.approvalcheckout = user.approvalcheckout || {};
    user.approvalcheckoutBuyer = user.approvalcheckoutBuyer || {};
    if (copiedRequestsArrayForApprovalBuyer.length > 0) {
      if (!user.approvalcheckoutBuyer[storeId]) {
        user.approvalcheckoutBuyer[storeId] = [];
      }
      user.approvalcheckoutBuyer[storeId] = [...user.approvalcheckoutBuyer[storeId], ...copiedRequestsArrayForApprovalBuyer];
    }

    if (copiedRequestsArrayForApproval.length > 0) {
      if (!user.approvalcheckout[storeId]) {
        user.approvalcheckout[storeId] = [];
      }
      user.approvalcheckout[storeId] = [...user.approvalcheckout[storeId], ...copiedRequestsArrayForApproval];
    }


    // Add copied array to approvedViewManiaCartRequest map
    user.approvedViewManiaCartRequest = user.approvedViewManiaCartRequest || {};
    user.approvedViewManiaCartRequest[storeId] = copiedRequestsArray;
    user.approvedPaymentRequestsManiaView = user.approvedPaymentRequestsManiaView || {};
    user.approvedPaymentRequestsManiaView[storeId] = {};

    // Populate the requestProducts array in approvedPaymentRequestsManiaView
    user.approvedPaymentRequestsManiaView = user.approvedPaymentRequestsManiaView || {};
    copiedRequestsArray.forEach(request => {
      request.dateAndTime = dataAndTime;
      request.txhashSeller = txhash;
    });

    // Create a copy of storeIdRequests for approvedRequestsSellers
    const newRequestObject = {
      'requestProducts': [...copiedRequestsArray]
    };

    if (!Array.isArray(user.approvedPaymentRequestsManiaView[storeId])) {
      user.approvedPaymentRequestsManiaView[storeId] = [newRequestObject]
    } else {
      user.approvedPaymentRequestsManiaView[storeId].push(newRequestObject);
    }
    // Extract product IDs from the existing requests
    const productIds = storeRequestsArray.map(product => product._id);

    for (const productId of productIds) {
      const existingProduct = await collection.findOne({ 'products._id': productId });
      if (existingProduct) {
        const product = existingProduct.products[0]; // Access the first element of the products array
        const quantity = storeRequestsArray.find(product => product._id === productId).totalQuantity;
        const newStocks = Number(product.numberOfStocks) - Number(quantity);
        const newTotalSolds = parseInt(product.totalsolds) + parseInt(quantity);
        console.log(newStocks, newTotalSolds, quantity);
        console.log(product.numberOfStocks, product.totalsolds)
        await collection.updateOne(
          { 'products._id': productId },
          { $set: { 'products.$.numberOfStocks': newStocks.toString(), 'products.$.totalsolds': newTotalSolds.toString() } }
        );
      }
    }


    productIds.forEach(productId => {
      if (!user.userCarts[productId]) {
        res.status(404).json({ error: `Product ${productId} not found in the cart` });
        return;
      }
      delete user.userCarts[productId];

      // Delete the product with the matching _id from userCartsProductsDetails
      for (const key in user.userCartsProductsDetails) {
        if (user.userCartsProductsDetails.hasOwnProperty(key)) {
          const productDetail = user.userCartsProductsDetails[key];
          if (productDetail._id === productId) {
            delete user.userCartsProductsDetails[key];
          }
        }
      }
    });

    // Delete the store request from viewManiaCartPaymentRequest
    delete viewManiaCartPaymentRequest[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      { $set: { viewManiaCartPaymentRequest, userCarts: user.userCarts, approvalcheckout: user.approvalcheckout, approvalcheckoutBuyer: user.approvalcheckoutBuyer, approvedPaymentRequestsManiaView: user.approvedPaymentRequestsManiaView, userCartsProductsDetails: user.userCartsProductsDetails } }
    );
    // Close MongoDB connection
    await client.close();

    console.log(`Request deleted and added to approval checkout successfully for walletAddress ${buyerWalletAddress}`);

    // Send success response with extracted product IDs
    res.status(200).json({ message: 'Request deleted and added to approval checkout successfully', productIds });
  } catch (error) {
    console.error('Error deleting request and adding to approval checkout:', error);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

app.get('/requestForCredit', async (req, res) => {

  try {
    const { storeId, sellerId, paymentRequestedTimestamp, totalF3Amount, f3LiveOfThisTime, lccAmount } = req.query;

    console.log('Request received for credit:', storeId, sellerId, paymentRequestedTimestamp, totalF3Amount);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    const user = await collection.findOne({ storeId });

    if (!user) {
      console.log(`User with storeId ${storeId} not found`);
      res.status(404).json({ error: `User with storeId ${storeId} not found` });
      return;
    }


    const salesHistoryArray = user.salesHistoryBuyer[sellerId];
    //const sellerArrayReq = user.paymentRequestSeller[sellerId];

    const isAlreadyRequested = salesHistoryArray.some((sellerObject) => {
      return sellerObject.paymentRequestedForCredit === 'Yes'
    });

    console.log(salesHistoryArray);
    if (isAlreadyRequested) {
      salesHistoryArray.forEach((sellerObject) => {
        if (sellerObject.paymentRequestedForCredit === 'Yes') {
          sellerObject.paymentRequestedTimestampForCredit = paymentRequestedTimestamp;
          sellerObject.f3LiveOfThisTimeOfCreditTime = f3LiveOfThisTime;
        }
      });

      if (user.paymentRequestForCredit) {
        if (user.paymentRequestForCredit[sellerId]) {
          const sellerArrayReq = user.paymentRequestForCredit[sellerId];
          sellerArrayReq.forEach((sellerObjectRequest) => {
            if (sellerObjectRequest.paymentRequestedTimestampForCredit) {
              sellerObjectRequest.paymentRequestedTimestampForCredit = paymentRequestedTimestamp
            }

          });
          await collection.updateOne({ storeId }, { $set: { [`paymentRequestForCredit.${sellerId}`]: sellerArrayReq } });
        } else {

        }
      }

      await collection.updateOne({ storeId }, { $set: { [`salesHistoryBuyer.${sellerId}`]: salesHistoryArray } });

      console.log(`Payment requested timestamp updated successfully for sellerId ${sellerId}`);

      res.status(405).json({ error: `Payment has already been requested for sellerId ${sellerId}` });
      return;
    }

    if (typeof user.paymentRequestForCredit === 'undefined') {
      user.paymentRequestForCredit = {};
    }

    salesHistoryArray.forEach((sellerObject) => {
      if (!sellerObject.paymentRequestedForCredit && !sellerObject.paymentRequestedTimestampForCredit) {
        sellerObject.paymentRequestedForCredit = 'Yes';
        sellerObject.paymentRequestedTimestampForCredit = paymentRequestedTimestamp;
        sellerObject.f3AmountOfCredit = totalF3Amount;
        sellerObject.f3LivePriceOfCreditTime = f3LiveOfThisTime
      } else if (sellerObject.paymentRequested === 'Yes') {
        sellerObject.paymentRequestedTimestampForCredit = paymentRequestedTimestamp;
      }
    });

    const copiedRequestArray = salesHistoryArray.map((sellerObject) => {
      const { paymentRequested, paymentRequestedTimestamp, paymentRequestedBuyer, paymentRequestedTimestampBuyer, ...rest } = sellerObject;
      return { ...rest, totalF3Amount, f3LiveOfThisTimeCredit: f3LiveOfThisTime, lccAmount: lccAmount };
    });

    user.paymentRequestForCredit[sellerId] = copiedRequestArray;


    await collection.updateOne(
      { storeId },
      { $set: { [`salesHistoryBuyer.${sellerId}`]: salesHistoryArray, paymentRequestForCredit: user.paymentRequestForCredit } }
    );

    const seller = await collection.findOne({ storeId: sellerId });
    const sellerOneSignalIdMap = seller.OneSignalId;


    // Close MongoDB connection
    await client.close();

    console.log(`Payment requested flag updated successfully for all sellers in storeId ${storeId}`);

    // Send response
    res.status(200).json({ message: sellerOneSignalIdMap });
  } catch (error) {
    console.error('Error updating payment requested flag:', error);
    res.status(500).json({ error: 'An error occurred while updating payment requested flag' });
  }

});

app.get('/deleteCreditRequestAndAddApproved', async (req, res) => {
  try {
    const { buyerWalletAddress, storeId, txhashCredit, dateAndTime, creditAmountInF3 } = req.query;

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

    const salesHistoryArray = user.salesHistoryBuyer[storeId];

    const isAlreadyRequested = salesHistoryArray.some((sellerObject) => {
      return sellerObject.paymentRequestedForCredit === 'Yes';
    });

    if (isAlreadyRequested) {
      salesHistoryArray.forEach((sellerObject) => {
        delete sellerObject.paymentRequestedForCredit;
      });
    }


    const paymentRequestCreditMap = user.paymentRequestForCredit || {};
    const storeRequestsArray = paymentRequestCreditMap[storeId] || [];

    storeRequestsArray.forEach(requests => {
      requests.creditTxHash = txhashCredit;
      requests.dateAndTime = dateAndTime;
      requests.creditAmountInF3 = creditAmountInF3;
      requests.totalF3Amount = creditAmountInF3
    })

    const newRequestObject = {
      'requestProducts': [...storeRequestsArray]
    };

    if (!user.approvedpaymentRequestForCredit) {
      user.approvedpaymentRequestForCredit = {};
    }


    if (!Array.isArray(user.approvedpaymentRequestForCredit[storeId])) {
      console.log(`Creating new approvedPaymentRequestsCredit array for sellerStoreId ${storeId}`);
      user.approvedpaymentRequestForCredit[storeId] = [newRequestObject];
    } else {
      console.log(`Adding new request to existing approvedPaymentRequestsCredit array for sellerStoreId ${storeId}`);
      user.approvedpaymentRequestForCredit[storeId].push(newRequestObject);
    }

    // Save the updated user data
    await collection.updateOne({ walletAddress: buyerWalletAddress }, { $set: user });

    // Delete the array from paymentRequestBuyer map
    delete paymentRequestCreditMap[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      {
        $set: {
          paymentRequestForCredit: paymentRequestCreditMap,
        }
      }
    );


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

app.get('/getConfirmIfRequestExisting', async (req, res) => {
  try {
    const { walletAddress } = req.query;

    console.log('Request received:', walletAddress);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by walletAddress
    const user = await collection.findOne({ walletAddress });
    const sellerId = user.storeId;
    const usersWithApprovalsCheckout = await collection.find({ 'approvalcheckout': { $exists: true } }).toArray();
    const approvalCheckoutMap = user.approvalcheckoutBuyer;
    const usdRateUser = parseFloat(user.usdtRate);
    console.log('usdRate', usdRateUser);

    if (!user) {
      console.log(`User with walletAddress ${walletAddress} not found`);
      return res.status(404).json({ error: `User with walletAddress ${walletAddress} not found` });
    }

    const response = {
      requestsExistForCredit: "No",
      requestsExistForApprovedSeller: "No",
      requestsExistForApprovedBuyer: "No",
    };

    // Check if paymentRequestSeller object exists and contains non-empty arrays
    if (!user.paymentRequestForCredit) {
      const storeId = user.storeId;

      console.log(storeId);

      const otherUsersWithSellerCreditRequest = await collection.find({
        'paymentRequestForCredit': {
          $exists: true,
        }
      }).toArray();

      const requestedStoreId = user.storeId; // Assuming user is the current user

      console.log('Requested StoreId:', requestedStoreId);

      for (const otherUser of otherUsersWithSellerCreditRequest) {
        if (otherUser.paymentRequestForCredit && otherUser.paymentRequestForCredit[requestedStoreId] && otherUser.paymentRequestForCredit[requestedStoreId].length > 0) {
          response.requestsExistForCredit = "Yes"; // If any non-empty arrays exist, set the response to "Yes"
          break; // Break the loop as we only need to know if non-empty arrays exist or not
        }
      }
    } else {
      const storeId = user.storeId;

      console.log(storeId);

      const otherUsersWithSellerCreditRequest = await collection.find({
        'paymentRequestForCredit': {
          $exists: true,
        }
      }).toArray();

      const requestedStoreId = user.storeId; // Assuming user is the current user

      console.log('Requested StoreId:', requestedStoreId);

      for (const otherUser of otherUsersWithSellerCreditRequest) {
        if (otherUser.paymentRequestForCredit && otherUser.paymentRequestForCredit[requestedStoreId] && otherUser.paymentRequestForCredit[requestedStoreId].length > 0) {
          response.requestsExistForCredit = "Yes"; // If any non-empty arrays exist, set the response to "Yes"
          break; // Break the loop as we only need to know if non-empty arrays exist or not
        }
      }
    };

    for (const user of usersWithApprovalsCheckout) {
      //console.log('User:', user);

      if (user.approvalcheckout[sellerId]) {
        const sellerApprovalsCheckoutArray = user.approvalcheckout[sellerId];
        const usdRate = parseFloat(user.usdtRate);
        console.log(usdRate);
        //console.log('Approvals Checkout for Seller:', sellerApprovalsCheckoutArray);

        let totalUsdRate = 0;
        for (const approvalcheckout of sellerApprovalsCheckoutArray) {
          const { totalPrice } = approvalcheckout;
          const totalPriceNum = parseFloat(totalPrice.replace(/[^\d.]/g, ''));

          const totalusdproduct = totalPriceNum / usdRate;
          totalUsdRate += totalusdproduct;
          console.log(totalusdproduct, totalUsdRate, totalPriceNum);
          console.log('totalPriceNum', totalPriceNum);
        }
        console.log(totalUsdRate)
        // Check if total USD rate for seller is more than 10.00
        if (totalUsdRate > 10.00) {
          response.requestsExistForApprovedSeller = "Yes";
        }
      }
    }

    if (approvalCheckoutMap) {
      console.log(usdRateUser);
      for (const sellerId in approvalCheckoutMap) {
        const sellerCheckoutApprovalsArray = approvalCheckoutMap[sellerId];

        let totalUSDRate = 0;
        // Iterate over each checkout approval in the seller's array
        for (const approvalcheckout of sellerCheckoutApprovalsArray) {
          const { totalPrice } = approvalcheckout;
          console.log(totalPrice);
          const totalPriceProduct = parseFloat(totalPrice.replace(/[^\d.]/g, ''));

          const calculation = totalPriceProduct / usdRateUser;
          totalUSDRate += calculation;
          console.log(calculation, totalUSDRate, totalPriceProduct)
        }
        console.log(totalUSDRate)
        if (totalUSDRate > 10.00) {
          response.requestsExistForApprovedBuyer = "Yes";
        }
      }
    };

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

app.get('/resetPasswordEmailExist', async (req, res) => {
  try {
    const { email } = req.query;

    console.log('Request received:', email);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found`);
      return res.status(405).json({ error: `User with email ${email} not found` });
    }

    console.log(`User with email ${email} exists`);

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ exists: "Yes" });
  } catch (error) {
    console.error('Error checking user existence:', error);
    res.status(500).json({ error: 'An error occurred while checking user existence' });
  }
});

app.get('/resetPassword', async (req, res) => {
  try {
    const { email, newPassword } = req.query;

    console.log('Request received:', email, newPassword);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found`);
      return res.status(405).json({ error: `User with email ${email} not found` });
    }

    // Update the password
    if (newPassword) {
      await collection.updateOne(
        { email },
        { $set: { password: newPassword } }
      );
    }

    console.log(`Password updated successfully for user with email ${email}`);

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'An error occurred while updating password' });
  }
});

app.get('/saveOneSignalId', async (req, res) => {
  try {
    const { email, onesignalId } = req.query;

    console.log('Request received:', email, onesignalId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (user) {
      // User exists, update OneSignalId field
      let updatedOneSignalIdMap = {};
      if (user.OneSignalId) {
        updatedOneSignalIdMap = { ...user.OneSignalId }; // Clone the existing map
      }
      if (onesignalId && !updatedOneSignalIdMap[onesignalId]) {
        updatedOneSignalIdMap[onesignalId] = true; // Add the new ID to the map
      }

      await collection.updateOne(
        { email },
        { $set: { OneSignalId: updatedOneSignalIdMap } }
      );

      console.log(`OneSignal ID updated successfully for user with email ${email}`);
    } else {
      // User does not exist, create a new document
      await collection.insertOne({ email, OneSignalId: { [onesignalId]: true } }); // Initialize the map with the new ID
      console.log(`New user with email ${email} created with OneSignal ID`);
    }

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'OneSignal ID saved successfully' });
  } catch (error) {
    console.error('Error saving OneSignal ID:', error);
    res.status(500).json({ error: 'An error occurred while saving OneSignal ID' });
  }
});

app.get('/deleteOneSignalIdOfLogout', async (req, res) => {
  try {
    const { email, onesignalId } = req.query;

    console.log('Request received:', email, onesignalId);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (user && user.OneSignalId && user.OneSignalId[onesignalId]) {
      // User exists, and the OneSignalId exists, delete the OneSignalId from the map
      delete user.OneSignalId[onesignalId];

      await collection.updateOne(
        { email },
        { $set: { OneSignalId: user.OneSignalId } } // Update the document with the modified OneSignalId
      );

      console.log(`OneSignal ID ${onesignalId} deleted successfully for user with email ${email}`);
      res.status(200).json({ message: `OneSignal ID ${onesignalId} deleted successfully` });
    } else {
      console.log(`OneSignal ID ${onesignalId} not found for user with email ${email}`);
      res.status(404).json({ error: `OneSignal ID ${onesignalId} not found` });
    }

    // Close MongoDB connection
    await client.close();
  } catch (error) {
    console.error('Error deleting OneSignal ID:', error);
    res.status(500).json({ error: 'An error occurred while deleting OneSignal ID' });
  }
});

app.get('/createapplicantonfido', async (req, res) => {
  const { firstName, lastName, walletAddress, email, countryalpha, fullName } = req.query;

  try {
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();

    // Access the appropriate database and collection
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Check if the email already exists
    const existingUser = await collection.findOne({ email });
    const existingUserWallet = await collection.findOne({ walletAddress });
    const existingUserName = await collection.findOne({ fullName: fullName })
    if (existingUser) {
      // Close the MongoDB connection
      await client.close();
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    if (existingUserWallet) {
      await client.close();
      return res.status(401).json({ error: 'User with this wallet already' })
    }

    if (existingUserName) {
      await client.close();
      return res.status(402).json({ error: 'User with this Name already' })
    }
    const response = await axios.post('https://api.onfido.com/v3.6/applicants', {
      first_name: firstName,
      last_name: lastName,
      issuing_country: countryalpha
    }, {
      headers: {
        Authorization: `Token token=api_sandbox.N_u9MYhRW5w.EW_8-F4iGXjmL10ap_maxS2duxggR_nQ`,
        'Content-Type': 'application/json'
      }
    });
    res.status(201).json({ applicantId: response.data.id });
  } catch (error) {
    console.log(error)
    res.status(500).send('Error creating applicant');
  }
});

app.get('/generate-sdk-token', async (req, res) => {
  try {
    const { applicant_id } = req.query;

    // Replace 'YOUR_API_TOKEN' with your actual Onfido API token
    const API_TOKEN = 'api_sandbox.N_u9MYhRW5w.EW_8-F4iGXjmL10ap_maxS2duxggR_nQ';

    // Make a POST request to Onfido API to generate the SDK token
    const response = await axios.post(
      'https://api.onfido.com/v3.6/sdk_token',
      { applicant_id },
      {
        headers: {
          'Authorization': `Token token=${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the SDK token from the response
    const { token } = response.data;

    res.status(200).json({ sdk_token: token });
  } catch (error) {
    console.error('Error generating SDK token:', error.response.data);
    res.status(error.response.status).json({ error: error.response.data });
  }
});

app.get('/updateKycStatus', async (req, res) => {
  try {
    const { email, status } = req.query;

    console.log('Request received:', email, status);

    const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found`);
      return res.status(405).json({ error: `User with email ${email} not found` });
    }

    // Update the password
    if (status) {
      await collection.updateOne(
        { email },
        { $set: { kycStatusUser: status } }
      );
    }

    console.log(`Password updated successfully for user with email ${email}`);

    // Close MongoDB connection
    await client.close();

    // Send response
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'An error occurred while updating password' });
  }
});

app.get('/checkStatusOnfidoKyc', async (req, res) => {
  const { applicantId } = req.query;

  console.log(applicantId);
  const API_TOKEN = 'api_sandbox.N_u9MYhRW5w.EW_8-F4iGXjmL10ap_maxS2duxggR_nQ';
  const ONFIDO_API_TOKEN = 'api_sandbox.N_u9MYhRW5w.EW_8-F4iGXjmL10ap_maxS2duxggR_nQ';
  const ONFIDO_API_URL = 'https://api.eu.onfido.com/v3.6';

  if (!applicantId) {
    return res.status(400).json({ error: 'Applicant ID is required' });
  }

  try {
    // Create a check for the applicant
    const checkResponse = await axios.post(`https://api.onfido.com/v3/checks`, {
      applicant_id: 'af50633d-a033-4801-92bf-c1ae0f2c4929',
      report_names: ['document', 'facial_similarity_photo', 'identity_enhanced']
    }, {
      headers: {
        Authorization: `Token token=${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const checkId = checkResponse.data.id;

    console.log('data', checkResponse.data)
    console.log('checkId', checkId);

    // Send the status back in the response
    res.status(200).json({ status: checkId });

  } catch (error) {
    //console.error('Error creating or checking the status of the KYC:', error);
    res.status(500).json({ error: 'An error occurred while processing the KYC check' });
  }
});

app.get('/checkStatusOnfidoKycRetrieve', async (req, res) => {
  const { applicantId } = req.query;

  console.log(applicantId);
  const API_TOKEN = 'api_sandbox.N_u9MYhRW5w.EW_8-F4iGXjmL10ap_maxS2duxggR_nQ';
  const ONFIDO_API_TOKEN = 'api_sandbox.N_u9MYhRW5w.EW_8-F4iGXjmL10ap_maxS2duxggR_nQ';
  const ONFIDO_API_URL = 'https://api.eu.onfido.com/v3.6';

  if (!applicantId) {
    return res.status(400).json({ error: 'Applicant ID is required' });
  }

  try {
    // Create a check for the applicant
    const checkResponse = await axios.get(`https://api.onfido.com/v3.6/reports/811f43d2-7c27-476b-949a-526850f74238`, {
      headers: {
        Authorization: `Token token=${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const checkId = checkResponse.data;

    console.log('checkId', checkResponse.data);

    // Send the status back in the response
    res.status(200).json({ status: checkId });

  } catch (error) {
    console.error('Error creating or checking the status of the KYC:', error);
    res.status(500).json({ error: 'An error occurred while processing the KYC check' });
  }
});

const createVeriffSession = async (applicantData) => {
  const apiKey = 'f7daa5b3-13f4-4ab1-98e7-8e6b6c39e39f';
  const url = 'https://stationapi.veriff.com/v1/sessions';
  const headers = {
    'X-AUTH-CLIENT': apiKey,
    'Content-Type': 'application/json'
  };
  const data = {
    'verification': {
      'callback': 'https://veriff.com',
      'person': {
        'firstName': applicantData.firstName,
        'lastName': applicantData.lastName,
      },
    }
  };

  try {
    const response = await axios.post(url, data, { headers });
    console.log(response.data);
    return response.data.verification; // This is your session token'
  } catch (error) {
    console.error('Error creating Veriff session:', error);
    throw error;
  }
};

app.get('/generateVeriffSessionToken', async (req, res) => {
  const { firstName, lastName, walletAddress, email, countryalpha, fullName } = req.query;

  try {
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();

    // Access the appropriate database and collection
    const db = client.db('f3_ecommerce');
    const collection = db.collection('users');

    // Check if the email already exists
    const existingUser = await collection.findOne({ email });
    const existingUserWallet = await collection.findOne({ walletAddress });
    const existingUserName = await collection.findOne({ fullName });

    if (existingUser) {
      await client.close();
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    if (existingUserWallet) {
      await client.close();
      return res.status(401).json({ error: 'User with this wallet address already exists' });
    }

    if (existingUserName) {
      await client.close();
      return res.status(402).json({ error: 'User with this name already exists' });
    }

    // Applicant data for Veriff
    const applicantData = {
      firstName: firstName || 'John',
      lastName: lastName || 'Doe',
      idNumber: '123456789', // Assuming ID number is not provided
      country: countryalpha || 'USA',
      documentType: 'passport'
    };

    // Create Veriff session
    const sessionToken = await createVeriffSession(applicantData);
    await client.close();

    res.json({ applicantId: sessionToken.sessionToken, sessionId: sessionToken.id });
  } catch (error) {
    console.error('Failed to create Veriff session:', error);
    res.status(500).json({ error: 'Failed to create Veriff session' });
  }
});

app.get('/getKycDecision', async (req, res) => {
  const { sessionId } = req.query;
  const API_KEY = 'f7daa5b3-13f4-4ab1-98e7-8e6b6c39e39f';
  const API_SECRET = 'd07c4bc5-db11-4de0-856b-7f1be8d54616';
  const VERSION = '1.0.0';  // Define the version

  // Construct the URL for the Veriff API endpoint with the version query parameter
  const apiUrl = `https://stationapi.veriff.com/v1/sessions/${sessionId}/decision/fullauto?version=${VERSION}`;

  // Compute HMAC
  const hmac = crypto.createHmac('sha256', API_SECRET);
  hmac.update(sessionId);
  const hmacSignature = hmac.digest('hex');

  // Set up axios request configuration
  const options = {
    method: 'GET',
    url: apiUrl,
    headers: {
      'Content-Type': 'application/json',
      'X-AUTH-CLIENT': API_KEY,
      'X-HMAC-SIGNATURE': hmacSignature
    }
  };

  try {
    // Make the request using axios
    const response = await axios(options);
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Veriff Decision:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    res.status(500).json({ error: 'Failed to fetch KYC decision' });
  }
});

app.get('/specificStoreSoldProducts', async (req, res) => {
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
    console.log(usersWithMatchingStore);
    const matchingProducts = usersWithMatchingStore.reduce((products, user) => {
      if (user.products && user.products.length > 0) {
        // Filter products to include only those with totalsolds value >= 1
        const filteredProducts = user.products.filter(product => product.totalsolds >= 1);
        const productsWithUserName = filteredProducts.map(product => ({
          ...product,
          usdRateProduct: user.usdtRate,
          userCurrencySymbol: user.currencySymbol
        }));
        //console.log(user);
        products.push(...productsWithUserName);
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

app.get('/addResellerMember', async (req, res) => {
  const { addingMemberId, sponsorId, dateAndTime } = req.query;

  if (!addingMemberId || !sponsorId || !dateAndTime) {
    console.log('Missing parameters');
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  const sponsorUser = await collection.findOne({ storeId: sponsorId });
  const isAddedMember = sponsorUser.AlreadyResellerMember;
  if (!sponsorUser) {
    console.log(`User with storeId ${sponsorId} not found`);
    return res.status(405).json({ error: `User with storeId ${sponsorId} not found` });
  }
  if (!isAddedMember && sponsorId != '42539347') {
    console.log(`You are not allowed to invite any user as you're not a reseller member!`);
    return res.status(404).json({ error: `You are not allowed to invite any user as you're not a reseller member!` });
  };
  const addingMemberUser = await collection.findOne({ storeId: addingMemberId });
  if (!addingMemberUser) {
    console.log(`User with addingMember Store Id ${addingMemberId} not exists`);
    return res.status(406).json({ error: `User with addingMember Store Id ${addingMemberId} not exists` });
  }

  const existingRequest = addingMemberUser.ResellerMemberRequests && addingMemberUser.ResellerMemberRequests[sponsorId];
  if (existingRequest) {
    return res.status(402).json({ error: 'There is already a request sent' });
  }

  let userWithReseller = await collection.findOne({ 'resellersMember': { $elemMatch: { $eq: addingMemberId } } });
  console.log(userWithReseller);
  if (userWithReseller) {
    return res.status(408).json({ error: 'This user is already a member of resellers view!' });
  }

  const resellers = sponsorUser.resellersMember ? sponsorUser.resellersMember : [];
  console.log(`Resellers : ${resellers}`);
  const totalResellers = resellers.length;
  let totalProfit = 0.00;

  for (const reseller of resellers) {
    const resellerUser = await collection.findOne({ storeId: reseller });
    console.log(`Reseller User : ${resellerUser}`);
    if (resellerUser && resellerUser.products) {
      resellerUser.products.forEach(product => {
        if (product.totalsolds >= 1) {
          const totalSold = Number(product.totalsolds);
          const priceString = product.startedPrice.replace(/[^\d.-]/g, '');
          const priceProduct = parseFloat((priceString).toString()) || 0;
          const resellersReward = parseFloat(product.resellers_reward ?? 0) || 0;
          const totalPriceProduct = (totalSold * priceProduct);
          totalProfit += (totalPriceProduct * (resellersReward / 100));
          console.log(`Price string ${priceString}`);
          console.log(`Price Product ${priceProduct}`);
          console.log(`Original Price String: ${product.startedPrice}`);
          console.log(`Cleaned Price String: ${priceString}`);
          console.log(`Parsed Price Product: ${priceProduct}`);
        }
      });
    }
  }

  sponsorUser.products.forEach(product => {
    if (product.totalsolds >= 1) {
      const totalSold = Number(product.totalsolds);
      const priceString = product.startedPrice.replace(/[^\d.-]/g, '');
      const priceProduct = parseFloat((priceString).toString()) || 0;
      const resellersReward = parseFloat(product.resellers_reward ?? 0) || 0;
      const totalPriceProduct = (totalSold * priceProduct);
      totalProfit += (totalPriceProduct * (resellersReward / 100));
      console.log(`Price string ${priceString}`);
      console.log(`Price Product ${priceProduct}`);
      console.log(`Original Price String: ${product.startedPrice}`);
      console.log(`Cleaned Price String: ${priceString}`);
      console.log(`Parsed Price Product: ${priceProduct}`);
    }
  });

  const sponsorFullName = sponsorUser.fullName;
  const usdtRateSponsor = sponsorUser.usdtRate;
  const currencySymbol = sponsorUser.currencySymbol;

  const newRequest = {
    sponsorId,
    totalResellers,
    totalProfit: parseFloat(totalProfit).toFixed(3),
    sponsorFullName,
    usdtRateSponsor,
    currencySymbol,
    dateAndTime
  };

  if (!addingMemberUser.ResellerMemberRequests) {
    addingMemberUser.ResellerMemberRequests = {};
  }

  console.log(newRequest);
  addingMemberUser.ResellerMemberRequests[sponsorId] = newRequest;

  await collection.updateOne(
    { storeId: addingMemberId },
    { $set: { ResellerMemberRequests: addingMemberUser.ResellerMemberRequests } }
  );

  console.log(`Successfully sent request to ${addingMemberId} for reseller member`);
  return res.status(200).json({ success: `Successfully sent request to ${addingMemberId} for reseller member and data is ${newRequest.totalProfit}` });
});

app.get('/getResellersRequest', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    console.log('Missing userId parameter');
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  const user = await collection.findOne({ storeId: userId });
  if (!user) {
    console.log(`User with userId ${userId} not found`);
    return res.status(404).json({ error: `User with userId ${userId} not found` });
  }

  const resellerRequests = user.ResellerMemberRequests || {};

  if (Object.keys(resellerRequests).length === 0) {
    console.log(`No requests found for user with userId ${userId}`);
    return res.status(403).json({ error: `No requests exist for user with userId ${userId}` });
  }

  const formattedRequests = Object.keys(resellerRequests).map(sponsorId => {
    const request = resellerRequests[sponsorId];
    return {
      sponsorId: request.sponsorId,
      sponsorName: request.sponsorFullName,
      totalResellers: request.totalResellers,
      totalProfit: request.totalProfit,
      currencyCode: request.currencySymbol,
      usdtRate: request.usdtRateSponsor,
      dateAndTime: request.dateAndTime
    };
  });

  return res.status(200).json({ requests: formattedRequests });
});

app.get('/declineAndDeleteResellerRequest', async (req, res) => {
  const { userId, sponsorId } = req.query;

  if (!userId || !sponsorId) {
    console.log('Missing userId or sponsorId parameter');
    return res.status(400).json({ error: 'Missing userId or sponsorId parameter' });
  }

  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  const user = await collection.findOne({ storeId: userId });
  if (!user) {
    console.log(`User with userId ${userId} not found`);
    return res.status(404).json({ error: `User with userId ${userId} not found` });
  }

  if (!user.ResellerMemberRequests || !user.ResellerMemberRequests[sponsorId]) {
    console.log(`Request with sponsorId ${sponsorId} not found for user with userId ${userId}`);
    return res.status(405).json({ error: `Request with sponsorId ${sponsorId} not found` });
  }

  // Delete the request with the specified sponsorId
  delete user.ResellerMemberRequests[sponsorId];

  // Update the user document in the database to remove the request
  await collection.updateOne(
    { storeId: userId },
    { $set: { ResellerMemberRequests: user.ResellerMemberRequests } }
  );

  console.log(`Successfully declined and deleted request with sponsorId ${sponsorId} for user with userId ${userId}`);
  return res.status(200).json({ success: `Successfully declined and deleted request with sponsorId ${sponsorId}` });
});

app.get('/approveAndAddMemberToReseller', async (req, res) => {
  const { userId, sponsorId, dateAndTime } = req.query;

  if (!userId || !sponsorId || !dateAndTime) {
    console.log('Missing userId, sponsorId, or dateAndTime parameter');
    return res.status(400).json({ error: 'Missing userId, sponsorId, or dateAndTime parameter' });
  }

  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the sponsor user
    const sponsorUser = await collection.findOne({ storeId: sponsorId });
    const approvingUser = await collection.findOne({ storeId: userId });
    const isAlreadyAMember = approvingUser.AlreadyResellerMember;
    console.log(approvingUser);
    console.log(isAlreadyAMember);
    if (!sponsorUser) {
      console.log(`User with storeId ${sponsorId} not found`);
      return res.status(404).json({ error: `User with storeId ${sponsorId} not found` });
    }
    if (isAlreadyAMember) {
      console.log(`User Already a member of reseller and ${isAlreadyAMember}`);
      return res.status(402).json({ MemberOf: isAlreadyAMember })
    }

    // Check if the sponsor has a resellersMember array, if not initialize it
    sponsorUser.resellersMember = sponsorUser.resellersMember || [];

    // Add the new member to the sponsor's resellersMember array
    sponsorUser.resellersMember.push(userId);

    // Update the sponsorUser document in the database
    await collection.updateOne(
      { storeId: sponsorId },
      { $set: { resellersMember: sponsorUser.resellersMember } }
    );

    // Find the user requesting to be a reseller
    const user = await collection.findOne({ storeId: userId });
    if (!user) {
      console.log(`User with storeId ${userId} not found`);
      return res.status(404).json({ error: `User with storeId ${userId} not found` });
    }

    // Update the user's account to mark them as AlreadyResellerMember: Yes
    await collection.updateOne(
      { storeId: userId },
      { $set: { AlreadyResellerMember: sponsorId } }
    );

    // Delete the request from ResellerMemberRequests in the user's account
    if (user.ResellerMemberRequests && user.ResellerMemberRequests[sponsorId]) {
      delete user.ResellerMemberRequests[sponsorId];

      // Update the user document to remove the request
      await collection.updateOne(
        { storeId: userId },
        { $set: { ResellerMemberRequests: user.ResellerMemberRequests } }
      );
    }

    console.log(`Successfully approved and added ${userId} to resellersMember of ${sponsorId}`);
    return res.status(200).json({ success: `Successfully approved and added ${userId} to resellersMember of ${sponsorId}` });
  } catch (error) {
    console.error('Error approving and adding member to reseller:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.close();
  }
});

app.get('/getResellerViewOff', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    console.log('Missing userId parameter');
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the user
    const user = await collection.findOne({ storeId: userId });
    if (!user) {
      console.log(`User with storeId ${userId} not found`);
      return res.status(404).json({ error: `User with storeId ${userId} not found` });
    }
    const storeRequests = user.ApprovedPaymentRequestResellersReward;
    const currencySymbol = user.currencySymbol;

    let withdrawalAmount = 0.00
    let f3ValueOfWithdrawalAmount = 0.00
    let totalPurchasedOfLoggedInUser = 0.00;


    let withdrawaScreenProducts = [];
    let levels = 0;
    let currentLevelIds = [userId];
    let allMembers = [];

    while (levels < 15 && currentLevelIds.length > 0) {
      let nextLevelIds = [];
      let currentLevelMembers = [];

      for (let id of currentLevelIds) {
        let member = await collection.findOne({ storeId: id });
        if (member && member.resellersMember) {
          for (let resellerId of member.resellersMember) {
            let resellerUser = await collection.findOne({ storeId: resellerId });
            if (resellerUser) {
              const storeRequests = resellerUser.ApprovedPaymentRequestResellersReward;
              let totalPurchased = 0;
              let totalResellersReward = 0;
              let totalResellersProductRewardPercentage = 0;

              let totalPurchasedProducts = 0.0;
              let totalProfitProducts = 0.0;
              let totalWithdrawalAmountUser = 0.0;
              let totalF3WithdrawalUser = 0.0;

              // if (resellerUser.products) {
              //   resellerUser.products
              //     .filter(product => product.totalsolds >= 1)
              //     .forEach(product => {
              //       const totalSold = Number(product.totalsolds);
              //       const priceString = product.startedPrice.replace(/[^\d.-]/g, '');
              //       const priceProduct = parseFloat(priceString) || 0;
              //       const resellersReward = parseFloat(product.resellers_reward ?? 0) || 0;

              //       const productTotalPurchased = totalSold * priceProduct;
              //       const productResellersReward = productTotalPurchased * (resellersReward / 100);

              //       totalPurchased += productTotalPurchased;
              //       totalResellersReward += productResellersReward;
              //     });
              // };

              if (storeRequests) {
                Object.keys(storeRequests).forEach(subRequesName => {
                  const requestArray = storeRequests[subRequesName];
                  requestArray.forEach(storeRequest => {
                    //console.lo0g(`storeRequestsParticularUser : ${storeRequest}`);
                    const withdrawal = storeRequest.receivableAmount.replace(/[^\d.-]/g, '');
                    const withdrawalF3 = storeRequest.f3ValueOfWithdraw.replace(/[^\d.-]/g, '');
                    totalWithdrawalAmountUser += parseFloat(withdrawal)
                    totalF3WithdrawalUser += parseFloat(withdrawalF3);
                    withdrawalAmount += parseFloat(withdrawal);
                    f3ValueOfWithdrawalAmount += parseFloat(withdrawalF3);
                  });
                });
              }

              if (resellerUser.checkoutapproval) {
                Object.keys(resellerUser.checkoutapproval).forEach(storeId => {
                  resellerUser.checkoutapproval[storeId].forEach(productDetails => {
                    //console.log('Approval Checkout Seller Product Details:', productDetails);
                    const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
                    const totalResellersRewardd = productDetails.resellers_reward ?? 0.0
                    const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersRewardd / 100));
                    totalPurchased += parseFloat(totalAmountProduct);
                    totalResellersReward += parseFloat(totalproductResellersReward);
                    console.log(`checkoutApprovalRR : ${totalResellersRewardd}`);
                    const productDetailsEach = {
                      sponsorId: resellerUser.storeId,
                      userId: member.storeId,
                      userName: resellerUser.fullName,
                      level: levels + 1,
                      totalPurchased: parseFloat(totalAmountProduct).toFixed(2),
                      totalResellersReward: parseFloat(totalproductResellersReward).toFixed(2),
                      sellersWalletAddress: resellerUser.walletAddress,
                      currencySymbol: resellerUser.currencySymbol,
                      usdRate: resellerUser.usdtRate,
                      cityReseller: resellerUser.cityAddress,
                      totalPurchasedProducts : '0',
                      totalProfitProducts : '0',
                      totalWithdrawalAmountUser,
                      totalF3WithdrawalUser,
                      totalResellersProductRewardPercentage : parseFloat(totalResellersRewardd),
                      totalResellers: resellerUser.resellersMember ? resellerUser.resellersMember.length : 0
                    };
                    withdrawaScreenProducts.push(productDetailsEach);
                  });
                });
              }

              if (resellerUser.salesHistorySeller) {
                Object.keys(resellerUser.salesHistorySeller).forEach(storeId => {
                  resellerUser.salesHistorySeller[storeId].forEach(productDetails => {
                    //console.log('Sales History Seller Product Details:', productDetails);
                    const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
                    const totalResellersRewardd = productDetails.resellers_reward ?? 0.0
                    const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersRewardd / 100));
                    totalPurchased += parseFloat(totalAmountProduct);
                    totalResellersReward += parseFloat(totalproductResellersReward);
                    console.log(`salesHistorySellerRR : ${totalResellersRewardd}`);
                    const productDetailsEach = {
                      sponsorId: resellerUser.storeId,
                      userId: member.storeId,
                      userName: resellerUser.fullName,
                      level: levels + 1,
                      totalPurchased: parseFloat(totalAmountProduct).toFixed(2),
                      totalResellersReward: parseFloat(totalproductResellersReward).toFixed(2),
                      sellersWalletAddress: resellerUser.walletAddress,
                      currencySymbol: resellerUser.currencySymbol,
                      usdRate: resellerUser.usdtRate,
                      cityReseller: resellerUser.cityAddress,
                      totalPurchasedProducts : '0',
                      totalProfitProducts : '0',
                      totalWithdrawalAmountUser,
                      totalF3WithdrawalUser,
                      totalResellersProductRewardPercentage : parseFloat(totalResellersRewardd),
                      totalResellers: resellerUser.resellersMember ? resellerUser.resellersMember.length : 0
                    };
                    withdrawaScreenProducts.push(productDetailsEach);
                  });
                });
              }

              if (resellerUser.approvalcheckoutBuyer) {
                Object.keys(resellerUser.approvalcheckoutBuyer).forEach(storeId => {
                  resellerUser.approvalcheckoutBuyer[storeId].forEach(productDetails => {
                    //console.log('Approval Checkout Buyer Product Details:', productDetails);
                    const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
                    const totalResellersReward = parseFloat(productDetails.resellers_reward ?? 0);
                    const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersReward / 100));
                    totalPurchasedProducts += parseFloat(totalAmountProduct);
                    totalProfitProducts += parseFloat(totalproductResellersReward);
                    totalResellersProductRewardPercentage += totalResellersReward;
                    console.log(`approvalCheckoutBuyerRR : ${totalResellersReward}`);
                    console.log(`approvalCheckoutBuyerRRPlused : ${totalResellersProductRewardPercentage}`);
                  });
                });
              }

              if (resellerUser.salesHistoryBuyer) {
                Object.keys(resellerUser.salesHistoryBuyer).forEach(storeId => {
                  resellerUser.salesHistoryBuyer[storeId].forEach(productDetails => {
                    //console.log('Sales History Buyer Product Details:', productDetails);
                    const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
                    const totalResellersReward = parseFloat(productDetails.resellers_reward ?? 0);
                    const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersReward / 100));
                    totalPurchasedProducts += parseFloat(totalAmountProduct);
                    totalProfitProducts += parseFloat(totalproductResellersReward);
                    totalResellersProductRewardPercentage += totalResellersReward;
                    console.log(`salesHistoryBuyerRRPlused : ${totalResellersProductRewardPercentage}`);
                  });
                });
              }

              currentLevelMembers.push({
                sponsorId: resellerUser.storeId,
                userId: member.storeId,
                userName: resellerUser.fullName,
                level: levels + 1,
                totalPurchased: totalPurchased.toFixed(2),
                totalResellersReward: totalResellersReward.toFixed(2),
                sellersWalletAddress: resellerUser.walletAddress,
                currencySymbol: resellerUser.currencySymbol,
                usdRate: resellerUser.usdtRate,
                cityReseller: resellerUser.cityAddress,
                totalPurchasedProducts,
                totalProfitProducts,
                totalWithdrawalAmountUser,
                totalF3WithdrawalUser,
                totalResellersProductRewardPercentage,
                totalResellers: resellerUser.resellersMember ? resellerUser.resellersMember.length : 0
              });



              nextLevelIds.push(resellerId);
            }
          }
        }
      }

      allMembers = [...allMembers, ...currentLevelMembers];
      currentLevelIds = nextLevelIds;
      levels++;
    }
    if (storeRequests) {
      Object.keys(storeRequests).forEach(subRequestName => {
        const requestsArray = storeRequests[subRequestName];
        requestsArray.forEach(storeRequest => {
          storeRequest.requestProducts.forEach(storeRequest => {
            //console.log(storeRequest);
            const withdrawal = storeRequest.receivableAmount.replace(/[^\d.-]/g, '');
            const withdrawalF3 = storeRequest.f3ValueOfWithdraw.replace(/[^\d.-]/g, '');
            withdrawalAmount += parseFloat(withdrawal);
            f3ValueOfWithdrawalAmount += parseFloat(withdrawalF3);
          });
        });
      });
    };

    if (user.checkoutapproval) {
      Object.keys(user.checkoutapproval).forEach(storeId => {
        user.checkoutapproval[storeId].forEach(productDetails => {
          //console.log('Approval Checkout Seller Product Details:', productDetails);
          const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
          const totalResellersRewardd = productDetails.resellers_reward ?? 0.0
          const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersRewardd / 100));
          totalPurchasedOfLoggedInUser += parseFloat(totalAmountProduct);
        });
      });
    }

    if (user.salesHistorySeller) {
      Object.keys(user.salesHistorySeller).forEach(storeId => {
        user.salesHistorySeller[storeId].forEach(productDetails => {
          //console.log('Sales History Seller Product Details:', productDetails);
          const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
          const totalResellersRewardd = productDetails.resellers_reward ?? 0.0
          const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersRewardd / 100));
          totalPurchasedOfLoggedInUser += parseFloat(totalAmountProduct);
        });
      });
    }

    if (user.approvalcheckoutBuyer) {
      Object.keys(user.approvalcheckoutBuyer).forEach(storeId => {
        user.approvalcheckoutBuyer[storeId].forEach(productDetails => {
          //console.log('Approval Checkout Buyer Product Details:', productDetails);
          const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
          const totalResellersReward = parseFloat(productDetails.resellers_reward ?? 0);
          const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersReward / 100));
          totalPurchasedOfLoggedInUser += parseFloat(totalAmountProduct);
        });
      });
    }

    if (user.salesHistoryBuyer) {
      Object.keys(user.salesHistoryBuyer).forEach(storeId => {
        user.salesHistoryBuyer[storeId].forEach(productDetails => {
          //console.log('Sales History Buyer Product Details:', productDetails);
          const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
          const totalResellersReward = parseFloat(productDetails.resellers_reward ?? 0);
          const totalproductResellersReward = (parseFloat(totalAmountProduct) * (totalResellersReward / 100));
          totalPurchasedOfLoggedInUser += parseFloat(totalAmountProduct);
        });
      });
    }

    const usdtRate = parseFloat(user.usdtRate);
    const forecastedProfit = ((totalPurchasedOfLoggedInUser / usdtRate) * 3) ?? 0.0
    const userDetailsWithdrawals = {
      withdrawalAmount: withdrawalAmount,
      f3ValueOfWithdrawalAmount: f3ValueOfWithdrawalAmount,
      currencySymbol: currencySymbol,
      forecastedProfit: forecastedProfit,
      usdRate: user.usdtRate
    };
    return res.status(200).json({ members: allMembers,withdrawScreens : withdrawaScreenProducts, userDetails: userDetailsWithdrawals });
  } catch (error) {
    console.error('Error fetching reseller view:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.close();
  }
});

app.get('/getResellerViewOn', async (req, res) => {
  const { userId } = req.query;

});

app.get('/requestForResellerWithdrawal', async (req, res) => {
  const { providerStoreId, storeId, providerWalletAddress, payingWalletAddress, receivableAmount, dateAndTime, f3ValueOfWithdraw, currencySymbol } = req.query;
  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the user by storeId
    const user = await collection.findOne({ walletAddress: payingWalletAddress });
    if (!user) {
      console.log(`User with storeId ${payingWalletAddress} not found`);
      return res.status(401).json({ error: `User with walletAddress ${payingWalletAddress} not found` });
    }

    // Initialize the paymentRequestResellersReward object if it doesn't exist
    if (!user.paymentRequestResellersReward) {
      user.paymentRequestResellersReward = {};
    }

    // Check if there's already a request with the same providerWalletAddress
    if (user.paymentRequestResellersReward[providerStoreId]) {
      return res.status(402).json({ error: 'Request with the same providerWalletAddress already exists' });
    }

    // Create the new request object
    const newRequest = {
      providerWalletAddress,
      payingWalletAddress,
      receivableAmount,
      dateAndTime,
      f3ValueOfWithdraw,
      currencySymbol,
      storeId,
      providerStoreId
    };

    // Add the new request to the providerWalletAddress array
    user.paymentRequestResellersReward[providerStoreId] = [newRequest];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: payingWalletAddress },
      { $set: { paymentRequestResellersReward: user.paymentRequestResellersReward } }
    );

    return res.status(200).json({ message: 'Withdrawal request created successfully' });
  } catch (error) {
    console.error('Error Requesting Withdrawal:', error);
    return res.status(500).json({ error: `Internal server error ${error}` });
  } finally {
    client.close();
  }
});

app.get('/deleteResellerWithdrawRequest', async (req, res) => {
  const { storeId, providerWalletAddress, buyerWalletAddress } = req.query;
  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the user by storeId
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with storeId ${storeId} not found`);
      return res.status(404).json({ error: `User with storeId ${storeId} not found` });
    }

    // Check if the paymentRequestResellersReward object exists
    if (!user.paymentRequestResellersReward || !user.paymentRequestResellersReward[storeId]) {
      console.log(`Request with buyerWalletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `Request with buyerWalletAddress ${buyerWalletAddress} not found` });
    }

    // Delete the request with the given providerWalletAddress
    delete user.paymentRequestResellersReward[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      { $set: { paymentRequestResellersReward: user.paymentRequestResellersReward } }
    );

    return res.status(200).json({ message: 'Withdrawal request deleted successfully' });
  } catch (error) {
    console.error('Error deleting withdrawal request:', error);
    return res.status(500).json({ error: `Internal server error ${error}` });
  } finally {
    client.close();
  }
});

app.get('/approveResellersRequest', async (req, res) => {
  const { buyerWalletAddress, sellerStoreId, txhash, dateAndTime } = req.query;

  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the user with the buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the paymentRequestResellersReward object map
    const paymentRequestRR = user.paymentRequestResellersReward || {};
    const paymentRequests = paymentRequestRR[sellerStoreId];

    if (!paymentRequests) {
      return res.status(404).json({ error: 'Request not found for the given sellerStoreID' });
    }

    // Copy the array and add the new values
    const newRequestArray = paymentRequests.map(request => ({
      ...request,
      txhash,
      dateAndTimeOfApproved: dateAndTime
    }));

    const newRequestObject = {
      'requestProducts': [...newRequestArray]
    };

    console.log(newRequestObject);
    console.log(dateAndTime);

    // Initialize ApprovedPaymentRequestResellersReward if it doesn't exist
    user.ApprovedPaymentRequestResellersReward = user.ApprovedPaymentRequestResellersReward || {};

    if (!Array.isArray(user.ApprovedPaymentRequestResellersReward[sellerStoreId])) {
      console.log(`Creating new ApprovedPaymentRequestResellersReward array for sellerStoreId ${sellerStoreId}`);
      user.ApprovedPaymentRequestResellersReward[sellerStoreId] = [newRequestObject];
    } else {
      console.log(`Adding new request to existing ApprovedPaymentRequestResellersReward array for sellerStoreId ${sellerStoreId}`);
      user.ApprovedPaymentRequestResellersReward[sellerStoreId].push(newRequestObject);
    }

    // Update the user document in the database
    await collection.updateOne({ walletAddress: buyerWalletAddress }, { $set: user });

    // Remove the request from paymentRequestResellersReward
    delete paymentRequestRR[sellerStoreId];

    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      {
        $set: {
          paymentRequestResellersReward: paymentRequestRR
        }
      }
    );

    res.json({ message: 'Request approved and moved to ApprovedPaymentRequestResellersReward' });
  } catch (error) {
    console.error('Error approving resellers request:', error);
    return res.status(500).json({ error: `Internal server error: ${error}` });
  } finally {
    client.close();
  }
});

app.get('/getUserResellerMemberStatus', async (req, res) => {
  const { storeId } = req.query;
  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');
  try {
    const user = await collection.findOne({ storeId: storeId });
    if (!user) {
      console.log(`User not existed with storeId : ${storeId}`)
      return res.status(404).json(`User not existed with storeId : ${storeId}`);
    };

    const isAlreadyMemeber = user.AlreadyResellerMember;

    if (!isAlreadyMemeber && storeId != '42539347') {
      console.log(`Not Already a member ${isAlreadyMemeber}`);
      return res.status(202).json(`Not Already A member ${isAlreadyMemeber}`);
    }

    console.log(`Already A Member ${isAlreadyMemeber}`);
    res.json(`Already A Member ${isAlreadyMemeber}`);
  } catch (error) {
    console.error('Error getting status:', error);
    return res.status(500).json({ error: `Internal server error: ${error}` });
  } finally {
    client.close();
  }
});

//ProfitShares
app.get('/getItemsProfitShares', async (req, res) => {
  const { storeId } = req.query;
  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    const users = await collection.find().toArray();
    const loggedInUser = await collection.findOne({ storeId: storeId });
    const storeRequest = loggedInUser.approvedProfitSharePayments
    if (!loggedInUser) {
      console.log(`error : No account exists with user ${storeId}`);
      return res.status(404).json({ erorr: `No account exists with user ${storeId}` });
    }
    const usersWithApprovalsCheckoutSeller = await collection.find({ 'approvalcheckout': { $exists: true } }).toArray();
    const userWithSalesHistorySeller = await collection.find({ 'salesHistorySeller': { $exists: true } }).toArray();
    const usdRate = parseFloat(loggedInUser.usdtRate ?? 0);
    let totalPurchasedLoggedInUser = 0;
    let totalSoldLoggedInUser = 0;
    let totalWithdrawLoggedIn = 0;
    let totalF3WithdrawLoggedIn = 0;

    let totalSoldGlobalUsers = 0;
    let totalPurchasedGlobalUsers = 0;

    let allProductDetails = [];
    let allProductDetailsBuyer = [];

    for (const user of users) {
      const productMaps = [
        user.salesHistoryBuyer,
        user.approvalcheckoutBuyer,
      ];

      const storeIdUser = user.storeId;

      for (const user of usersWithApprovalsCheckoutSeller) {
        if (user.approvalcheckout && user.approvalcheckout[storeIdUser]) {
          const approvals = user.approvalcheckout[storeIdUser];
          for (const approvalcheckout of approvals) {
            let totalWithdrawalAmountUser = 0;
            const { storeId, productId, quantity, totalPrice, productName, storeIdBuyer, walletAddressBuyer, dateAndTime, dateOfApprovalCheckout, resellers_reward } = approvalcheckout;
            const user = await collection.findOne({storeId : storeId});
            const usdtRate = parseFloat(user.usdtRate);
            const resellerRewardValue = parseFloat(resellers_reward ?? 0.0)
            const sellerWalletAddress = user.walletAddress;
            const totalSoldedPrice = parseFloat(totalPrice.replace(/[^\d.-]/g, ''));
            const totalSoldAmount = (totalSoldedPrice / usdtRate);
            totalSoldGlobalUsers += totalSoldAmount;
            const shareStocks = ((resellerRewardValue / 100) * 3 * totalSoldAmount) ?? 0.0
            //StoreRequests
            const StoreRequests = user.ApprovedPaymentRequestResellersReward;
            if (StoreRequests) {
              Object.keys(StoreRequests).forEach(subRequesName => {
                const requestArray = StoreRequests[subRequesName];
                requestArray.forEach(storeRequest => {
                  storeRequest.requestProducts.forEach(storeRequest => {
                    //console.log(storeRequest);
                    const withdrawal = storeRequest.receivableAmount.replace(/[^\d.-]/g, '');
                    totalWithdrawalAmountUser += parseFloat(withdrawal)
                  });
                });
              });
            }
            const productDetails = {
              sellerStoreId: storeId,
              buyerStoreId: storeIdBuyer,
              walletAddressBuyer: walletAddressBuyer,
              sellerWalletAddress: sellerWalletAddress,
              totalQuantity: quantity,
              totalPrice: totalPrice,
              usdValue: totalSoldAmount,
              shareStocks: shareStocks,
              productName: productName,
              productId: productId,
              resellers_reward: resellerRewardValue,
              currencySymbol: user.currencySymbol,
              country: user.country,
              city: user.cityAddress,
              usdtRate: user.usdtRate,
              totalWithdrawalAmountUser,
              dateAndTime: dateOfApprovalCheckout
            };
            allProductDetails.push(productDetails);
          }
        }
      }

      for (const user of userWithSalesHistorySeller) {
        if (user.salesHistorySeller && user.salesHistorySeller[storeIdUser]) {
          const approvals = user.salesHistorySeller[storeIdUser];
          for (const approvalcheckout of approvals) {
            let totalWithdrawalAmountUser = 0;
            const { storeId, productId, quantity, totalPrice, productName, storeIdBuyer, walletAddressBuyer, dateOfApprovalCheckout, dateAndTime } = approvalcheckout;
            const user = await collection.findOne({storeId : storeId});
            const usdtRate = parseFloat(user.usdtRate);
            const sellerWalletAddress = user.walletAddress;
            const resellerRewardValue = parseFloat(resellers_reward ?? 0.0)
            const totalSoldedPrice = parseFloat(totalPrice.replace(/[^\d.-]/g, ''));
            const totalSoldAmount = (totalSoldedPrice / usdtRate);
            totalSoldGlobalUsers += totalSoldAmount;
            const shareStocks = ((resellerRewardValue / 100) * 3 * totalSoldAmount) ?? 0.0
             //StoreRequests
             const StoreRequests = user.ApprovedPaymentRequestResellersReward;
             if (StoreRequests) {
               Object.keys(StoreRequests).forEach(subRequesName => {
                 const requestArray = StoreRequests[subRequesName];
                 requestArray.forEach(storeRequest => {
                   storeRequest.requestProducts.forEach(storeRequest => {
                     //console.log(storeRequest);
                     const withdrawal = storeRequest.receivableAmount.replace(/[^\d.-]/g, '');
                     totalWithdrawalAmountUser += parseFloat(withdrawal)
                   });
                 });
               });
             }
             const productDetails = {
               sellerStoreId: storeId,
               buyerStoreId: storeIdBuyer,
               walletAddressBuyer: walletAddressBuyer,
               sellerWalletAddress: sellerWalletAddress,
               totalQuantity: quantity,
               totalPrice: totalPrice,
               usdValue: totalSoldAmount,
               shareStocks: shareStocks,
               productName: productName,
               productId: productId,
               resellers_reward: resellerRewardValue,
               currencySymbol: user.currencySymbol,
               country: user.country,
               city: user.cityAddress,
               usdtRate: user.usdtRate,
               totalWithdrawalAmountUser,
               dateAndTime: dateAndTime
             };
            allProductDetails.push(productDetails);
          }
        }
      }

      for (const productMap of productMaps) {
        if (productMap) {
          for (const productArray of Object.values(productMap)) {
            for (const product of productArray) {
              let totalWithdrawalAmountUser = 0;
              const sellerAccount = await collection.findOne({ storeId: product.storeId });
              const sellerWallet = sellerAccount ? sellerAccount.walletAddress : null;
              const currencySymbol = sellerAccount.currencySymbol;
              const totalPriceP = parseFloat(product.totalPrice.replace(/[^\d.-]/g, ''));
              const usdtRate = parseFloat(sellerAccount.usdtRate);
              const resellerRewardValue = parseFloat(product.resellers_reward ?? 0.0)
              const totalSoldUsdValue = (totalPriceP / usdtRate);
              totalPurchasedGlobalUsers += totalSoldUsdValue;
              const shareStocks = ((resellerRewardValue / 100) * 3 * totalSoldUsdValue) ?? 0.0
              //StoreRequests
              const StoreRequests = sellerAccount.ApprovedPaymentRequestResellersReward;
              if (StoreRequests) {
                Object.keys(StoreRequests).forEach(subRequesName => {
                  const requestArray = StoreRequests[subRequesName];
                  requestArray.forEach(storeRequest => {
                    storeRequest.requestProducts.forEach(storeRequest => {
                      //console.log(storeRequest);
                      const withdrawal = storeRequest.receivableAmount.replace(/[^\d.-]/g, '');
                      totalWithdrawalAmountUser += parseFloat(withdrawal)
                    });
                  });
                });
              }
              const productDetails = {
                sellerStoreId: product.storeId,
                buyerStoreId: product.storeIdBuyer,
                walletAddressBuyer: product.walletAddressBuyer,
                sellerWalletAddress: sellerWallet,
                totalQuantity: product.quantity,
                totalPrice: product.totalPrice,
                usdValue: totalSoldUsdValue,
                productName: product.productName,
                productId: product.productId,
                currencySymbol: currencySymbol,
                country: sellerAccount.country,
                city : sellerAccount.cityAddress,
                shareStocks: shareStocks,
                usdtRate: user.usdtRate,
                totalWithdrawalAmountUser,
                resellers_reward : resellerRewardValue, 
                dateAndTime: product.dateAndTime ?? product.dateOfApprovalCheckout
              };
              allProductDetailsBuyer.push(productDetails);
            }
          }
        }
      }
    }

    if (loggedInUser.approvalcheckoutBuyer) {
      Object.keys(loggedInUser.approvalcheckoutBuyer).forEach(storeId => {
        loggedInUser.approvalcheckoutBuyer[storeId].forEach(productDetails => {
          const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
          const totalPurchases = parseFloat(totalAmountProduct);
          const totalPurchasedLogged = (totalPurchases / usdRate);
          totalPurchasedLoggedInUser += totalPurchasedLogged;
        });
      });
    }

    for (const user of usersWithApprovalsCheckoutSeller) {
      if (user.approvalcheckout && user.approvalcheckout[storeId]) {
        const approvalCheckoutSellerMap = user.approvalcheckout[storeId];
        for (const approvalCS of approvalCheckoutSellerMap) {
          const { totalPrice } = approvalCS;
          const usdtRate = parseFloat(user.usdtRate);
          const totalPriceSolded = parseFloat(totalPrice.replace(/[^\d.-]/g, ''));
          const totalAmountSold = (totalPriceSolded / usdtRate);
          totalSoldLoggedInUser += totalAmountSold;
        }
      }
    }

    for (const user of userWithSalesHistorySeller) {
      if (user.salesHistorySeller && user.salesHistorySeller[storeId]) {
        const salesHistoryS = user.salesHistorySeller[storeId];
        for (const salesHistorySellerS of salesHistoryS) {
          const { totalPrice } = salesHistorySellerS;
          const usdtRate = parseFloat(user.usdtRate);
          const totalAmountSolded = parseFloat(totalPrice.replace(/[^\d.-]/g, ''));
          const totalAmountSold = (totalAmountSolded / usdtRate);
          totalSoldLoggedInUser += totalAmountSold;
        }
      }
    }

    if (loggedInUser.salesHistoryBuyer) {
      Object.keys(loggedInUser.salesHistoryBuyer).forEach(storeId => {
        loggedInUser.salesHistoryBuyer[storeId].forEach(productDetails => {
          const totalAmountProduct = productDetails.totalPrice.replace(/[^\d.-]/g, '');
          const totalPurchases = parseFloat(totalAmountProduct);
          const totalPurchasedLogged = (totalPurchases / usdRate);
          totalPurchasedLoggedInUser += totalPurchasedLogged;
        });
      });
    }


    if (storeRequest) {
      Object.keys(storeRequest).forEach(subRequestName => {
        const requestsArray = storeRequest[subRequestName];
        requestsArray.forEach(storeRequest => {
          storeRequest.requestProducts.forEach(storeRequest => {
            //console.log(storeRequest);
            const withdrawal = storeRequest.receivableAmount.replace(/[^\d.-]/g, '');
            const withdrawalF3 = storeRequest.f3ValueOfWithdraw.replace(/[^\d.-]/g, '');
            totalWithdrawLoggedIn += parseFloat(withdrawal);
            totalF3WithdrawLoggedIn += parseFloat(withdrawalF3);
          });
        });
      });
    };

    const kycStatusUser = loggedInUser.kycStatusUser;
    const finalKycStatusYesNo = kycStatusUser === 'accepted' ? 'Yes' : 'No';
    const loggedInDetail = {
      totalPurchasedLoggedInUser,
      totalSoldLoggedInUser,
      totalWithdrawLoggedIn,
      totalF3WithdrawLoggedIn,
      kycStatus: finalKycStatusYesNo
    };

    const globalDetails = {
      totalPurchasedGlobalUsers,
      totalSoldGlobalUsers,
      totalWithdrawLoggedIn,
      totalF3WithdrawLoggedIn
    };

    return res.status(200).json({ products: allProductDetails, productBuyer: allProductDetailsBuyer, loggedInDetails: loggedInDetail, globalDetails: globalDetails });
  } catch (error) {
    console.log(`error: ${error}`);
    return res.status(500).json({ error: `Internal server error: ${error}` });
  } finally {
    client.close();
  }
});

app.get('/requestForProfitShareWithdrawal', async (req, res) => {
  const { providerStoreId, storeId, providerWalletAddress, payingWalletAddress, receivableAmount, dateAndTime, f3ValueOfWithdraw, currencySymbol } = req.query;
  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the user by storeId
    const user = await collection.findOne({ walletAddress: payingWalletAddress });
    if (!user) {
      console.log(`User with storeId ${payingWalletAddress} not found`);
      return res.status(401).json({ error: `User with walletAddress ${payingWalletAddress} not found` });
    }

    // Initialize the paymentRequestResellersReward object if it doesn't exist
    if (!user.paymentRequestProfitShare) {
      user.paymentRequestProfitShare = {};
    }

    // Check if there's already a request with the same providerWalletAddress
    if (user.paymentRequestProfitShare[providerStoreId]) {
      return res.status(402).json({ error: 'Request with the same providerWalletAddress already exists' });
    }

    // Create the new request object
    const newRequest = {
      providerWalletAddress,
      payingWalletAddress,
      receivableAmount,
      dateAndTime,
      f3ValueOfWithdraw,
      currencySymbol,
      storeId,
      providerStoreId
    };

    // Add the new request to the providerWalletAddress array
    user.paymentRequestProfitShare[providerStoreId] = [newRequest];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: payingWalletAddress },
      { $set: { paymentRequestProfitShare: user.paymentRequestProfitShare } }
    );

    return res.status(200).json({ message: 'Withdrawal request created successfully' });
  } catch (error) {
    console.error('Error Requesting Withdrawal:', error);
    return res.status(500).json({ error: `Internal server error ${error}` });
  } finally {
    client.close();
  }
});

app.get('/deleteProfitShareWithdrawRequest', async (req, res) => {
  const { storeId, providerWalletAddress, buyerWalletAddress } = req.query;
  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the user by storeId
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });
    if (!user) {
      console.log(`User with storeId ${storeId} not found`);
      return res.status(404).json({ error: `User with storeId ${storeId} not found` });
    }

    // Check if the paymentRequestProfitShare object exists
    if (!user.paymentRequestProfitShare || !user.paymentRequestProfitShare[storeId]) {
      console.log(`Request with buyerWalletAddress ${buyerWalletAddress} not found`);
      return res.status(404).json({ error: `Request with buyerWalletAddress ${buyerWalletAddress} not found` });
    }

    // Delete the request with the given providerWalletAddress
    delete user.paymentRequestProfitShare[storeId];

    // Update the user document in the database
    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      { $set: { paymentRequestProfitShare: user.paymentRequestProfitShare } }
    );

    return res.status(200).json({ message: 'Withdrawal request deleted successfully' });
  } catch (error) {
    console.error('Error deleting withdrawal request:', error);
    return res.status(500).json({ error: `Internal server error ${error}` });
  } finally {
    client.close();
  }
});

app.get('/approveProfitShareRequest', async (req, res) => {
  const { buyerWalletAddress, sellerStoreId, txhash, dateAndTime } = req.query;

  const client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('f3_ecommerce');
  const collection = db.collection('users');

  try {
    // Find the user with the buyerWalletAddress
    const user = await collection.findOne({ walletAddress: buyerWalletAddress });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the paymentRequestProfitShare object map
    const paymentRequestRR = user.paymentRequestProfitShare || {};
    const paymentRequests = paymentRequestRR[sellerStoreId];

    if (!paymentRequests) {
      return res.status(404).json({ error: 'Request not found for the given sellerStoreID' });
    }

    // Copy the array and add the new values
    const newRequestArray = paymentRequests.map(request => ({
      ...request,
      txhash,
      dateAndTimeOfApproved: dateAndTime
    }));

    const newRequestObject = {
      'requestProducts': [...newRequestArray]
    };

    console.log(newRequestObject);
    console.log(dateAndTime);

    // Initialize ApprovedPaymentRequestResellersReward if it doesn't exist
    user.approvedProfitSharePayments = user.approvedProfitSharePayments || {};

    if (!Array.isArray(user.approvedProfitSharePayments[sellerStoreId])) {
      console.log(`Creating new ApprovedPaymentRequestResellersReward array for sellerStoreId ${sellerStoreId}`);
      user.approvedProfitSharePayments[sellerStoreId] = [newRequestObject];
    } else {
      console.log(`Adding new request to existing ApprovedPaymentRequestResellersReward array for sellerStoreId ${sellerStoreId}`);
      user.approvedProfitSharePayments[sellerStoreId].push(newRequestObject);
    }

    // Update the user document in the database
    await collection.updateOne({ walletAddress: buyerWalletAddress }, { $set: user });

    // Remove the request from paymentRequestResellersReward
    delete paymentRequestRR[sellerStoreId];

    await collection.updateOne(
      { walletAddress: buyerWalletAddress },
      {
        $set: {
          paymentRequestProfitShare: paymentRequestRR
        }
      }
    );

    res.json({ message: 'Request approved and moved to ApprovedPaymentRequestProfitShare' });
  } catch (error) {
    console.error('Error approving resellers request:', error);
    return res.status(500).json({ error: `Internal server error: ${error}` });
  } finally {
    client.close();
  }
});

app.listen(PORT, '192.168.29.149', () => {
  console.log(`Server is running on http://192.168.29.149:${PORT}`);
});