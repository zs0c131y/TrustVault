const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const path = require("path");
const multer = require("multer");
const { ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
const xss = require("xss");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const fs = require("fs");
const BlockchainSync = require("./services/BlockchainSync");

// Module-level variables
let db = null;
let blockchainSync;

// Initialize express app and environment variables
const app = express();
dotenv.config();

// Basic server configuration
const port = process.env.PORT || 3000;
const dbName = "trustvault";
let client = null;

// Security Middleware Configuration
// const developmentCSP = {
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'", "*"],
//       scriptSrc: [
//         "'self'",
//         "'unsafe-inline'",
//         "'unsafe-eval'",
//         "https://www.gstatic.com",
//         "https://*.googleapis.com",
//         "https://*.firebaseio.com",
//         "https://*.firebaseapp.com",
//         "https://cdnjs.cloudflare.com", // Added this
//       ],
//       scriptSrcAttr: ["'unsafe-inline'"],
//       scriptSrcElem: [
//         "'self'",
//         "'unsafe-inline'",
//         "https://www.gstatic.com",
//         "https://*.googleapis.com",
//         "https://cdnjs.cloudflare.com", // Added this
//       ],
//       styleSrc: [
//         "'self'",
//         "'unsafe-inline'",
//         "https://fonts.googleapis.com",
//         "https://*.gstatic.com",
//       ],
//       styleSrcElem: [
//         "'self'",
//         "'unsafe-inline'",
//         "https://fonts.googleapis.com",
//         "https://*.gstatic.com",
//       ],
//       connectSrc: [
//         "'self'",
//         "*",
//         "https://*.googleapis.com",
//         "https://*.firebaseio.com",
//         "https://*.firebase.com",
//         "https://*.firebaseapp.com",
//       ],
//       imgSrc: ["'self'", "data:", "blob:", "*"],
//       fontSrc: [
//         "'self'",
//         "https://fonts.gstatic.com",
//         "https://*.gstatic.com",
//         "*",
//       ],
//       frameSrc: ["'self'", "*"],
//       objectSrc: ["'none'"],
//       mediaSrc: ["'self'"],
//       workerSrc: ["'self'", "blob:"],
//       childSrc: ["'self'", "blob:"],
//       formAction: ["'self'"],
//       baseUri: ["'self'"],
//     },
//     reportOnly: true,
//   },
//   crossOriginEmbedderPolicy: false,
//   crossOriginResourcePolicy: { policy: "cross-origin" },
// };

// const productionCSP = {
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: [
//         "'self'",
//         "https://www.gstatic.com",
//         "https://*.googleapis.com",
//         "https://*.firebaseio.com",
//         "https://*.firebaseapp.com",
//         "https://cdnjs.cloudflare.com", // Added this
//       ],
//       styleSrc: ["'self'", "'unsafe-inline'"],
//       connectSrc: ["'self'", "https://*.firebaseio.com"],
//       imgSrc: ["'self'", "data:", "https:"],
//       fontSrc: ["'self'", "https://fonts.gstatic.com"],
//       frameSrc: ["'self'"],
//       objectSrc: ["'none'"],
//       mediaSrc: ["'self'"],
//       workerSrc: ["'self'", "blob:"],
//       childSrc: ["'self'", "blob:"],
//       formAction: ["'self'"],
//       baseUri: ["'self'"],
//       upgradeInsecureRequests: [],
//     },
//   },
//   crossOriginEmbedderPolicy: true,
//   crossOriginResourcePolicy: { policy: "same-origin" },
// };

// // Apply different configurations based on environment
// app.use(
//   helmet(
//     process.env.NODE_ENV === "development" ? developmentCSP : productionCSP
//   )
// );

// Rate limiting configuration
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per window
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: "Too many requests from this IP, please try again later",
// });

// const loginLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 5, // 5 failed attempts per hour
//   message: "Too many login attempts, please try again later",
// });

// Apply rate limiting
// app.use("/api/", apiLimiter);
// app.use("/login", loginLimiter);

// CORS Configuration
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Device-ID",
      "X-Environment",
      "Origin",
      "Accept",
    ],
    exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
  })
);

// Add OPTIONS handling for preflight requests
app.options("*", cors());

// Body parser configuration
app.use(bodyParser.json({ limit: "10kb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10kb" }));

// Serve static files
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    setHeaders: (res, path) => {
      res.set("X-Content-Type-Options", "nosniff");
      res.set("X-Frame-Options", "SAMEORIGIN");
      res.set("X-XSS-Protection", "1; mode=block");

      if (path.endsWith(".html")) {
        res.set("Cache-Control", "no-cache");
      } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
        res.set("Cache-Control", "public, max-age=86400");
      } else if (path.match(/\.(css|js)$/)) {
        res.set("Cache-Control", "public, max-age=31536000");
      }
    },
  })
);

// File upload configuration
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "-");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 7,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error("Invalid file type"), false);
      return;
    }
    cb(null, true);
  },
});

// JWT Token Verification Middleware
const enhancedVerifyToken = async (req, res, next) => {
  try {
    console.log("Token verification started");
    console.log("Incoming headers:", req.headers);

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("No authorization header");
      return res
        .status(401)
        .json({ error: "No authorization header provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log("No token in authorization header");
      return res
        .status(401)
        .json({ error: "No token provided in authorization header" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Token verified for user:", decoded.email);
    } catch (jwtError) {
      console.log("JWT verification failed:", jwtError.message);
      return res.status(401).json({
        error: "Invalid token",
        details:
          process.env.NODE_ENV === "development" ? jwtError.message : undefined,
      });
    }

    // Check if token is invalidated
    const invalidated = await db
      .collection("invalidatedTokens")
      .findOne({ token });
    if (invalidated) {
      console.log("Token has been invalidated");
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    // Device session verification with auto-creation
    const deviceId = req.headers["x-device-id"];
    if (deviceId) {
      // Look for existing session without token match
      let session = await db.collection("deviceSessions").findOne({
        userId: decoded.email,
        "deviceInfo.deviceId": deviceId,
      });

      if (!session) {
        // Create new session if none exists
        session = {
          userId: decoded.email,
          deviceInfo: {
            deviceId: deviceId,
            platform: req.headers["user-agent"] || "unknown",
          },
          token: token,
          createdAt: new Date(),
          lastActive: new Date(),
        };
        await db.collection("deviceSessions").insertOne(session);
        console.log("Created new device session for:", deviceId);
      } else {
        // Update existing session with new token
        await db.collection("deviceSessions").updateOne(
          { _id: session._id },
          {
            $set: {
              token: token,
              lastActive: new Date(),
            },
          }
        );
        console.log("Updated device session for:", deviceId);
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({
      error: "Authentication failed",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to safely convert blockchain data
function serializeBlockchainData(data) {
  return {
    owner: data.owner,
    isVerified: data.isVerified,
    lastTransferDate: data.lastTransferDate.toString(),
    propertyId: data.propertyId,
    propertyName: data.propertyName,
    location: data.location,
    propertyType: data.propertyType,
    registrationDate: data.registrationDate.toString(),
  };
}

// Search status by txnHash
app.get("/api/property/search-by-hash/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    console.log("Searching for property with transaction hash:", hash);

    // Search in blockchainTxns collection for the hash in either arrays
    const property = await db.collection("blockchainTxns").findOne({
      $or: [
        { "transactions.transactionHash": hash },
        { "blockchainIds.txHash": hash },
      ],
    });

    if (!property) {
      console.log("No property found with hash:", hash);
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Get the current blockchain ID from the document
    const currentBlockchainId = property.currentBlockchainId;
    if (!currentBlockchainId) {
      return res.status(404).json({
        success: false,
        error: "Current blockchain ID not found",
      });
    }

    // Get current blockchain status using currentBlockchainId
    let blockchainData = null;
    try {
      blockchainData = await blockchainSync.contract.methods
        .properties(currentBlockchainId)
        .call();

      console.log(
        "Retrieved blockchain data for current ID:",
        currentBlockchainId
      );
    } catch (err) {
      console.error("Error fetching blockchain data:", err);
    }

    // Convert any BigInt values to strings in property transactions
    const serializedProperty = {
      ...property,
      transactions: property.transactions.map((tx) => ({
        ...tx,
        blockNumber: tx.blockNumber ? tx.blockNumber.toString() : null,
      })),
    };

    const response = {
      success: true,
      data: {
        ...serializedProperty,
        currentBlockchainStatus: blockchainData
          ? serializeBlockchainData(blockchainData)
          : null,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error searching property by hash:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Search by blockchain ID
app.get(
  "/api/property/search-by-blockchain-id/:blockchainId",
  async (req, res) => {
    try {
      const { blockchainId } = req.params;
      console.log("Searching for property with blockchain ID:", blockchainId);

      // Search for the blockchain ID in either currentBlockchainId or blockchainIds array
      const property = await db.collection("blockchainTxns").findOne({
        $or: [
          { currentBlockchainId: blockchainId },
          {
            blockchainIds: {
              $elemMatch: {
                id: blockchainId,
              },
            },
          },
        ],
      });

      if (!property) {
        console.log("No property found with blockchain ID:", blockchainId);
        return res.status(404).json({
          success: false,
          error: "Property not found",
        });
      }

      // Get current blockchain status using currentBlockchainId
      let blockchainData = null;
      try {
        blockchainData = await blockchainSync.contract.methods
          .properties(property.currentBlockchainId)
          .call();

        console.log(
          "Retrieved blockchain data for current ID:",
          property.currentBlockchainId
        );
      } catch (err) {
        console.error("Error fetching blockchain data:", err);
      }

      // Convert any BigInt values to strings in property transactions
      const serializedProperty = {
        ...property,
        transactions: property.transactions.map((tx) => ({
          ...tx,
          blockNumber: tx.blockNumber ? tx.blockNumber.toString() : null,
        })),
      };

      const response = {
        success: true,
        data: {
          ...serializedProperty,
          currentBlockchainStatus: blockchainData
            ? serializeBlockchainData(blockchainData)
            : null,
        },
      };

      return res.json(response);
    } catch (error) {
      console.error("Error searching property by blockchain ID:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

app.use("/api", enhancedVerifyToken);

// Input Sanitization Middleware
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = xss(req.body[key].trim());
      }
    });
  }
  next();
};

// Database connection
async function connectToMongoDB() {
  try {
    client = new MongoClient(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: process.env.NODE_ENV === "development",
    });
    await client.connect();
    console.log("Connected to MongoDB successfully");
    db = client.db(dbName);
    return client;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

// Add database middleware
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Debug route
// Add this before your routes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  if (process.env.NODE_ENV === "development") {
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Add error logging middleware
app.use((err, req, res, next) => {
  console.error("Error occurred:", {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// Serve home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "./public/home.html"));
});

// Internal routing - Metamask RPC proxy
app.post("/", async (req, res) => {
  try {
    const response = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("RPC Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Authentication Routes
app.post("/login", async (req, res) => {
  try {
    const { email, name, firebaseUID } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const token = jwt.sign(
      { email, name, firebaseUID },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Authentication successful",
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

app.post("/logout", enhancedVerifyToken, async (req, res) => {
  try {
    // Optional: Add token to blacklist in database
    try {
      const db = client.db(dbName);
      await db.collection("invalidatedTokens").insertOne({
        token: req.token,
        invalidatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error storing invalidated token:", error);
    }

    res.status(200).json({
      message: "Logged out successfully",
      clearToken: true,
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

app.get("/checkAuth", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    console.error("No token provided");
    return res.status(401).json({
      authenticated: false,
      message: "No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({
      authenticated: true,
      user: decoded,
    });
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({
      authenticated: false,
      message: "Invalid token",
    });
  }
});

app.get("/getUserData", enhancedVerifyToken, async (req, res) => {
  try {
    const db = client.db(dbName);
    const users = db.collection("users");
    const user = await users.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      name: user.name || req.user.name,
      email: user.email,
    });
  } catch (error) {
    console.error("Get user data error:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Route to register property
app.post(
  "/api/register-property",
  enhancedVerifyToken,
  sanitizeInput,
  upload.fields([
    { name: "saleDeed", maxCount: 1 },
    { name: "taxReceipts", maxCount: 1 },
    { name: "encumbrance", maxCount: 1 },
    { name: "occupancy", maxCount: 1 },
    { name: "buildingPlan", maxCount: 1 },
    { name: "powerAttorney", maxCount: 1 },
    { name: "photoCertificate", maxCount: 1 },
  ]),
  async (req, res) => {
    console.log("Starting property registration process...");
    try {
      const db = client.db(dbName);
      const registrations = db.collection("registrationRequests");

      let ownerInfo,
        propertyInfo,
        witnessInfo,
        appointmentInfo,
        registrationType;
      try {
        ownerInfo = JSON.parse(req.body.ownerInfo);
        propertyInfo = JSON.parse(req.body.propertyInfo);
        witnessInfo = JSON.parse(req.body.witnessInfo);
        appointmentInfo = JSON.parse(req.body.appointmentInfo);
        registrationType = "new_registration";

        console.log("Parsed registration data:", {
          propertyInfo: { ...propertyInfo, sensitiveData: "[REDACTED]" },
          ownerInfo: { ...ownerInfo, sensitiveData: "[REDACTED]" },
        });
      } catch (error) {
        console.error("JSON parsing error:", error);
        return res.status(400).json({
          error: "Invalid JSON data",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }

      // Process uploaded documents
      const documents = {};
      if (req.files) {
        Object.keys(req.files).forEach((key) => {
          documents[key] = req.files[key][0].path;
        });
      }

      // Create registration request
      const registration = {
        ownerInfo,
        propertyInfo,
        witnessInfo,
        appointmentInfo,
        registrationType,
        documents,
        status: "pending",
        createdAt: new Date(),
        createdBy: req.user.email,
        lastModified: new Date(),
        ipAddress: req.ip,
      };

      // Save registration request
      console.log("Saving registration request...");
      const result = await registrations.insertOne(registration);
      console.log("Registration saved with ID:", result.insertedId);

      // Handle blockchain synchronization
      if (propertyInfo.blockchainId && propertyInfo.transactionHash) {
        console.log("🔍 REGISTRATION: Received property data:", {
          propertyId: propertyInfo.propertyId,
          blockchainId: propertyInfo.blockchainId,
          transactionHash: propertyInfo.transactionHash,
        });
        console.log("Initiating blockchain sync with data:", {
          blockchainId: propertyInfo.blockchainId,
          transactionHash: propertyInfo.transactionHash,
        });

        try {
          const propertyDataForSync = {
            propertyId: propertyInfo.propertyId,
            blockchainId: propertyInfo.blockchainId,
            propertyName: propertyInfo.propertyName || "Property",
            locality: propertyInfo.locality || "Not specified",
            propertyType: propertyInfo.propertyType || "residential",
            owner: ownerInfo.walletAddress || ownerInfo.email,
            isVerified: false,
          };

          console.log(
            "🔍 REGISTRATION: Property data prepared for blockchain sync:",
            {
              propertyId: propertyDataForSync.propertyId,
              blockchainId: propertyDataForSync.blockchainId,
              locality: propertyDataForSync.locality,
            }
          );

          const syncResult = await blockchainSync.syncPropertyToMongoDB(
            propertyDataForSync,
            propertyInfo.transactionHash
          );

          console.log("Blockchain sync completed:", syncResult);
        } catch (syncError) {
          console.error("Blockchain sync failed:", syncError);
          // Don't fail the registration if sync fails
        }
      } else {
        console.log("Skipping blockchain sync - missing required data:", {
          hasBlockchainId: !!propertyInfo.blockchainId,
          hasTransactionHash: !!propertyInfo.transactionHash,
        });
      }

      // Create audit log entry
      console.log("Creating audit log entry...");
      await db.collection("auditLog").insertOne({
        action: "PROPERTY_REGISTRATION",
        userId: req.user.email,
        registrationId: result.insertedId,
        timestamp: new Date(),
        ipAddress: req.ip,
        blockchainData: propertyInfo.blockchainId
          ? {
              blockchainId: propertyInfo.blockchainId,
              transactionHash: propertyInfo.transactionHash,
            }
          : undefined,
      });

      // Send success response
      res.status(201).json({
        message: "Registration request submitted successfully",
        registrationId: result.insertedId,
        blockchainSync: propertyInfo.blockchainId ? "completed" : "skipped",
      });
    } catch (error) {
      console.error("Registration error:", error);
      console.error("Full error details:", {
        message: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        message: "Failed to submit registration request",
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      });
    }
  }
);

app.post(
  "/api/transfer-property",
  enhancedVerifyToken,
  sanitizeInput,
  upload.fields([
    { name: "saleDeed", maxCount: 1 },
    { name: "taxReceipts", maxCount: 1 },
    { name: "encumbrance", maxCount: 1 },
    { name: "occupancy", maxCount: 1 },
    { name: "buildingPlan", maxCount: 1 },
    { name: "powerAttorney", maxCount: 1 },
    { name: "photoCertificate", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const db = client.db(dbName);
      const transferRequests = db.collection("transferRequests");
      const properties = db.collection("properties");

      // Parse JSON data from form
      let currentOwnerInfo,
        newOwnerInfo,
        propertyInfo,
        witnessInfo,
        appointmentInfo,
        blockchainInfo;
      try {
        currentOwnerInfo = JSON.parse(req.body.currentOwnerInfo);
        newOwnerInfo = JSON.parse(req.body.newOwnerInfo);
        propertyInfo = JSON.parse(req.body.propertyInfo);
        witnessInfo = JSON.parse(req.body.witnessInfo);
        appointmentInfo = JSON.parse(req.body.appointmentInfo);
        blockchainInfo = JSON.parse(req.body.blockchainInfo);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid JSON data",
          details: error.message,
        });
      }

      // Process uploaded documents
      const documents = {};
      if (req.files) {
        Object.keys(req.files).forEach((key) => {
          documents[key] = req.files[key][0].path;
        });
      }

      // Validate blockchain info
      if (!blockchainInfo.transactionHash || !blockchainInfo.blockchainId) {
        return res.status(400).json({
          error: "Missing blockchain transaction details",
        });
      }

      // Create transfer request record
      const transferRequest = {
        currentOwnerInfo,
        newOwnerInfo,
        propertyInfo,
        witnessInfo,
        appointmentInfo,
        blockchainInfo,
        documents,
        status: "pending",
        registrationType: "transfer",
        createdAt: new Date(),
        createdBy: req.user.email,
        lastModified: new Date(),
        ipAddress: req.ip,
      };

      // Insert transfer request
      const result = await transferRequests.insertOne(transferRequest);

      // Update property ownership in properties collection
      const propertyUpdate = await properties.updateOne(
        { blockchainId: blockchainInfo.blockchainId },
        {
          $set: {
            currentOwner: newOwnerInfo,
            lastTransferDate: new Date(blockchainInfo.transferDate * 1000), // Convert from Unix timestamp
            lastTransferHash: blockchainInfo.transactionHash,
            lastModified: new Date(),
          },
          $push: {
            ownershipHistory: {
              owner: currentOwnerInfo,
              transferDate: new Date(blockchainInfo.transferDate * 1000),
              transactionHash: blockchainInfo.transactionHash,
            },
          },
        },
        { upsert: false }
      );

      if (propertyUpdate.matchedCount === 0) {
        // If property doesn't exist, create it
        await properties.insertOne({
          blockchainId: blockchainInfo.blockchainId,
          currentOwner: newOwnerInfo,
          propertyDetails: propertyInfo,
          lastTransferDate: new Date(blockchainInfo.transferDate * 1000),
          lastTransferHash: blockchainInfo.transactionHash,
          createdAt: new Date(),
          lastModified: new Date(),
          ownershipHistory: [
            {
              owner: currentOwnerInfo,
              transferDate: new Date(blockchainInfo.transferDate * 1000),
              transactionHash: blockchainInfo.transactionHash,
            },
          ],
        });
      }

      // Add audit log entry
      await db.collection("auditLog").insertOne({
        action: "PROPERTY_TRANSFER",
        userId: req.user.email,
        transferRequestId: result.insertedId,
        blockchainId: blockchainInfo.blockchainId,
        transactionHash: blockchainInfo.transactionHash,
        previousOwner: currentOwnerInfo.email,
        newOwner: newOwnerInfo.email,
        timestamp: new Date(),
        ipAddress: req.ip,
      });

      // Send notifications if needed
      try {
        // Assuming you have a notification service
        await sendTransferNotifications({
          currentOwnerEmail: currentOwnerInfo.email,
          newOwnerEmail: newOwnerInfo.email,
          propertyId: propertyInfo.propertyId,
          transactionHash: blockchainInfo.transactionHash,
        });
      } catch (notificationError) {
        console.error("Notification error:", notificationError);
        // Don't fail the transfer if notifications fail
      }

      res.status(201).json({
        message: "Property transfer request submitted successfully",
        requestId: result.insertedId,
        blockchainId: blockchainInfo.blockchainId,
        transactionHash: blockchainInfo.transactionHash,
      });
    } catch (error) {
      console.error("Property transfer error:", error);
      res.status(500).json({
        message: "Failed to submit transfer request",
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      });
    }
  }
);

app.get("/api/registrations/:propertyId", async (req, res) => {
  try {
    if (!db) {
      throw new Error("Database connection not available");
    }

    const collection = db.collection("registrationRequests");
    const propertyId = req.params.propertyId;

    console.log("Looking up property:", propertyId);

    // Try to find the property using different possible field names
    const property = await collection.findOne(
      {
        $or: [
          { "propertyInfo.propertyId": propertyId },
          { "propertyInfo.pid": propertyId },
          { pid: propertyId },
        ],
      },
      {
        projection: {
          "propertyInfo.blockchainId": 1,
          "propertyInfo.pid": 1,
          blockchainId: 1,
        },
      }
    );

    console.log("Query result:", property);

    if (!property) {
      // If not found in registrationRequests, try the properties collection
      const propertiesCollection = db.collection("properties");
      const propertyInMain = await propertiesCollection.findOne({
        $or: [
          { pid: propertyId },
          { "propertyDetails.propertyId": propertyId },
        ],
      });

      if (propertyInMain) {
        return res.status(200).json({
          status: 200,
          propertyInfo: {
            blockchainId: propertyInMain.blockchainId,
          },
        });
      }

      return res.status(404).json({
        status: 404,
        error: "Property not found",
        searchedId: propertyId,
      });
    }

    // Extract blockchainId from wherever it might be in the document structure
    const blockchainId =
      property.propertyInfo?.blockchainId ||
      property.blockchainId ||
      (property.propertyInfo?.pid ? `0x${property.propertyInfo.pid}` : null);

    if (!blockchainId) {
      return res.status(404).json({
        status: 404,
        error: "Blockchain ID not found for property",
        searchedId: propertyId,
      });
    }

    res.status(200).json({
      status: 200,
      propertyInfo: { blockchainId },
    });
  } catch (error) {
    console.error("Error fetching blockchain ID:", error);
    res.status(500).json({
      status: 500,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Property search route
app.get("/api/property/search", express.json(), async (req, res) => {
  console.log("Property search request received");
  console.log("Auth header:", req.headers.authorization);
  console.log("Device ID:", req.headers["x-device-id"]);
  console.log("Search params:", req.query);

  try {
    // Verify token first
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log("No token provided in search request");
      return res.status(401).json({ error: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Token verified successfully:", decoded.email);
    } catch (jwtError) {
      console.log("Token verification failed:", jwtError.message);
      return res.status(401).json({ error: "Invalid token" });
    }

    const { mainSearch, city, propertyId } = req.query;

    // Build the query object
    let query = {};
    const searchConditions = [];

    if (mainSearch) {
      searchConditions.push({ property_name: new RegExp(mainSearch, "i") });
    }

    if (city) {
      searchConditions.push({ city: new RegExp(city, "i") });
    }

    if (propertyId) {
      searchConditions.push({ pid: new RegExp(propertyId, "i") });
    }

    if (searchConditions.length > 0) {
      query.$or = searchConditions;
    }

    console.log("MongoDB query:", JSON.stringify(query, null, 2));

    const properties = await db
      .collection("properties")
      .find(query)
      .limit(50)
      .toArray();

    console.log(`Found ${properties.length} properties`);

    res.json({
      properties: properties || [],
      count: properties.length,
    });
  } catch (error) {
    console.error("Property search error:", error);
    res.status(500).json({
      error: "Failed to search properties",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Single property details - No Auth
app.get("/api/property/:pid", async (req, res) => {
  try {
    const pid = req.params.pid;
    console.log("Fetching property details for PID:", pid);

    const property = await db.collection("properties").findOne({ pid: pid });

    if (!property) {
      console.log("No property found with PID:", pid);
      return res.status(404).json({
        error: "Property not found",
        pid: pid,
      });
    }

    console.log("Found property:", property.pid);
    res.json(property);
  } catch (error) {
    console.error("Property fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch property data",
      details: error.message,
    });
  }
});

// User Routes
app.post("/users", sanitizeInput, async (req, res) => {
  try {
    const db = client.db(dbName);
    const users = db.collection("users");
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    const existingUser = await users.findOne({ email });
    if (!existingUser) {
      await users.insertOne({
        email,
        name,
        createdAt: new Date(),
        lastModified: new Date(),
        status: "active",
      });
    }

    res.status(200).json({ message: "User data saved successfully" });
  } catch (error) {
    console.error("User save error:", error);
    res.status(500).json({ error: "Failed to save user data" });
  }
});

// Token sync endpoint
app.post("/api/auth/sync", enhancedVerifyToken, async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const token = req.headers.authorization?.split(" ")[1];

    await db.collection("deviceSessions").updateOne(
      {
        userId: req.user.email,
        deviceId: deviceInfo.deviceId,
      },
      {
        $set: {
          token,
          deviceInfo,
          lastActive: new Date(),
          lastSync: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ message: "Token synced successfully" });
  } catch (error) {
    console.error("Token sync error:", error);
    res.status(500).json({ error: "Failed to sync token" });
  }
});

// Token refresh endpoint
app.post("/api/auth/refresh", enhancedVerifyToken, async (req, res) => {
  try {
    const oldToken = req.headers.authorization?.split(" ")[1];
    const { deviceInfo } = req.body;

    // Check device session
    const session = await db.collection("deviceSessions").findOne({
      userId: req.user.email,
      "deviceInfo.deviceId": deviceInfo.deviceId,
    });

    if (!session) {
      return res.status(401).json({ error: "Invalid device session" });
    }

    // Generate new token
    const newToken = jwt.sign(
      {
        email: req.user.email,
        name: req.user.name,
        firebaseUID: req.user.firebaseUID,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Update device session
    await db.collection("deviceSessions").updateOne(
      { _id: session._id },
      {
        $set: {
          token: newToken,
          lastActive: new Date(),
          lastRefresh: new Date(),
        },
      }
    );

    // Store old token as invalid
    await db.collection("invalidatedTokens").insertOne({
      token: oldToken,
      userId: req.user.email,
      invalidatedAt: new Date(),
      reason: "refresh",
    });

    res.json({ token: newToken });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

// Token invalidation endpoint
app.post("/api/auth/invalidate", enhancedVerifyToken, async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const { deviceId } = req.body;

    // Remove device session
    await db.collection("deviceSessions").deleteOne({
      userId: req.user.email,
      "deviceInfo.deviceId": deviceId,
    });

    // Store in invalidated tokens
    await db.collection("invalidatedTokens").insertOne({
      token,
      userId: req.user.email,
      deviceId,
      invalidatedAt: new Date(),
      reason: "logout",
    });

    res.json({ message: "Token invalidated successfully" });
  } catch (error) {
    console.error("Token invalidation error:", error);
    res.status(500).json({ error: "Failed to invalidate token" });
  }
});

// Normalize the city name by removing common prefixes and trimming
function normalizeCity(city) {
  return city
    .toLowerCase()
    .replace(/\b(centra|central|east|west|north|south)\s+/g, "")
    .trim();
}

// Registrar offices endpoint
app.get("/api/registrar-offices", enhancedVerifyToken, async (req, res) => {
  try {
    const { city, date, type } = req.query;

    const validTypes = ["transfer", "registration"];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error:
          "Invalid appointment type. Allowed values are 'transfer' or 'registration'.",
      });
    }

    const appointmentType = type;

    if (!city || !date) {
      return res.status(400).json({
        error: "City and date are required parameters",
      });
    }

    // Normalize the search city
    const normalizedCity = normalizeCity(city);

    // Fetch offices using normalized city name
    const offices = await db
      .collection("registrars")
      .find({
        $or: [
          { city: new RegExp(normalizedCity, "i") },
          { normalized_city: normalizedCity }, // If you decide to store normalized city names
        ],
      })
      .project({
        name: 1,
        office_name: 1,
        area: 1,
        city: 1,
      })
      .toArray();

    if (!offices || offices.length === 0) {
      return res.status(404).json({
        error: "No sub-registrar offices found in the specified city",
      });
    }

    // Generate time slots
    const timeSlots = generateTimeSlots();

    // Get existing appointments for the date
    const selectedDate = new Date(date);
    const appointments = await db
      .collection("appointments")
      .find({
        officeId: {
          $in: offices.map((office) => new ObjectId(office._id.toString())),
        },
        appointmentDate: {
          $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
          $lt: new Date(selectedDate.setHours(23, 59, 59, 999)),
        },
        type: appointmentType,
        status: { $nin: ["cancelled", "completed"] },
      })
      .toArray();

    // Process each office and its available slots
    const officesWithSlots = offices.map((office) => {
      const officeAppointments = appointments.filter(
        (apt) => apt.officeId.toString() === office._id.toString() // Convert both to strings for comparison
      );

      const availableSlots = timeSlots.map((slot) => {
        const slotAppointments = officeAppointments.filter(
          (apt) => apt.timeSlot === slot.value
        );

        return {
          ...slot,
          available: slotAppointments.length < 3, // Slot is available if less than 3 appointments
          appointmentCount: slotAppointments.length,
          remainingSlots: 3 - slotAppointments.length,
        };
      });

      return {
        id: office._id,
        name: office.office_name,
        office_name: office.office_name,
        area: office.area,
        city: office.city,
        availableSlots: availableSlots,
      };
    });

    res.json({
      offices: officesWithSlots,
    });
  } catch (error) {
    console.error("Error fetching registrar offices:", error);
    res.status(500).json({
      error: "Failed to fetch sub-registrar offices",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Helper function to generate time slots
function generateTimeSlots() {
  const slots = [];
  const startHour = 9;
  const endHour = 17;

  for (let hour = startHour; hour < endHour; hour++) {
    // First half hour slot
    slots.push({
      value: `${hour.toString().padStart(2, "0")}:00`,
      label: `${hour.toString().padStart(2, "0")}:00 - ${hour
        .toString()
        .padStart(2, "0")}:30`,
    });

    // Second half hour slot
    slots.push({
      value: `${hour.toString().padStart(2, "0")}:30`,
      label: `${hour.toString().padStart(2, "0")}:30 - ${(hour + 1)
        .toString()
        .padStart(2, "0")}:00`,
    });
  }

  return slots;
}

// Create new appointment
app.post("/api/appointments", enhancedVerifyToken, async (req, res) => {
  try {
    const { officeId, officeName, date, timeSlot, type } = req.body;

    if (!officeId || !officeName || !date || !timeSlot) {
      return res.status(400).json({
        error: "Office ID, office name, date, and time slot are required",
      });
    }

    // Validate the type field and ensure it has a valid value
    const validTypes = ["transfer", "registration"];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error:
          "Invalid appointment type. Allowed values are 'transfer' or 'registration'.",
      });
    }

    // Use the valid type directly
    const appointmentType = type;

    // Check existing appointments count for this time slot and type
    const existingAppointments = await db
      .collection("appointments")
      .countDocuments({
        officeId: new ObjectId(officeId), // Make sure officeId is converted to ObjectId
        appointmentDate: new Date(date),
        timeSlot,
        type: appointmentType,
        status: { $nin: ["cancelled", "completed"] },
      });

    if (existingAppointments >= 3) {
      return res.status(409).json({
        error: `This time slot has reached maximum capacity for ${appointmentType} appointments`,
      });
    }

    // Create new appointment
    const appointment = {
      officeId: new ObjectId(officeId),
      officeName: officeName,
      userId: req.user.email,
      appointmentDate: new Date(date),
      timeSlot,
      type: appointmentType,
      status: "scheduled",
      createdAt: new Date(),
      lastModified: new Date(),
    };

    const result = await db.collection("appointments").insertOne(appointment);

    // Add audit log entry
    await db.collection("auditLog").insertOne({
      action: "APPOINTMENT_CREATED",
      userId: req.user.email,
      appointmentId: result.insertedId,
      officeId: new ObjectId(officeId),
      officeName: officeName,
      type: appointmentType,
      timestamp: new Date(),
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: "Appointment scheduled successfully",
      appointmentId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({
      error: "Failed to create appointment",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File is too large. Maximum size is 10MB",
      });
    }
    return res.status(400).json({
      error: "File upload error",
    });
  }

  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Starting graceful shutdown...");
  if (client) {
    await client.close();
    console.log("MongoDB connection closed");
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Starting graceful shutdown...");
  if (client) {
    await client.close();
    console.log("MongoDB connection closed");
  }
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    await connectToMongoDB();
    // Initialize BlockchainSync with MongoDB client
    blockchainSync = new BlockchainSync(client, dbName);

    app.listen(port, () => {
      console.log(
        `Server running on port ${port} in ${process.env.NODE_ENV} mode`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
