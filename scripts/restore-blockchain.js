require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
const BlockchainSync = require("../services/BlockchainSync");

async function restoreBlockchain() {
  let client;
  try {
    // Check if files exist before starting
    const contractsPath = path.join(__dirname, "../public/contracts");
    const artifactPath = path.join(
      contractsPath,
      "contracts/PropertyRegistry.sol/PropertyRegistry.json"
    );
    const addressPath = path.join(contractsPath, "contract-address.json");

    if (!fs.existsSync(artifactPath) || !fs.existsSync(addressPath)) {
      throw new Error(
        "Contract files not found. Please run npm run compile && npm run deploy first"
      );
    }

    // Ensure MongoDB URI exists
    if (!process.env.MONGO_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    // Connect to MongoDB
    client = new MongoClient(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    console.log("Connected to MongoDB successfully");

    // Initialize BlockchainSync with the MongoDB client
    const blockchainSync = new BlockchainSync(client, "trustvault"); // Replace with your database name

    // Perform restoration
    await blockchainSync.restoreBlockchainState();

    console.log("Blockchain state restored successfully");
  } catch (error) {
    console.error("Error in restore script:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (client) {
      await client.close();
    }
  }
}

// Execute the restore function
restoreBlockchain();
