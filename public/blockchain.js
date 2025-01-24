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
    outputs: [{ internalType: "address", name: "", type: "address" }],
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
          {
            internalType: "uint256",
            name: "lastTransferDate",
            type: "uint256",
          },
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
    inputs: [
      { internalType: "address", name: "_blockchainId", type: "address" },
    ],
    name: "verifyProperty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_blockchainId", type: "address" },
      { internalType: "address", name: "_newOwner", type: "address" },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "propertyIdToAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "properties",
    outputs: [
      { internalType: "string", name: "propertyId", type: "string" },
      { internalType: "string", name: "propertyName", type: "string" },
      { internalType: "string", name: "location", type: "string" },
      { internalType: "string", name: "propertyType", type: "string" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "registrationDate", type: "uint256" },
      { internalType: "bool", name: "isVerified", type: "bool" },
      { internalType: "uint256", name: "lastTransferDate", type: "uint256" },
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
        name: "blockchainId",
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
        name: "propertyName",
        type: "string",
      },
      {
        indexed: false,
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "PropertyRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "blockchainId",
        type: "address",
      },
    ],
    name: "PropertyVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "blockchainId",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "transferDate",
        type: "uint256",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
];

// Contract address
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

async function getPropertyDetails(address) {
  try {
    if (!contractInstance) {
      await initializeBlockchain();
    }

    if (!web3Instance.utils.isAddress(address)) {
      throw new Error("Invalid address format");
    }

    // Call properties mapping directly instead of getProperty function
    const property = await contractInstance.methods.properties(address).call();

    if (!property || !property.propertyId) {
      throw new Error("Property not found");
    }

    return {
      success: true,
      data: {
        propertyId: property.propertyId,
        propertyName: property.propertyName,
        location: property.location,
        propertyType: property.propertyType,
        owner: property.owner,
        registrationDate: property.registrationDate,
        isVerified: property.isVerified,
        lastTransferDate: property.lastTransferDate,
        blockchainId: address,
      },
    };
  } catch (error) {
    console.error("Error in getPropertyDetails:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Debug
async function getPropertyDetailsByTxHash(txHash) {
  try {
    console.log("Starting property verification for hash:", txHash);

    // First search in MongoDB using the API
    const response = await fetch(`/api/property/search-by-hash/${txHash}`);
    const responseData = await response.json();

    if (!response.ok || !responseData.success) {
      throw new Error(responseData.error || "Failed to fetch property details");
    }

    // Get the transaction receipt for UI display
    const receipt = await web3Instance.eth.getTransactionReceipt(txHash);
    const block = await web3Instance.eth.getBlock(receipt.blockNumber);

    // Use the current blockchain status from the API response
    return {
      success: true,
      data: {
        ...responseData.data.currentBlockchainStatus,
        blockchainId: responseData.data.currentBlockchainId,
        originalBlockchainId: responseData.data.blockchainIds[0]?.id,
        transactionHash: txHash,
        blockNumber: receipt.blockNumber,
        timestamp: block.timestamp,
        networkId: await web3Instance.eth.net.getId(),
        blockchainHistory: responseData.data.blockchainIds,
        transactionHistory: responseData.data.transactions,
      },
    };
  } catch (error) {
    console.error("Error in getPropertyDetailsByTxHash:", error);
    return {
      success: false,
      error: error.message || "Failed to verify property",
    };
  }
}

async function getPropertyDetailsByBlockchainId(blockchainId) {
  try {
    console.log("Getting property details for blockchain ID:", blockchainId);

    // First search in MongoDB using the API
    const response = await fetch(
      `/api/property/search-by-blockchain-id/${blockchainId}`
    );
    const responseData = await response.json();

    if (!response.ok || !responseData.success) {
      throw new Error(responseData.error || "Failed to fetch property details");
    }

    // Use the current blockchain status from the API response
    return {
      success: true,
      data: {
        ...responseData.data.currentBlockchainStatus,
        blockchainId: responseData.data.currentBlockchainId,
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
  transactionTab.innerHTML = `
    <div class="data-item">
      <div class="data-label">Transaction Hash</div>
      <div class="data-value">
        ${txHash}
        <button class="copy-button" onclick="navigator.clipboard.writeText('${txHash}')">Copy</button>
      </div>
    </div>
    <div class="data-item">
      <div class="data-label">Block Number</div>
      <div class="data-value">${transactionData.blockNumber || "N/A"}</div>
    </div>
    <div class="data-item">
      <div class="data-label">From Address</div>
      <div class="data-value">
        ${transactionData.from || "N/A"}
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
        ${transactionData.to || "N/A"}
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
        transactionData.gasUsed ? `${transactionData.gasUsed} wei` : "N/A"
      }</div>
    </div>
  `;

  // Events Tab Content
  const eventsTab = document.getElementById("eventsTab");
  eventsTab.innerHTML =
    events && events.length > 0
      ? events
          .map(
            (event) => `
    <div class="event-item">
      <div class="event-name">PropertyRegistered Event</div>
      <div class="event-data">
        <div class="data-item">
          <div class="data-label">Owner</div>
          <div class="data-value">
            ${event.owner || "N/A"}
            ${
              event.owner
                ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${event.owner}')">Copy</button>`
                : ""
            }
          </div>
        </div>
        <div class="data-item">
          <div class="data-label">Property ID</div>
          <div class="data-value">${event.propertyId || "N/A"}</div>
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
  `
          )
          .join("")
      : '<div class="no-events">No events found</div>';
}

function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
    tab.style.display = "none";
  });

  // Remove active class from all buttons
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.remove("active");
  });

  // Show selected tab content
  const selectedTab = document.getElementById(tabName);
  selectedTab.style.display = "block";
  selectedTab.classList.add("active");

  // Add active class to selected button
  document
    .querySelector(`button[onclick="switchTab('${tabName}')"]`)
    .classList.add("active");
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

  // Add tab functionality
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", (e) => {
      const tabName = e.target.getAttribute("onclick").match(/'(.*?)'/)[1];
      switchTab(tabName);
    });
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
    const searchInput = document.getElementById("searchInput");
    const searchValue = searchInput.value.trim();
    const errorMessage = document.getElementById("errorMessage");
    const resultContainer = document.getElementById("resultContainer");
    const verifyButton = document.getElementById("verifyButton");

    // Clear previous results
    errorMessage.style.display = "none";
    resultContainer.innerHTML = "";
    document.getElementById("blockchainDataContainer").style.display = "none";

    // Show loading state
    verifyButton.disabled = true;
    verifyButton.textContent = "Verifying...";

    try {
      // First ensure blockchain is initialized
      if (!web3Instance) {
        const initialized = await initializeBlockchain();
        if (!initialized) {
          throw new Error("Failed to initialize blockchain connection");
        }
      }

      let result;
      let transactionData = {};

      if (searchValue.startsWith("0x")) {
        if (searchValue.length === 66) {
          // Transaction hash case
          console.log("Processing transaction hash search:", searchValue);

          // Get the transaction details first
          try {
            const txReceipt = await web3Instance.eth.getTransactionReceipt(
              searchValue
            );
            if (txReceipt) {
              transactionData = {
                blockNumber: txReceipt.blockNumber,
                from: txReceipt.from,
                to: txReceipt.to,
                gasUsed: txReceipt.gasUsed,
                transactionHash: searchValue,
              };
            }
          } catch (err) {
            console.error("Error getting transaction receipt:", err);
          }

          result = await getPropertyDetailsByTxHash(searchValue);
        } else if (searchValue.length === 42) {
          // Blockchain ID case
          console.log("Processing blockchain ID search:", searchValue);
          result = await getPropertyDetailsByBlockchainId(searchValue);

          // If successful, try to get transaction data from history
          if (result.success && result.data.blockchainHistory) {
            const matchedId = result.data.blockchainHistory.find(
              (entry) => entry.id === searchValue
            );
            if (matchedId?.txHash) {
              try {
                const txReceipt = await web3Instance.eth.getTransactionReceipt(
                  matchedId.txHash
                );
                if (txReceipt) {
                  transactionData = {
                    blockNumber: txReceipt.blockNumber,
                    from: txReceipt.from,
                    to: txReceipt.to,
                    gasUsed: txReceipt.gasUsed,
                    transactionHash: matchedId.txHash,
                  };
                }
              } catch (err) {
                console.error(
                  "Error getting transaction receipt for history:",
                  err
                );
              }
            }
          }
        } else {
          throw new Error("Invalid input length");
        }

        if (!result.success) {
          throw new Error(
            result.error || "Failed to retrieve property details"
          );
        }

        // Display results only if we have valid data
        resultContainer.innerHTML = createVerifiedProperty(result.data);

        // Only display blockchain data if we have result data
        if (result.data) {
          displayBlockchainData(
            transactionData.transactionHash || "N/A",
            result.data,
            transactionData || {},
            [
              {
                propertyId: result.data.propertyId,
                propertyName: result.data.propertyName,
                owner: result.data.owner,
                blockchainId: result.data.blockchainId,
              },
            ]
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
  };

  // Helper functions for consistent error handling
  function showError(message) {
    resultContainer.innerHTML = `
        <div class="verification-message">
            <img src="./assets/notverified.png" class="verification-icon">
            <p class="message-text">Error: ${message}</p>
        </div>
    `;
  }

  function showNotFound(error = "") {
    resultContainer.innerHTML = `
      <div class="verification-message">
        <img src="./assets/notverified.png" class="verification-icon">
        <p class="message-text">Property not found. ${
          error
            ? `Error: ${error}`
            : "Please check the ID or transaction hash and try again."
        }</p>
      </div>
    `;
  }

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
