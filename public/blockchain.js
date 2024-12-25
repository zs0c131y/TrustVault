// Initialize Web3 and contract instances
let web3Instance;
let contractInstance;

// Contract ABI - Including getProperty function
const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "string", name: "_propertyId", type: "string" },
      { internalType: "string", name: "_propertyName", type: "string" },
      { internalType: "string", name: "_location", type: "string" },
      { internalType: "string", name: "_propertyType", type: "string" },
    ],
    name: "registerProperty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_blockchainId", type: "address" },
    ],
    name: "getProperty",
    outputs: [
      {
        components: [
          { internalType: "string", name: "propertyId", type: "string" },
          { internalType: "string", name: "propertyName", type: "string" },
          { internalType: "string", name: "location", type: "string" },
          { internalType: "string", name: "propertyType", type: "string" },
          { internalType: "address", name: "owner", type: "address" },
          {
            internalType: "uint256",
            name: "registrationDate",
            type: "uint256",
          },
          { internalType: "bool", name: "isVerified", type: "bool" },
        ],
        internalType: "struct PropertyRegistry.Property",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "propertyId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "blockchainId",
        type: "string",
      },
    ],
    name: "PropertyRegistered",
    type: "event",
  },
];

// Contract address - Replace with your deployed contract address
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function initWeb3() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  const web3 = new Web3(window.ethereum);
  const accounts = await web3.eth.getAccounts();

  // Create contract instance
  const propertyContract = new web3.eth.Contract(
    CONTRACT_ABI,
    CONTRACT_ADDRESS
  );

  return {
    web3,
    propertyContract,
    account: accounts[0],
  };
}

async function isWalletConnected() {
  if (!window.ethereum) {
    return false;
  }
  try {
    const accounts = await window.ethereum.request({
      method: "eth_accounts", // Note: Using eth_accounts instead of eth_requestAccounts
    });
    return accounts && accounts.length > 0;
  } catch (error) {
    console.error("Error checking wallet connection:", error);
    return false;
  }
}

async function connectWallet() {
  try {
    // Check if MetaMask is installed
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }

    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    // Update UI to show connected state
    if (accounts[0]) {
      errorMessage.style.display = "none";
      verifyButton.disabled = false;
      verifyButton.style.cursor = "pointer";
      verifyButton.style.opacity = "1";
      return true;
    }
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    errorMessage.textContent = "Failed to connect wallet: " + error.message;
    errorMessage.style.display = "block";
    return false;
  }
}

async function initializeBlockchain() {
  try {
    // First check if MetaMask is installed
    if (!window.ethereum) {
      throw new Error("Please install MetaMask to continue");
    }

    // Try to connect wallet first
    const connected = await connectWallet();
    if (!connected) {
      throw new Error("Please connect your wallet to continue");
    }

    const { web3, propertyContract } = await initWeb3();
    web3Instance = web3;
    contractInstance = propertyContract;
    console.log("Blockchain initialized successfully");

    // Add network change handler
    window.ethereum.on("chainChanged", (chainId) => {
      window.location.reload();
    });

    // Add account change handler
    window.ethereum.on("accountsChanged", (accounts) => {
      window.location.reload();
    });

    return true;
  } catch (error) {
    console.error("Failed to initialize blockchain:", error);
    errorMessage.textContent = error.message;
    errorMessage.style.display = "block";
    return false;
  }
}

async function getPropertyDetailsByTxHash(txHash) {
  try {
    console.log("Fetching property details for transaction:", txHash);

    // Get transaction receipt
    const receipt = await web3Instance.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Transaction not found");
    }
    console.log("Transaction receipt:", receipt);

    // Find PropertyRegistered event
    const eventSignature = web3Instance.utils.sha3(
      "PropertyRegistered(address,string,string,address)"
    );
    const propertyEvent = receipt.logs.find(
      (log) => log.topics[0] === eventSignature
    );

    if (!propertyEvent) {
      throw new Error("Property registration event not found in transaction");
    }
    console.log("Property event found:", propertyEvent);

    // The blockchainId should be the address from the event
    const blockchainId = propertyEvent.topics[1]; // First indexed parameter
    console.log("Blockchain ID from event:", blockchainId);

    try {
      // Convert the address from the event topic (32 bytes) to a normal Ethereum address (20 bytes)
      const normalizedAddress = "0x" + blockchainId.slice(-40);
      console.log("Normalized address:", normalizedAddress);

      // Get property details using the blockchain ID
      const property = await contractInstance.methods
        .getProperty(normalizedAddress)
        .call();
      console.log("Property details:", property);

      return {
        success: true,
        data: {
          propertyId: property[0],
          propertyName: property[1],
          location: property[2],
          propertyType: property[3],
          owner: property[4],
          registrationDate: property[5],
          isVerified: property[6],
          blockchainId: normalizedAddress,
          transactionHash: txHash,
          blockNumber: receipt.blockNumber,
        },
      };
    } catch (error) {
      console.error("Error fetching property details:", error);
      throw new Error("Property not found or not accessible");
    }
  } catch (error) {
    console.error("Error in getPropertyDetailsByTxHash:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function displayBlockchainData(txHash, propertyData, transactionData, events) {
  const container = document.getElementById("blockchainDataContainer");
  container.style.display = "block";

  // Property Tab Content
  const propertyTab = document.getElementById("propertyTab");
  propertyTab.innerHTML = `
    <div class="data-item">
      <div class="data-label">Property ID</div>
      <div class="data-value">${propertyData.propertyId}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Property Name</div>
      <div class="data-value">${propertyData.propertyName}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Location</div>
      <div class="data-value">${propertyData.location}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Property Type</div>
      <div class="data-value">${propertyData.propertyType}</div>
    </div>
    <div class="data-item">
      <div class="data-label">Owner</div>
      <div class="data-value">
        ${propertyData.owner}
        <button class="copy-button" onclick="navigator.clipboard.writeText('${
          propertyData.owner
        }')">
          Copy
        </button>
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">Registration Date</div>
      <div class="data-value">${new Date(
        Number(propertyData.registrationDate) * 1000
      ).toLocaleString()}</div>
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
  transactionTab.innerHTML = `
    <div class="data-item">
      <div class="data-label">Transaction Hash</div>
      <div class="data-value">
        ${txHash}
        <button class="copy-button" onclick="navigator.clipboard.writeText('${txHash}')">
          Copy
        </button>
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">Block Number</div>
      <div class="data-value">${transactionData.blockNumber}</div>
    </div>
    <div class="data-item">
      <div class="data-label">From Address</div>
      <div class="data-value">
        ${transactionData.from}
        <button class="copy-button" onclick="navigator.clipboard.writeText('${transactionData.from}')">
          Copy
        </button>
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">To Address (Contract)</div>
      <div class="data-value">
        ${transactionData.to}
        <button class="copy-button" onclick="navigator.clipboard.writeText('${transactionData.to}')">
          Copy
        </button>
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">Gas Used</div>
      <div class="data-value">${transactionData.gasUsed} wei</div>
    </div>
  `;

  // Events Tab Content
  const eventsTab = document.getElementById("eventsTab");
  eventsTab.innerHTML = events
    .map(
      (event) => `
    <div class="event-item">
      <div class="event-name">PropertyRegistered Event</div>
      <div class="event-data">
        <div class="data-item">
          <div class="data-label">Owner</div>
          <div class="data-value">
            ${event.owner}
            <button class="copy-button" onclick="navigator.clipboard.writeText('${event.owner}')">
              Copy
            </button>
          </div>
        </div>
        <div class="data-item">
          <div class="data-label">Property ID</div>
          <div class="data-value">${event.propertyId}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Blockchain ID</div>
          <div class="data-value">
            ${event.blockchainId}
            <button class="copy-button" onclick="navigator.clipboard.writeText('${event.blockchainId}')">
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  // Set up tab switching
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons and hide all contents
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.add("hidden"));

      // Add active class to clicked button and show corresponding content
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab") + "Tab";
      document.getElementById(tabId).classList.remove("hidden");
    });
  });
}

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
      if (await connectWallet()) {
        await initializeBlockchain();
        connectButton.remove(); // Remove the button after successful connection
      }
    } finally {
      connectButton.disabled = false;
      connectButton.textContent = "Connect Wallet";
    }
  });

  // Check if wallet is already connected
  const walletConnected = await isWalletConnected();
  if (!walletConnected) {
    errorMessage.textContent =
      "Please install MetaMask and connect your wallet";
    errorMessage.style.display = "block";
    // Add connect button below error message
    errorMessage.insertAdjacentElement("afterend", connectButton);
    verifyButton.disabled = true;
    verifyButton.style.cursor = "not-allowed";
    verifyButton.style.opacity = "0.6";
  }

  // Initialize blockchain only if wallet is connected
  if (walletConnected) {
    const initialized = await initializeBlockchain();
    if (!initialized) {
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
    // Enable button if there's any input
    verifyButton.disabled = value.length === 0;

    // Update button style
    if (!verifyButton.disabled) {
      verifyButton.style.cursor = "pointer";
      verifyButton.style.opacity = "1";
    } else {
      verifyButton.style.cursor = "not-allowed";
      verifyButton.style.opacity = "0.6";
    }
  });

  const handleVerification = async () => {
    const searchValue = searchInput.value.trim();

    // Clear previous results
    errorMessage.style.display = "none";
    resultContainer.innerHTML = "";
    document.getElementById("blockchainDataContainer").style.display = "none";

    // Show loading state
    verifyButton.disabled = true;
    verifyButton.textContent = "Verifying...";

    try {
      // Get transaction details first
      const txData = await web3Instance.eth.getTransaction(searchValue);
      const txReceipt = await web3Instance.eth.getTransactionReceipt(
        searchValue
      );

      let result;
      // Check if input is a transaction hash (0x followed by 64 hex characters)
      if (/^0x[a-fA-F0-9]{64}$/.test(searchValue)) {
        result = await getPropertyDetailsByTxHash(searchValue);
      } else {
        // Assume it's a blockchain ID
        result = await getPropertyDetails(searchValue);
      }

      if (result.success && result.data) {
        resultContainer.innerHTML = createVerifiedProperty(result.data);

        // Decode events
        const events = txReceipt.logs
          .map((log) => {
            try {
              return web3Instance.eth.abi.decodeLog(
                CONTRACT_ABI.find((x) => x.type === "event").inputs,
                log.data,
                log.topics.slice(1)
              );
            } catch (e) {
              return null;
            }
          })
          .filter((x) => x);

        // Display blockchain data
        displayBlockchainData(
          searchValue,
          result.data,
          {
            ...txData,
            ...txReceipt,
          },
          events
        );
      } else {
        resultContainer.innerHTML = `
          <div class="verification-message">
            <img src="./assets/notverified.png" class="verification-icon">
            <p class="message-text">Property not found. Please check the ID or transaction hash and try again.</p>
          </div>
        `;
      }
    } catch (error) {
      console.error("Verification error:", error);
      resultContainer.innerHTML = `
        <div class="verification-message">
          <img src="./assets/notverified.png" class="verification-icon">
          <p class="message-text">Error verifying property: ${error.message}</p>
        </div>
      `;
    } finally {
      verifyButton.disabled = false;
      verifyButton.textContent = "Verify Property";
    }
  };

  verifyButton.addEventListener("click", handleVerification);

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !verifyButton.disabled) {
      handleVerification();
    }
  });

  backButton?.addEventListener("click", () => {
    history.back();
  });

  // If there's a transaction hash in URL params, use it
  const urlParams = new URLSearchParams(window.location.search);
  const txHash = urlParams.get("tx");
  if (txHash) {
    searchInput.value = txHash;
    handleVerification();
  }
});

function createVerifiedProperty(propertyData) {
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
      <div class="property-title">${propertyData.propertyName}</div>
      <div class="address">${propertyData.propertyType}</div>
      <div class="address-details">${propertyData.location}</div>
      <div class="address-details">
        <small>Registration Date: ${new Date(
          Number(propertyData.registrationDate) * 1000
        ).toLocaleDateString()}</small>
      </div>
    </div>
  `;
}
