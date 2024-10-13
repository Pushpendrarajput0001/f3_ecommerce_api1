const { MongoClient } = require('mongodb');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (str) => new Promise((resolve) => rl.question(str, resolve));

function hideImagesArray(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => hideImagesArray(item));
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj = { ...obj };
      if (newObj.imagesArray) {
        newObj.imagesArray = '[Hidden]'; // Hide imagesArray
      }
      Object.keys(newObj).forEach(key => {
        newObj[key] = hideImagesArray(newObj[key]);
      });
      return newObj;
    }
    return obj;
  }

async function exploreAndEdit(doc, collection, fullPath = '', parentFilter = {}, storeId) {
  let keys = Object.keys(doc);
  let backEnabled = fullPath !== ''; // Only enable back option if not at root level

  // Display all keys/fields, but hide data for arrays initially
  console.log('\nSelect an option to explore, edit, add, or delete a value:');
  keys.forEach((key, index) => {
    if (key === 'images') {
      console.log(`${index + 1}: ${key} (${typeof doc[key]}) => Value: [Hidden]`);
    } else if (Array.isArray(doc[key])) {
      console.log(`${index + 1}: ${key} (${typeof doc[key]}) => Value: [Hidden]`);
    } else {
    console.log(`${index + 1}: ${key} (${typeof doc[key]})`);
    }
  });

  // Option to add a new key if doc is an object
  console.log(`${keys.length + 1}: Add new key-value`);
  if (backEnabled) {
    console.log(`${keys.length + 2}: Back`);
  }

  // Choose an option
  let option = await question('Enter the number: ');
  option = parseInt(option) - 1;

  // Handle back option
  if (backEnabled && option === keys.length + 1) {
    return false; // Return false to indicate going back
  }

  // Handle adding a new key-value pair
  if (option === keys.length) {
    const newKey = await question('Enter new key name: ');
    const newValue = await question('Enter value for new key: ');

    // Update MongoDB with the new key-value pair
    await collection.updateOne(parentFilter, { $set: { [`${fullPath ? `${fullPath}.` : ''}${newKey}`]: newValue } });
    console.log(`Added new key-value pair: ${newKey}: ${newValue}`);

    return exploreAndEdit(doc, collection, fullPath, parentFilter, storeId); // Refresh and continue exploring
  }

  let selectedKey = keys[option];
  let currentPath = fullPath ? `${fullPath}.${selectedKey}` : selectedKey;

  // Show the selected data in the console
  console.log(`\nSelected: ${selectedKey}`);
  if (selectedKey === 'images' || selectedKey === 'products') {
    // Show `imagesArray` or any array values only if specifically selected
    console.log(`Value: ${JSON.stringify(hideImagesArray(doc[selectedKey]), null, 2)}`);
  } else {
    //console.log(`Value: ${JSON.stringify(doc[selectedKey], null, 2)}`);
  }

  if (typeof doc[selectedKey] === 'object' && !Array.isArray(doc[selectedKey])) {
    // If it's an object, explore it recursively
    let goBack = await exploreAndEdit(doc[selectedKey], collection, currentPath, parentFilter, storeId);
    if (goBack) return exploreAndEdit(doc, collection, fullPath, parentFilter, storeId);
  } else if (Array.isArray(doc[selectedKey])) {
    // If it's an array, show array elements
    console.log('\nSelect an index to explore or delete:');
    doc[selectedKey].forEach((item, index) => {
      console.log(`${index + 1}: Index ${index} => Value: [Hidden]`);
    });
    console.log(`${doc[selectedKey].length + 1}: Back`);
    console.log(`${doc[selectedKey].length + 2}: Delete this array`);

    let indexOption = await question('Enter the number: ');
    indexOption = parseInt(indexOption) - 1;

    if (indexOption === doc[selectedKey].length) {
      return exploreAndEdit(doc, collection, fullPath, parentFilter, storeId); // Go back if user selects back
    }

    if (indexOption === doc[selectedKey].length + 1) {
      // Delete the entire array
      await collection.updateOne(parentFilter, { $unset: { [currentPath]: '' } });
      console.log(`Deleted array at path: ${currentPath}`);
      return exploreAndEdit(doc, collection, fullPath, parentFilter, storeId);
    }

    let goBack = await exploreAndEdit(doc[selectedKey][indexOption], collection, `${currentPath}.${indexOption}`, parentFilter, storeId);
    if (goBack) return exploreAndEdit(doc, collection, fullPath, parentFilter, storeId);
  } else {
    // If it's a value, allow editing or deleting
    console.log(`\nCurrent value of ${selectedKey}: ${doc[selectedKey]}`);
    let action = await question('Enter "e" to edit, "d" to delete, "h" to view hidden imagesArray, or press enter to leave unchanged: ');

    if (action === 'e') {
      let newValue = await question('Enter new value: ');
      await collection.updateOne(parentFilter, { $set: { [currentPath]: newValue } });
      console.log(`Updated ${selectedKey} to ${newValue}`);
    } else if (action === 'd') {
      await collection.updateOne(parentFilter, { $unset: { [currentPath]: '' } });
      console.log(`Deleted field: ${selectedKey}`);
    } else if (action === 'h' && selectedKey === 'imagesArray') {
      console.log(`Value: ${JSON.stringify(doc[selectedKey], null, 2)}`);
    }

    return exploreAndEdit(doc, collection, fullPath, parentFilter, storeId);
  }

  return true;
}

async function main() {
  try {
    const mongoUri = 'mongodb+srv://f3bazaar:f3bazaarapppass@atlascluster.ggzbtom.mongodb.net/?retryWrites=true&w=majority&appName=AtlasCluster';
    const dbName = 'f3_ecommerce';
    const collectionName = 'users';

    const client = await MongoClient.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const storeId = await question('Enter storeId to filter: ');

    // Find the document by storeId
    const doc = await collection.findOne({ storeId : storeId });

    if (!doc) {
      console.log('No document found with the given storeId');
      await client.close();
      rl.close();
      return;
    }

    console.log('\nDocument found:\n', JSON.stringify(hideImagesArray(doc), null, 2));

    // Explore and edit the document
    await exploreAndEdit(doc, collection, '', { storeId }, storeId);

    await client.close();
    rl.close();
  } catch (error) {
    console.error('Error:', error);
    rl.close();
  }
}

main();
