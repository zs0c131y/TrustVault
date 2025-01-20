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
    try {
      console.log(
        "Starting property sync with data:",
        JSON.stringify(propertyData, null, 2)
      );

      const txReceipt = await this.web3.eth.getTransactionReceipt(txHash);
      const block = await this.web3.eth.getBlock(txReceipt.blockNumber);
      const blockTimestamp = Number(block.timestamp);

      // Calculate deterministic ID
      const deterministicId = this.generateDeterministicId(propertyData);

      // Check if property already exists
      const db = this.mongoClient.db(this.dbName);
      const existingProperty = await db.collection("blockchainTxns").findOne({
        $or: [
          { blockchainId: deterministicId },
          { deterministicId: deterministicId },
        ],
      });

      if (existingProperty) {
        // Update existing property
        await db.collection("blockchainTxns").updateOne(
          { deterministicId: deterministicId },
          {
            $set: {
              lastTransferDate: new Date(blockTimestamp * 1000),
            },
            $addToSet: {
              blockchainIds: propertyData.blockchainId,
            },
            $push: {
              transactions: {
                type: "RE_REGISTRATION",
                from: txReceipt.from,
                to: txReceipt.to,
                transactionHash: txHash,
                blockNumber: Number(txReceipt.blockNumber),
                timestamp: new Date(blockTimestamp * 1000),
              },
            },
          }
        );
        return existingProperty;
      }

      // Create new property document
      const propertyDoc = {
        propertyId: propertyData.propertyId,
        blockchainId: deterministicId,
        deterministicId: deterministicId,
        blockchainIds: [deterministicId],
        propertyName: propertyData.propertyName,
        location: propertyData.locality,
        propertyType: propertyData.propertyType,
        owner: propertyData.owner,
        isVerified: propertyData.isVerified,
        registrationDate: new Date(blockTimestamp * 1000),
        lastTransferDate: new Date(blockTimestamp * 1000),
        transactions: [
          {
            type: "REGISTRATION",
            from: txReceipt.from,
            to: txReceipt.to,
            transactionHash: txHash,
            blockNumber: Number(txReceipt.blockNumber),
            timestamp: new Date(blockTimestamp * 1000),
          },
        ],
      };

      await db.collection("blockchainTxns").insertOne(propertyDoc);
      return propertyDoc;
    } catch (error) {
      console.error("Error in syncPropertyToMongoDB:", error);
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
          const deterministicId = this.generateDeterministicId({
            propertyId: property.propertyId,
            propertyName: property.propertyName,
            locality: property.location,
          });

          console.log(`Processing property ${property.propertyId}`);

          // Check if property exists on chain
          let propertyExists = false;
          try {
            await this.contract.methods.getProperty(deterministicId).call();
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
                property.propertyName || "",
                property.location || "",
                property.propertyType || ""
              )
              .send({
                from: deployer,
                gas: 500000,
              });

            console.log(
              `Property registered successfully. Transaction hash: ${registerTx.transactionHash}`
            );

            // Update MongoDB with new transaction
            await db.collection("blockchainTxns").updateOne(
              { propertyId: property.propertyId },
              {
                $set: {
                  blockchainId: deterministicId,
                },
                $push: {
                  transactions: {
                    type: "RESTORATION",
                    from: deployer,
                    to: registerTx.to,
                    transactionHash: registerTx.transactionHash,
                    blockNumber: registerTx.blockNumber,
                    timestamp: new Date(),
                  },
                },
              }
            );
          }

          // Handle ownership transfer if needed
          if (property.owner) {
            let ownerAddress;

            // Check if owner is already an Ethereum address
            if (this.web3.utils.isAddress(property.owner)) {
              ownerAddress = property.owner;
            } else if (property.owner.includes("@")) {
              // If it's an email, look up the wallet address
              ownerAddress = await this.getWalletAddress(property.owner);
            }

            if (ownerAddress) {
              await this.transferOwnership(
                deterministicId,
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
