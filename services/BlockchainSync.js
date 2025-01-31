const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");
const Logger = require("../utils/logger");
const { prepareForLogging } = require("../utils/loggingHelper");

// Serialize BigInt values to strings for MongoDB
function serializeBigInt(obj) {
  if (obj === null || typeof obj !== "object") {
    if (typeof obj === "bigint") {
      return obj.toString();
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  const serialized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "bigint") {
      serialized[key] = value.toString();
    } else if (typeof value === "object") {
      serialized[key] = serializeBigInt(value);
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

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
        throw new Error("Contracts directory not found");
      }

      // Load both contracts
      const propertyRegistryPath = path.join(
        contractsPath,
        "contracts/PropertyRegistry.sol/PropertyRegistry.json"
      );
      const documentVerificationPath = path.join(
        contractsPath,
        "contracts/DocumentVerification.sol/DocumentVerification.json"
      );
      const addressesPath = path.join(contractsPath, "contract-addresses.json");

      if (
        !fs.existsSync(propertyRegistryPath) ||
        !fs.existsSync(documentVerificationPath) ||
        !fs.existsSync(addressesPath)
      ) {
        throw new Error("Contract files not found");
      }

      // Read contract addresses
      const addresses = JSON.parse(fs.readFileSync(addressesPath));
      const propertyContractAddress = addresses.PropertyRegistry;
      const documentContractAddress = addresses.DocumentVerification;

      if (!propertyContractAddress || !documentContractAddress) {
        throw new Error("Contract addresses not found");
      }

      // Initialize both contracts
      const propertyRegistryArtifact = JSON.parse(
        fs.readFileSync(propertyRegistryPath)
      );
      const documentVerificationArtifact = JSON.parse(
        fs.readFileSync(documentVerificationPath)
      );

      this.propertyContract = new this.web3.eth.Contract(
        propertyRegistryArtifact.abi,
        propertyContractAddress
      );
      this.documentContract = new this.web3.eth.Contract(
        documentVerificationArtifact.abi,
        documentContractAddress
      );

      Logger.success("BlockchainSync initialized successfully");
      Logger.info("PropertyRegistry Address:", propertyContractAddress);
      Logger.info("DocumentVerification Address:", documentContractAddress);
    } catch (error) {
      Logger.error("Failed to initialize BlockchainSync:", error.message);
      throw error;
    }
  }

  generateDeterministicId(propertyData) {
    const input = `${propertyData.propertyId}${propertyData.propertyName}${propertyData.locality}`;
    const hash = this.web3.utils.soliditySha3(input);
    return this.web3.utils.toChecksumAddress("0x" + hash.slice(-40));
  }

  async generateDocumentBlockchainId(docData) {
    const input = `${docData.requestId}${docData.userId}${Date.now()}`;
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
      Logger.error("Error fetching wallet address:", error);
      return null;
    }
  }

  async syncPropertyToMongoDB(propertyData, txHash) {
    const logSafeData = prepareForLogging({
      propertyId: propertyData.propertyId,
      blockchainId: propertyData.blockchainId,
      locality: propertyData.locality,
      txHash: txHash,
    });

    Logger.info(
      "🔍 BLOCKCHAIN SYNC: Starting property sync with data:",
      logSafeData
    );

    try {
      if (
        !propertyData ||
        !propertyData.locality ||
        !propertyData.blockchainId
      ) {
        throw new Error("Locality and blockchainId are required");
      }

      const locality = propertyData.locality.trim();
      if (!locality) {
        throw new Error("Locality cannot be empty");
      }

      if (!this.web3.utils.isAddress(propertyData.blockchainId)) {
        throw new Error("Invalid blockchain ID format");
      }

      if (!txHash || typeof txHash !== "string") {
        throw new Error("Invalid transaction hash provided");
      }

      const txReceipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!txReceipt) {
        throw new Error("Transaction receipt not found");
      }

      const block = await this.web3.eth.getBlock(txReceipt.blockNumber);
      if (!block) {
        throw new Error("Block not found");
      }

      const blockTimestamp = Number(block.timestamp);
      const db = this.mongoClient.db(this.dbName);

      const existingProperty = await db.collection("blockchainTxns").findOne({
        $or: [
          { propertyId: propertyData.propertyId },
          { "blockchainIds.id": propertyData.blockchainId },
        ],
      });

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

      const propertyDoc = {
        type: "PROPERTY",
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
            blockNumber: txReceipt.blockNumber.toString(),
            timestamp: new Date(blockTimestamp * 1000),
            locality: locality,
            blockchainId: propertyData.blockchainId,
          },
        ],
      };

      await db
        .collection("blockchainTxns")
        .updateOne(
          { propertyId: propertyData.propertyId },
          { $set: propertyDoc },
          { upsert: true }
        );

      await db
        .collection("blockchainTxns")
        .createIndex({ "blockchainIds.id": 1 });
      await db
        .collection("blockchainTxns")
        .createIndex({ "transactions.transactionHash": 1 });
      await db.collection("blockchainTxns").createIndex({ type: 1 });

      const verifyDoc = await db.collection("blockchainTxns").findOne({
        propertyId: propertyData.propertyId,
      });

      if (!verifyDoc) {
        throw new Error("Failed to verify upserted document");
      }

      return {
        ...propertyDoc,
        transactions: propertyDoc.transactions.map((tx) => ({
          ...tx,
          blockNumber: tx.blockNumber.toString(),
          timestamp: tx.timestamp.toISOString(),
        })),
      };
    } catch (error) {
      Logger.error("🚨 Error in syncPropertyToMongoDB:", error);
      throw error;
    }
  }

  async syncDocumentToBlockchain(docData) {
    try {
      Logger.info(
        "Starting document blockchain sync for requestId:",
        docData.requestId
      );

      const blockchainId = await this.generateDocumentBlockchainId(docData);
      const db = this.mongoClient.db(this.dbName);
      const userWalletAddress =
        (await this.getWalletAddress(docData.userId)) || docData.userId;

      await db.collection("verificationRequests").updateOne(
        { requestId: docData.requestId },
        {
          $set: {
            blockchainId: blockchainId,
            lastUpdated: new Date(),
          },
        }
      );

      const blockchainTxnDoc = {
        type: "DOCUMENT_VERIFICATION",
        requestId: docData.requestId,
        currentBlockchainId: blockchainId,
        blockchainIds: [
          {
            id: blockchainId,
            timestamp: new Date(),
          },
        ],
        owner: userWalletAddress,
        isVerified: false,
        documentType: docData.personalInfo.documentType,
        transactions: [
          {
            type: "SUBMISSION",
            timestamp: new Date(),
            blockchainId: blockchainId,
          },
        ],
      };

      await db.collection("blockchainTxns").insertOne(blockchainTxnDoc);

      await db.collection("blockchainTxns").createIndex({ type: 1 });
      await db.collection("blockchainTxns").createIndex({ requestId: 1 });
      await db
        .collection("blockchainTxns")
        .createIndex({ currentBlockchainId: 1 });

      Logger.success("Document synced to blockchain:", {
        requestId: docData.requestId,
        blockchainId: blockchainId,
      });

      return { blockchainId };
    } catch (error) {
      Logger.error("Error in document blockchain sync:", error);
      throw error;
    }
  }

  async restoreBlockchainState() {
    try {
      Logger.info("Starting blockchain state restoration...");
      const db = this.mongoClient.db(this.dbName);
      const transactions = await db
        .collection("blockchainTxns")
        .find({})
        .toArray();
      const accounts = await this.web3.eth.getAccounts();
      const deployer = accounts[0];

      Logger.info(
        `Found ${transactions.length} blockchain transactions to restore`
      );

      for (const record of transactions) {
        try {
          if (!record.currentBlockchainId) {
            Logger.warn("Skipping invalid record:", {
              id: record._id,
              hasBlockchainId: !!record.currentBlockchainId,
              type: record.type,
            });
            continue;
          }

          if (record.type === "PROPERTY") {
            await this.restoreProperty(record, deployer);
          } else if (record.type === "DOCUMENT_VERIFICATION") {
            await this.restoreDocument(record, deployer);
          }
        } catch (error) {
          Logger.error(
            `Error processing ${record.type} ${
              record.propertyId || record.requestId
            }:`,
            error
          );
        }
      }

      Logger.info("Blockchain state restoration complete");
    } catch (error) {
      Logger.error("Error in blockchain state restoration:", error);
      throw error;
    }
  }

  async restoreProperty(record, deployer) {
    Logger.info(`Processing property ${record.propertyId}`);

    let propertyExists = false;
    try {
      await this.propertyContract.methods
        .getProperty(record.currentBlockchainId)
        .call();
      propertyExists = true;
      Logger.info(`Property ${record.propertyId} already exists on chain`);
    } catch (e) {
      propertyExists = false;
    }

    if (!propertyExists && record.propertyId) {
      Logger.info(`Registering property ${record.propertyId}`);
      const registerTx = await this.propertyContract.methods
        .registerProperty(
          record.propertyId,
          record.propertyName || "Name not specified",
          record.locality || "Locality not specified",
          record.propertyType || "Type not specified"
        )
        .send({
          from: deployer,
          gas: 500000,
        });

      await this.updateTransactionRecord(record, registerTx, deployer);
      Logger.success(
        `Property registered successfully. Transaction hash: ${registerTx.transactionHash}`
      );
    }

    await this.handleOwnershipTransfer(record, deployer);
  }

  async restoreDocument(record, deployer) {
    Logger.info(`Processing document ${record.requestId}`);

    let documentExists = false;
    try {
      const documentId = this.web3.utils.soliditySha3(
        record.currentBlockchainId,
        record.requestId
      );
      await this.documentContract.methods.getDocument(documentId).call();
      documentExists = true;
      Logger.info(`Document ${record.requestId} already exists on chain`);
    } catch (e) {
      documentExists = false;
    }

    if (!documentExists && record.requestId) {
      try {
        Logger.info(`Registering document ${record.requestId}`);
        const documentId = this.web3.utils.soliditySha3(
          record.currentBlockchainId,
          record.requestId
        );

        const registerTx = await this.documentContract.methods
          .verifyDocument(
            record.currentBlockchainId,
            record.documentType || "Document",
            record.owner || deployer,
            Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
            ""
          )
          .send({
            from: deployer,
            gas: 500000,
          });

        await this.updateTransactionRecord(record, registerTx, deployer);
        Logger.success(
          `Document registered successfully. Transaction hash: ${registerTx.transactionHash}`
        );
      } catch (error) {
        Logger.error(`Error registering document:`, error);
        throw error;
      }
    }

    await this.handleOwnershipTransfer(record, deployer);
  }

  async handleOwnershipTransfer(record, deployer) {
    if (record.owner) {
      let ownerAddress;

      if (this.web3.utils.isAddress(record.owner)) {
        ownerAddress = record.owner;
      } else if (record.owner.includes("@")) {
        ownerAddress = await this.getWalletAddress(record.owner);
      }

      if (ownerAddress) {
        await this.transferOwnership(
          record.currentBlockchainId,
          ownerAddress,
          deployer
        );
      } else {
        Logger.warn(`No valid wallet address found for owner: ${record.owner}`);
      }
    }
  }

  async updateTransactionRecord(record, tx, deployer) {
    const db = this.mongoClient.db(this.dbName);
    const collection = db.collection("blockchainTxns");

    await collection.updateOne(
      { currentBlockchainId: record.currentBlockchainId },
      {
        $push: {
          transactions: {
            type: "RESTORATION",
            from: deployer,
            to: tx.to,
            transactionHash: tx.transactionHash,
            blockNumber: tx.blockNumber,
            timestamp: new Date(),
            blockchainId: record.currentBlockchainId,
          },
        },
      }
    );
  }

  async transferOwnership(propertyId, newOwner, deployer) {
    try {
      const property = await this.propertyContract.methods
        .getProperty(propertyId)
        .call();
      if (property.owner.toLowerCase() !== newOwner.toLowerCase()) {
        await this.propertyContract.methods
          .transferOwnership(propertyId, newOwner)
          .send({
            from: deployer,
            gas: 200000,
          });
        Logger.info(`Ownership transferred to ${newOwner}`);
      }
    } catch (error) {
      Logger.error("Error in ownership transfer:", error);
      throw error;
    }
  }
}

module.exports = BlockchainSync;
