const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");

class BlockchainSync {
  constructor(mongoClient, dbName) {
    try {
      this.mongoClient = mongoClient;
      this.dbName = dbName;

      this.web3 = new Web3(
        new Web3.providers.HttpProvider("http://localhost:8545")
      );

      const projectRoot = path.resolve(__dirname, "..");
      const contractsPath = path.join(projectRoot, "public/contracts");

      if (!fs.existsSync(contractsPath)) {
        console.error("Looking for contracts at:", contractsPath);
        throw new Error(
          "Contracts directory not found. Please run 'npx hardhat compile' and 'npm run deploy' first"
        );
      }

      const artifactPath = path.join(
        contractsPath,
        "contracts/PropertyRegistry.sol/PropertyRegistry.json"
      );
      const addressPath = path.join(contractsPath, "contract-address.json");

      if (!fs.existsSync(artifactPath) || !fs.existsSync(addressPath)) {
        throw new Error(
          "Contract files not found. Please run compilation and deployment first"
        );
      }

      const contractAddress = JSON.parse(
        fs.readFileSync(addressPath)
      ).PropertyRegistry;
      const contractArtifact = JSON.parse(fs.readFileSync(artifactPath));

      this.contract = new this.web3.eth.Contract(
        contractArtifact.abi,
        contractAddress
      );

      console.log("BlockchainSync initialized successfully");
      console.log("Contract Address:", contractAddress);
    } catch (error) {
      console.error("Failed to initialize BlockchainSync:", error.message);
      throw error;
    }
  }

  generateDeterministicId(propertyData) {
    const input = `${propertyData.propertyId}${propertyData.propertyName}${propertyData.locality}`;
    const hash = this.web3.utils.soliditySha3(input);
    return this.web3.utils.toChecksumAddress("0x" + hash.slice(-40));
  }

  async getWalletAddress(email) {
    try {
      const db = this.mongoClient.db(this.dbName);
      const user = await db.collection("users").findOne({ email });
      if (
        user?.walletAddress &&
        this.web3.utils.isAddress(user.walletAddress)
      ) {
        return user.walletAddress;
      }
      return null;
    } catch (error) {
      console.error("Error fetching wallet address:", error);
      return null;
    }
  }

  async syncPropertyToMongoDB(propertyData, txHash) {
    console.log("🔍 BLOCKCHAIN SYNC: Starting property sync with data:", {
      propertyId: propertyData.propertyId,
      blockchainId: propertyData.blockchainId,
      locality: propertyData.locality,
      txHash: txHash,
    });

    try {
      // Initial validation
      if (
        !propertyData ||
        !propertyData.locality ||
        !propertyData.blockchainId
      ) {
        console.error("🚨 Missing required fields:", propertyData);
        throw new Error("Locality and blockchainId are required");
      }

      const locality = propertyData.locality.trim();
      if (!locality) {
        throw new Error("Locality cannot be empty");
      }

      // Validate blockchainId format
      if (!this.web3.utils.isAddress(propertyData.blockchainId)) {
        console.error(
          "🚨 Invalid blockchain ID format:",
          propertyData.blockchainId
        );
        throw new Error("Invalid blockchain ID format");
      }

      console.log("🔍 BLOCKCHAIN SYNC: Input validation passed");

      // Validate transaction hash
      if (!txHash || typeof txHash !== "string") {
        throw new Error("Invalid transaction hash provided");
      }

      // Get transaction receipt
      const txReceipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!txReceipt) {
        throw new Error("Transaction receipt not found");
      }

      console.log("🔍 BLOCKCHAIN SYNC: Transaction receipt found:", {
        from: txReceipt.from,
        to: txReceipt.to,
        blockNumber: txReceipt.blockNumber,
      });

      // Get block data
      const block = await this.web3.eth.getBlock(txReceipt.blockNumber);
      if (!block) {
        throw new Error("Block not found");
      }

      const blockTimestamp = Number(block.timestamp);
      const db = this.mongoClient.db(this.dbName);

      // Check if property already exists with different blockchain ID
      const existingProperty = await db.collection("blockchainTxns").findOne({
        $or: [
          { propertyId: propertyData.propertyId },
          { "blockchainIds.id": propertyData.blockchainId },
        ],
      });

      // Create or update blockchainIds array
      const blockchainIds = existingProperty?.blockchainIds || [];
      const newBlockchainId = {
        id: propertyData.blockchainId,
        txHash: txHash,
        timestamp: new Date(blockTimestamp * 1000),
      };

      if (
        !blockchainIds.some((entry) => entry.id === propertyData.blockchainId)
      ) {
        blockchainIds.push(newBlockchainId);
      }

      // Create property document
      const propertyDoc = {
        propertyId: propertyData.propertyId,
        currentBlockchainId: propertyData.blockchainId,
        blockchainIds: blockchainIds,
        propertyName: propertyData.propertyName || "Name not specified",
        locality: locality,
        propertyType: propertyData.propertyType || "Type not specified",
        owner: propertyData.owner,
        isVerified: propertyData.isVerified || false,
        registrationDate:
          existingProperty?.registrationDate || new Date(blockTimestamp * 1000),
        lastTransferDate: new Date(blockTimestamp * 1000),
        transactions: [
          ...(existingProperty?.transactions || []),
          {
            type: existingProperty ? "UPDATE" : "REGISTRATION",
            from: txReceipt.from,
            to: txReceipt.to,
            transactionHash: txHash,
            blockNumber: Number(txReceipt.blockNumber),
            timestamp: new Date(blockTimestamp * 1000),
            locality: locality,
            blockchainId: propertyData.blockchainId,
          },
        ],
      };

      console.log("🔍 BLOCKCHAIN SYNC: Upserting property doc:", {
        propertyId: propertyDoc.propertyId,
        currentBlockchainId: propertyDoc.currentBlockchainId,
        locality: propertyDoc.locality,
      });

      // Use upsert to handle both new properties and updates
      const upsertResult = await db
        .collection("blockchainTxns")
        .updateOne(
          { propertyId: propertyData.propertyId },
          { $set: propertyDoc },
          { upsert: true }
        );

      // Create indices for efficient querying
      await db
        .collection("blockchainTxns")
        .createIndex({ "blockchainIds.id": 1 });
      await db
        .collection("blockchainTxns")
        .createIndex({ "transactions.transactionHash": 1 });

      // Verify the upsert
      const verifyDoc = await db
        .collection("blockchainTxns")
        .findOne({ propertyId: propertyData.propertyId });
      console.log("🔍 BLOCKCHAIN SYNC: Verification of upserted doc:", {
        propertyId: verifyDoc.propertyId,
        currentBlockchainId: verifyDoc.currentBlockchainId,
        blockchainIds: verifyDoc.blockchainIds,
        locality: verifyDoc.locality,
      });

      return propertyDoc;
    } catch (error) {
      console.error("🚨 Error in syncPropertyToMongoDB:", error);
      console.error("🚨 Error details:", {
        message: error.message,
        stack: error.stack,
        propertyData: JSON.stringify(propertyData, null, 2),
        txHash: txHash,
      });
      throw error;
    }
  }

  async restoreBlockchainState() {
    try {
      console.log("Starting blockchain state restoration...");
      const db = this.mongoClient.db(this.dbName);
      const properties = await db
        .collection("blockchainTxns")
        .find({})
        .toArray();
      const accounts = await this.web3.eth.getAccounts();
      const deployer = accounts[0];

      console.log(`Found ${properties.length} properties to restore`);

      for (const property of properties) {
        try {
          console.log(`Processing property ${property.propertyId}`);

          // Generate new blockchain ID
          const newBlockchainId = this.generateDeterministicId(property);

          // Check if property exists on chain using current blockchain ID
          let propertyExists = false;
          try {
            await this.contract.methods.getProperty(newBlockchainId).call();
            propertyExists = true;
            console.log(
              `Property ${property.propertyId} already exists on chain`
            );
          } catch (e) {
            propertyExists = false;
          }

          if (!propertyExists) {
            console.log(`Registering property ${property.propertyId}`);
            const registerTx = await this.contract.methods
              .registerProperty(
                property.propertyId,
                property.propertyName || "Name not specified",
                property.locality || "Locality not specified",
                property.propertyType || "Type not specified"
              )
              .send({
                from: deployer,
                gas: 500000,
              });

            // Update MongoDB with new blockchain ID and transaction
            await db.collection("blockchainTxns").updateOne(
              { propertyId: property.propertyId },
              {
                $set: { currentBlockchainId: newBlockchainId },
                $push: {
                  blockchainIds: {
                    id: newBlockchainId,
                    txHash: registerTx.transactionHash,
                    timestamp: new Date(),
                  },
                  transactions: {
                    type: "RESTORATION",
                    from: deployer,
                    to: registerTx.to,
                    transactionHash: registerTx.transactionHash,
                    blockNumber: registerTx.blockNumber,
                    timestamp: new Date(),
                    locality: property.locality,
                    blockchainId: newBlockchainId,
                  },
                },
              }
            );

            console.log(
              `Property registered successfully. Transaction hash: ${registerTx.transactionHash}`
            );
          }

          // Handle ownership transfer if needed
          if (property.owner) {
            let ownerAddress;

            if (this.web3.utils.isAddress(property.owner)) {
              ownerAddress = property.owner;
            } else if (property.owner.includes("@")) {
              ownerAddress = await this.getWalletAddress(property.owner);
            }

            if (ownerAddress) {
              await this.transferOwnership(
                newBlockchainId,
                ownerAddress,
                deployer
              );
            } else {
              console.log(
                `No valid wallet address found for owner: ${property.owner}`
              );
            }
          }
        } catch (error) {
          console.error(
            `Error processing property ${property.propertyId}:`,
            error
          );
        }
      }

      console.log("Blockchain state restoration complete");
    } catch (error) {
      console.error("Error in blockchain state restoration:", error);
      throw error;
    }
  }

  async transferOwnership(propertyId, newOwner, deployer) {
    try {
      const property = await this.contract.methods
        .getProperty(propertyId)
        .call();
      if (property.owner.toLowerCase() !== newOwner.toLowerCase()) {
        await this.contract.methods
          .transferOwnership(propertyId, newOwner)
          .send({
            from: deployer,
            gas: 200000,
          });
        console.log(`Ownership transferred to ${newOwner}`);
      }
    } catch (error) {
      console.error("Error in ownership transfer:", error);
      throw error;
    }
  }
}

module.exports = BlockchainSync;
