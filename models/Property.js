const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema({
  propertyId: {
    type: String,
    required: true,
    unique: true,
  },
  blockchainId: {
    type: String,
    required: true,
    unique: true,
  },
  propertyName: String,
  location: String,
  propertyType: String,
  owner: {
    type: String, // Ethereum address
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  lastTransferDate: {
    type: Date,
    default: Date.now,
  },
  transactions: [
    {
      type: {
        type: String,
        enum: ["REGISTRATION", "VERIFICATION", "TRANSFER"],
      },
      from: String,
      to: String,
      transactionHash: String,
      blockNumber: Number,
      timestamp: Date,
    },
  ],
});

module.exports = mongoose.model("Property", propertySchema, "blockchainTxns");
