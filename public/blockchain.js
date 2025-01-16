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

    const property = await contractInstance.methods.getProperty(address).call();

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
        lastTransferDate: property[7],
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
    if (!web3Instance) {
      await initializeBlockchain();
    }

    console.log("Starting property verification for hash:", txHash);

    if (!web3Instance.utils.isHexStrict(txHash)) {
      throw new Error("Invalid transaction hash format");
    }

    const receipt = await web3Instance.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Transaction not found");
    }

    const transaction = await web3Instance.eth.getTransaction(txHash);
    if (!transaction) {
      throw new Error("Transaction details not found");
    }

    const eventSignature = web3Instance.utils.sha3(
      "PropertyRegistered(address,string,string,address)"
    );
    const propertyEvent = receipt.logs.find(
      (log) => log.topics[0] === eventSignature
    );

    if (!propertyEvent) {
      throw new Error("Property registration event not found in transaction");
    }

    const decodedEvent = web3Instance.eth.abi.decodeLog(
      [
        { type: "address", name: "blockchainId", indexed: true },
        { type: "string", name: "propertyId" },
        { type: "string", name: "propertyName" },
        { type: "address", name: "owner" },
      ],
      propertyEvent.data,
      [propertyEvent.topics[1]]
    );

    // Get property details using the blockchain ID from the event
    const blockchainId = decodedEvent.blockchainId;
    const propertyDetails = await getPropertyDetails(blockchainId);
    if (!propertyDetails.success) {
      throw new Error(propertyDetails.error);
    }

    return {
      success: true,
      data: {
        ...propertyDetails.data,
        blockchainId: blockchainId, // Ensure blockchain ID is included
        transactionHash: txHash,
        blockNumber: receipt.blockNumber,
        networkId: await web3Instance.eth.net.getId(),
        timestamp: (await web3Instance.eth.getBlock(receipt.blockNumber))
          .timestamp,
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

    // Validate the blockchain ID format
    if (!web3Instance.utils.isAddress(blockchainId)) {
      throw new Error("Invalid blockchain ID format");
    }

    // Get property details using the blockchain ID
    const property = await contractInstance.methods
      .getProperty(blockchainId)
      .call();

    console.log("Retrieved property details:", property);

    // Check if property exists (you might want to adjust this check based on your contract implementation)
    if (!property.propertyId || property.propertyId === "") {
      throw new Error("Property not found for this blockchain ID");
    }

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
        blockchainId: blockchainId,
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
  const blockchainId =
    propertyData.blockchainId || (events[0] && events[0].blockchainId);

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
            <button class="copy-button" onclick="navigator.clipboard.writeText('${
              event.owner
            }')">
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
            ${blockchainId || "N/A"}
            ${
              blockchainId
                ? `<button class="copy-button" onclick="navigator.clipboard.writeText('${blockchainId}')">Copy</button>`
                : ""
            }
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

          const txReceipt = await web3Instance.eth.getTransactionReceipt(
            searchValue
          );
          if (!txReceipt) {
            throw new Error("Transaction not found");
          }

          const txDetails = await web3Instance.eth.getTransaction(searchValue);
          if (!txDetails) {
            throw new Error("Transaction details not found");
          }

          transactionData = {
            blockNumber: txReceipt.blockNumber,
            from: txReceipt.from,
            to: txReceipt.to,
            gasUsed: txReceipt.gasUsed,
            transactionHash: searchValue,
          };

          result = await getPropertyDetailsByTxHash(searchValue);

          if (result.success) {
            resultContainer.innerHTML = createVerifiedProperty(result.data);
            displayBlockchainData(searchValue, result.data, transactionData, [
              {
                propertyId: result.data.propertyId,
                propertyName: result.data.propertyName,
                owner: result.data.owner,
                blockchainId: result.data.blockchainId,
              },
            ]);
          }
        } else if (searchValue.length === 42) {
          // Blockchain ID case
          console.log("Processing blockchain ID search:", searchValue);

          result = await getPropertyDetails(searchValue);

          if (result.success) {
            // Try to find the registration transaction
            const latestBlock = await web3Instance.eth.getBlockNumber();
            const events = await contractInstance.getPastEvents(
              "PropertyRegistered",
              {
                filter: { blockchainId: searchValue },
                fromBlock: 0,
                toBlock: latestBlock,
              }
            );

            if (events.length > 0) {
              const txHash = events[0].transactionHash;
              const txReceipt = await web3Instance.eth.getTransactionReceipt(
                txHash
              );
              const txDetails = await web3Instance.eth.getTransaction(txHash);

              transactionData = {
                blockNumber: txReceipt.blockNumber,
                from: txReceipt.from,
                to: txReceipt.to,
                gasUsed: txReceipt.gasUsed,
                transactionHash: txHash,
              };
            }

            resultContainer.innerHTML = createVerifiedProperty(result.data);
            displayBlockchainData(
              transactionData.transactionHash || "N/A",
              result.data,
              transactionData,
              [
                {
                  propertyId: result.data.propertyId,
                  propertyName: result.data.propertyName,
                  owner: result.data.owner,
                  blockchainId: searchValue, // Explicitly include blockchain ID
                },
              ]
            );
          }
        } else {
          throw new Error("Invalid input length");
        }

        if (!result.success) {
          throw new Error(
            result.error || "Failed to retrieve property details"
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
      <div class="address-details">
        <small>Last Transfer: ${new Date(
          Number(propertyData.lastTransferDate) * 1000
        ).toLocaleDateString()}</small>
      </div>
    </div>
  `;
}
