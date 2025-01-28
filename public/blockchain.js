// Imports
import { PROPERTY_REGISTRY_ABI, CONTRACT_ADDRESSES } from "./web3-config.js";

// BlockahinManager Class
class BlockchainManager {
  constructor() {
    this.web3 = null;
    this.contractInstance = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  // Initialization of Web3
  async initialize() {
    if (this.initialized) return true;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        if (!window.ethereum) {
          throw new Error("Please install MetaMask to continue");
        }

        // Initialize Web3 with the ethereum provider
        this.web3 = new Web3(window.ethereum);

        // Request account access
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found. Please connect your wallet.");
        }

        // Initialize contract with the ABI and address
        this.contractInstance = new this.web3.eth.Contract(
          PROPERTY_REGISTRY_ABI,
          CONTRACT_ADDRESSES.PropertyRegistry
        );

        // Verify contract deployment
        const code = await this.web3.eth.getCode(
          CONTRACT_ADDRESSES.PropertyRegistry
        );
        if (code === "0x") {
          throw new Error("Contract not deployed at specified address");
        }

        // Set up event listeners for wallet changes
        window.ethereum.on("chainChanged", () => window.location.reload());
        window.ethereum.on("accountsChanged", () => window.location.reload());

        this.initialized = true;
        console.log("Blockchain initialized successfully");
        return true;
      } catch (error) {
        console.error("Blockchain initialization error:", error);
        this.initialized = false;
        this.web3 = null;
        this.contractInstance = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.web3 || !this.contractInstance) {
      throw new Error("Blockchain not properly initialized");
    }
  }

  async getPropertyDetailsByBlockchainId(blockchainId) {
    try {
      await this.ensureInitialized();

      console.log("Getting property details for blockchain ID:", blockchainId);

      const response = await fetch(
        `/api/property/search-by-blockchain-id/${blockchainId}`
      );
      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(
          responseData.error || "Failed to fetch property details"
        );
      }

      const currentBlockchainId = responseData.data.currentBlockchainId;
      if (!currentBlockchainId) {
        throw new Error("Current blockchain ID not found");
      }

      let blockchainData = null;
      try {
        if (!this.contractInstance.methods) {
          throw new Error("Contract methods not available");
        }
        blockchainData = await this.contractInstance.methods
          .properties(currentBlockchainId)
          .call();
      } catch (err) {
        console.error("Error fetching blockchain data:", err);
        throw err;
      }

      // First check transactions array for the most recent transaction
      const latestTransaction = responseData.data.transactions?.[0];

      // Then check blockchainIds array as fallback
      const relevantBlockchainEntry = responseData.data.blockchainIds?.find(
        (entry) => entry.id === blockchainId
      );

      // Combine transaction data, prioritizing the transactions array
      let txData = {
        transactionHash:
          latestTransaction?.hash || relevantBlockchainEntry?.txHash,
        blockNumber:
          latestTransaction?.blockNumber ||
          relevantBlockchainEntry?.blockNumber,
        timestamp:
          latestTransaction?.timestamp || relevantBlockchainEntry?.timestamp,
        from: latestTransaction?.from || relevantBlockchainEntry?.from,
        to: latestTransaction?.to || relevantBlockchainEntry?.to,
        gasUsed: latestTransaction?.gasUsed || relevantBlockchainEntry?.gasUsed,
        value:
          latestTransaction?.value || relevantBlockchainEntry?.value || "0",
        status: "Success",
      };

      // If we still don't have a transaction hash, try to get it from the transaction receipt
      if (txData.transactionHash) {
        try {
          const receipt = await this.web3.eth.getTransactionReceipt(
            txData.transactionHash
          );
          if (receipt) {
            txData.gasUsed = receipt.gasUsed;
          }
        } catch (err) {
          console.error("Error fetching transaction receipt:", err);
        }
      }

      return {
        success: true,
        data: {
          ...blockchainData,
          ...txData,
          blockchainId: currentBlockchainId,
          originalBlockchainId: responseData.data.blockchainIds[0]?.id,
          blockchainHistory: responseData.data.blockchainIds,
          transactionHistory: responseData.data.transactions,
        },
      };
    } catch (error) {
      console.error("Error in getPropertyDetailsByBlockchainId:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getPropertyDetailsByTxHash(txHash) {
    try {
      await this.ensureInitialized();
      console.log("Starting property verification for hash:", txHash);

      // First get response from our API
      const response = await fetch(`/api/property/search-by-hash/${txHash}`);
      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(
          responseData.error || "Failed to fetch property details"
        );
      }

      // Find the transaction in the history that matches our hash
      const matchingTransaction = responseData.data.transactions?.find(
        (tx) => tx.hash === txHash
      );
      console.log("Matching transaction from API:", matchingTransaction);

      // Get Web3 transaction data
      const web3Transaction = await this.web3.eth.getTransaction(txHash);
      const web3Receipt = await this.web3.eth.getTransactionReceipt(txHash);
      console.log("Web3 Transaction:", web3Transaction);
      console.log("Web3 Receipt:", web3Receipt);

      if (!web3Transaction || !web3Receipt) {
        throw new Error("Transaction not found on blockchain");
      }

      const block = await this.web3.eth.getBlock(web3Receipt.blockNumber);
      console.log("Block data:", block);

      const currentBlockchainId = responseData.data.currentBlockchainId;
      if (!currentBlockchainId) {
        throw new Error("Current blockchain ID not found");
      }

      // Get property data from blockchain
      const blockchainData = await this.contractInstance.methods
        .properties(currentBlockchainId)
        .call();

      // Helper function to safely convert BigInt to string
      const toBigIntString = (value) => {
        if (value === null || value === undefined) return null;
        return value.toString();
      };

      // Combine data from multiple sources, prioritizing Web3 data
      const txData = {
        transactionHash: txHash,
        blockNumber:
          toBigIntString(web3Receipt.blockNumber) ||
          toBigIntString(web3Transaction.blockNumber) ||
          matchingTransaction?.blockNumber,
        timestamp: block.timestamp ? Number(block.timestamp) * 1000 : null,
        from:
          web3Transaction.from || web3Receipt.from || matchingTransaction?.from,
        to: web3Transaction.to || web3Receipt.to || matchingTransaction?.to,
        gasUsed:
          toBigIntString(web3Receipt.gasUsed) || matchingTransaction?.gasUsed,
        value: this.web3.utils.fromWei(
          toBigIntString(web3Transaction.value) || "0",
          "ether"
        ),
        status: web3Receipt.status ? "Success" : "Failed",
      };

      // Log the final assembled data
      console.log("Assembled transaction data:", txData);
      console.log("API response data:", responseData.data);

      const result = {
        success: true,
        data: {
          ...blockchainData,
          ...txData,
          blockchainId: currentBlockchainId,
          originalBlockchainId: responseData.data.blockchainIds?.[0]?.id,
          blockchainHistory: responseData.data.blockchainIds || [],
          transactionHistory: responseData.data.transactions || [],
        },
      };

      return result;
    } catch (error) {
      console.error("Error in getPropertyDetailsByTxHash:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Create singleton instance
const blockchainManager = new BlockchainManager();

// Function to format verified property display
function createVerifiedProperty(propertyData) {
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      return new Date(Number(timestamp) * 1000).toLocaleDateString();
    } catch (e) {
      return "N/A";
    }
  };

  return `
    <div class="property-details">
      ${
        propertyData.isVerified
          ? "✅ Property is Verified on Blockchain"
          : "⏳ Property Registration Found - Pending Verification"
      }
    </div>
    <div class="property-card">
      <img src="./assets/defaultlandimage.png" alt="Property Image" class="property-image">
      ${
        propertyData.isVerified
          ? '<img src="./assets/verified.png" class="verification-badge">'
          : '<img src="./assets/notverified.png" class="verification-badge">'
      }
      <div class="property-title">${
        propertyData.propertyName || "Unnamed Property"
      }</div>
      <div class="address">${
        propertyData.propertyType || "Type Not Specified"
      }</div>
      <div class="address-details">${
        propertyData.location || "Location Not Specified"
      }</div>
      <div class="address-details">
        <small>Registration Date: ${formatDate(
          propertyData.registrationDate
        )}</small>
      </div>
      <div class="address-details">
        <small>Last Transfer: ${formatDate(
          propertyData.lastTransferDate
        )}</small>
      </div>
    </div>
  `;
}

// Helper function to display blockchain data
// Helper function to display blockchain data
function displayBlockchainData(txHash, propertyData, transactionData, events) {
  const container = document.getElementById("blockchainDataContainer");
  container.style.display = "block";

  // Default to property tab
  switchTab("propertyTab");

  // Property Tab Content
  const propertyTab = document.getElementById("propertyTab");
  propertyTab.innerHTML = `
    <div class="data-item">
      <div class="data-label">Property ID</div>
      <div class="data-value">${propertyData.propertyId || "N/A"}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Property Name</div>
      <div class="data-value">${propertyData.propertyName || "N/A"}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Location</div>
      <div class="data-value">${propertyData.location || "N/A"}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Property Type</div>
      <div class="data-value">${propertyData.propertyType || "N/A"}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Owner</div>
      <div class="data-value">
        ${propertyData.owner || "N/A"}
        ${
          propertyData.owner
            ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${propertyData.owner}')">Copy</button>`
            : ""
        }
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">Registration Date</div>
      <div class="data-value">${
        propertyData.registrationDate
          ? new Date(
              Number(propertyData.registrationDate) * 1000
            ).toLocaleString()
          : "N/A"
      }</div>
    </div>
    <div class="data-item">
      <div class="data-label">Verification Status</div>
      <div class="data-value">${
        propertyData.isVerified ? "✅ Verified" : "⏳ Pending Verification"
      }</div>
    </div>
  `;

  // Transaction Tab Content
  const transactionTab = document.getElementById("transactionTab");
  const timestamp = transactionData.timestamp
    ? new Date(Number(transactionData.timestamp)).toLocaleString()
    : "N/A";

  // Ensure we have string values and replace undefined/null with N/A
  const formatValue = (value) => value?.toString() || "N/A";

  transactionTab.innerHTML = `
    <div class="data-item">
      <div class="data-label">Transaction Hash</div>
      <div class="data-value">
        ${formatValue(transactionData.transactionHash)}
        ${
          transactionData.transactionHash
            ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${transactionData.transactionHash}')">Copy</button>`
            : ""
        }
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">Status</div>
      <div class="data-value">${formatValue(transactionData.status)}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Block Number</div>
      <div class="data-value">${formatValue(transactionData.blockNumber)}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Timestamp</div>
      <div class="data-value">${timestamp}</div>
    </div>
    <div class="data-item">
      <div class="data-label">From Address</div>
      <div class="data-value">
        ${formatValue(transactionData.from)}
        ${
          transactionData.from
            ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${transactionData.from}')">Copy</button>`
            : ""
        }
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">To Address (Contract)</div>
      <div class="data-value">
        ${formatValue(transactionData.to)}
        ${
          transactionData.to
            ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${transactionData.to}')">Copy</button>`
            : ""
        }
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">Gas Used</div>
      <div class="data-value">${
        transactionData.gasUsed
          ? `${formatValue(transactionData.gasUsed)} wei`
          : "N/A"
      }</div>
    </div>
    <div class="data-item">
      <div class="data-label">Value</div>
      <div class="data-value">${
        transactionData.value
          ? `${formatValue(transactionData.value)} ETH`
          : "0 ETH"
      }</div>
    </div>
  `;

  // Events Tab Content
  const eventsTab = document.getElementById("eventsTab");
  eventsTab.innerHTML = `
    <div class="event-item">
      <div class="event-name">PropertyRegistered Event</div>
      <div class="event-data">
        <div class="data-item">
          <div class="data-label">Owner</div>
          <div class="data-value">
            ${propertyData.owner || "N/A"}
            ${
              propertyData.owner
                ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${propertyData.owner}')">Copy</button>`
                : ""
            }
          </div>
        </div>
        <div class="data-item">
          <div class="data-label">Property ID</div>
          <div class="data-value">${propertyData.propertyId || "N/A"}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Blockchain ID</div>
          <div class="data-value">
            ${propertyData.blockchainId || "N/A"}
            ${
              propertyData.blockchainId
                ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${propertyData.blockchainId}')">Copy</button>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

// Tab switching functionality
function switchTab(tabName) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
    tab.style.display = "none";
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.remove("active");
  });

  const selectedTab = document.getElementById(tabName);
  selectedTab.style.display = "block";
  selectedTab.classList.add("active");

  document
    .querySelector(`button[onclick="switchTab('${tabName}')"]`)
    .classList.add("active");
}

// Main verification handler
async function handleVerification() {
  const searchInput = document.getElementById("searchInput");
  const searchValue = searchInput.value.trim();
  const errorMessage = document.getElementById("errorMessage");
  const resultContainer = document.getElementById("resultContainer");
  const verifyButton = document.getElementById("verifyButton");

  errorMessage.style.display = "none";
  resultContainer.innerHTML = "";
  document.getElementById("blockchainDataContainer").style.display = "none";

  verifyButton.disabled = true;
  verifyButton.textContent = "Verifying...";

  try {
    await blockchainManager.initialize();
    let result;

    if (searchValue.startsWith("0x")) {
      if (searchValue.length === 66) {
        result = await blockchainManager.getPropertyDetailsByTxHash(
          searchValue
        );
      } else if (searchValue.length === 42) {
        result = await blockchainManager.getPropertyDetailsByBlockchainId(
          searchValue
        );
      } else {
        throw new Error("Invalid input length");
      }

      if (!result.success) {
        throw new Error(result.error || "Failed to retrieve property details");
      }

      resultContainer.innerHTML = createVerifiedProperty(result.data);

      if (result.data) {
        const transactionData = {
          transactionHash: result.data.transactionHash,
          blockNumber: result.data.blockNumber,
          timestamp: result.data.timestamp,
          from: result.data.from,
          to: result.data.to,
          gasUsed: result.data.gasUsed,
          value: result.data.value,
          status: result.data.status,
        };

        displayBlockchainData(
          transactionData.transactionHash,
          result.data,
          transactionData,
          result.data.events || []
        );
      }
    } else {
      throw new Error("Input must start with '0x'");
    }
  } catch (error) {
    console.error("Verification error:", error);
    resultContainer.innerHTML = `
      <div class="verification-message">
        <img src="./assets/notverified.png" class="verification-icon">
        <p class="message-text">Error: ${error.message}</p>
      </div>
    `;
  } finally {
    verifyButton.disabled = false;
    verifyButton.textContent = "Verify Property";
  }
}

// Initialize page functionality
document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchInput");
  const verifyButton = document.getElementById("verifyButton");
  const errorMessage = document.getElementById("errorMessage");
  const resultContainer = document.getElementById("resultContainer");
  const backButton = document.getElementById("backButton");

  // Create connect wallet button but don't add it yet
  const connectButton = document.createElement("button");
  connectButton.textContent = "Connect Wallet";
  connectButton.className = "connect-button";

  connectButton.addEventListener("click", async () => {
    connectButton.disabled = true;
    connectButton.textContent = "Connecting...";

    try {
      await blockchainManager.initialize();
      connectButton.remove(); // Remove the button after successful connection
      verifyButton.disabled = false;
      verifyButton.style.cursor = "pointer";
      verifyButton.style.opacity = "1";
      errorMessage.style.display = "none";
    } catch (error) {
      errorMessage.textContent = error.message;
      errorMessage.style.display = "block";
    } finally {
      connectButton.disabled = false;
      connectButton.textContent = "Connect Wallet";
    }
  });

  // Add tab functionality
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", (e) => {
      const tabName = e.target.getAttribute("onclick").match(/'(.*?)'/)[1];
      switchTab(tabName);
    });
  });

  // Check if wallet is connected
  let walletConnected = false;
  try {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      walletConnected = accounts && accounts.length > 0;
    }
  } catch (error) {
    console.error("Error checking wallet connection:", error);
  }

  if (!walletConnected) {
    errorMessage.textContent =
      "Please install MetaMask and connect your wallet";
    errorMessage.style.display = "block";
    errorMessage.insertAdjacentElement("afterend", connectButton);
    verifyButton.disabled = true;
    verifyButton.style.cursor = "not-allowed";
    verifyButton.style.opacity = "0.6";
  } else {
    try {
      await blockchainManager.initialize();
    } catch (error) {
      errorMessage.textContent =
        "Failed to initialize blockchain. Please try again.";
      errorMessage.style.display = "block";
      verifyButton.disabled = true;
      verifyButton.style.cursor = "not-allowed";
      verifyButton.style.opacity = "0.6";
    }
  }

  // Event Listeners
  searchInput.addEventListener("input", (e) => {
    const value = e.target.value.trim();
    errorMessage.style.display = "none";
    verifyButton.disabled = value.length === 0 || !walletConnected;

    if (!verifyButton.disabled) {
      verifyButton.style.cursor = "pointer";
      verifyButton.style.opacity = "1";
    } else {
      verifyButton.style.cursor = "not-allowed";
      verifyButton.style.opacity = "0.6";
    }
  });

  verifyButton.addEventListener("click", handleVerification);

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !verifyButton.disabled) {
      handleVerification();
    }
  });

  backButton?.addEventListener("click", () => {
    history.back();
  });

  // Check for transaction hash in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const txHash = urlParams.get("tx");
  if (txHash) {
    searchInput.value = txHash;
    if (walletConnected) {
      handleVerification();
    }
  }
});

export {
  blockchainManager as default,
  handleVerification,
  switchTab,
  createVerifiedProperty,
  displayBlockchainData,
};
