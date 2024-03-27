const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = 3000;
const MONGO_URI = 'mongodb+srv://andy:markf3ecommerce@atlascluster.gjlv4np.mongodb.net/?retryWrites=true&w=majority&appName=AtlasCluster';

// Middleware to parse JSON body
app.use(bodyParser.json());

// API endpoint to save user data
app.post('/usersregister', async (req, res) => {
  try {
    // Extract user data from request body
    const { email, password, storeName, walletAddress, cityAddress, localAddress, usdtRate, country } = req.body;

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


app.post("/validateWalletAddress", async (req, res) => {
    try {
      const web3 = new Web3('https://bsc-dataseed.binance.org/'); // Replace with your desired network URL
  
      // Define the transaction parameters
      const tokenAbi = require('./abif3.json'); // Replace with the ABI of your token contract
      const contractAddress = '0xfB265e16e882d3d32639253ffcfC4b0a2E861467';
      const contract = new web3.eth.Contract(tokenAbi, contractAddress);
      const decimals = 18; // Replace with the number of decimal places for your token
      const fromAddress = '0x7157830B5f342F7d927b6CE465C5284B9115b558';
      const toAddress = req.body.receiverAddress;
  
      // Parse the token amount from the request
      const tokenAmount = parseFloat(req.body.token);
  
      // Check if the tokenAmount is a valid number
      if (isNaN(tokenAmount)) {
        return res.status(400).send("Invalid token amount");
      }
  
      // Convert tokenAmount to the smallest unit (wei)
      const amountWithDecimals = web3.utils.toBN(
        web3.utils.toWei(tokenAmount.toString(), 'ether')
      );
  
      // Get the gas required for the token transfer
      const gas = await contract.methods.transfer(toAddress, amountWithDecimals).estimateGas({ from: fromAddress });
      console.log("Gas " + gas);
  
      // Get the current gas price
      const gasPrice = await web3.eth.getGasPrice();
  
      // Calculate the total gas fee in wei
      const gasFee = gas * gasPrice;
  
      // Convert gas fee from wei to Ether
      const gasFeeInEth = web3.utils.fromWei(gasFee.toString(), 'ether');
      console.log(`Gas fee: ${gasFeeInEth} BNB`);
  
      const result = {
        gasFee: gasFeeInEth
      };
  
      return res.status(200).send(result);
    } catch (err) {
      return res.status(400).send("Insufficient funds");
    }
  });

// Start the server and bind it to a specific IP address
app.listen(PORT, '192.168.29.149', () => {
    console.log(`Server is running on http://192.168.29.149:${PORT}`);
  });
  
