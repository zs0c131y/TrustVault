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

// Debug
async function getPropertyDetailsByTxHash(txHash) {
  try {
    console.log("Starting property verification for hash:", txHash);

    const receipt = await web3Instance.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Transaction not found");
    }
    console.log("Full transaction receipt:", receipt);

    // Log the logs array specifically
    console.log("Transaction logs:", receipt.logs);

    // Find PropertyRegistered event - make sure we're using the correct event signature
    const eventSignature = web3Instance.utils.sha3(
      "PropertyRegistered(address,string,string)"
    );
    console.log("Looking for event with signature:", eventSignature);

    const propertyEvent = receipt.logs[0]; // Since we can see there's exactly one log
    console.log("Found property event:", propertyEvent);

    if (!propertyEvent) {
      throw new Error("Property registration event not found in transaction");
    }

    try {
      // Decode the event data with better error handling
      const decodedEvent = web3Instance.eth.abi.decodeLog(
        [
          { type: "address", name: "owner", indexed: true },
          { type: "string", name: "propertyId" },
          { type: "string", name: "blockchainId" },
        ],
        propertyEvent.data,
        [propertyEvent.topics[1]]
      );
      console.log("Decoded event data:", decodedEvent);

      // Get the owner address from the event
      const ownerAddress = decodedEvent.owner;
      console.log("Owner address from event:", ownerAddress);

      // Get property details using the owner address
      const property = await contractInstance.methods
        .getProperty(ownerAddress)
        .call();
      console.log("Retrieved property details:", property);

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
          blockchainId: ownerAddress,
          transactionHash: txHash,
          blockNumber: receipt.blockNumber,
        },
      };
    } catch (error) {
      console.error("Error during property data processing:", error);
      throw new Error(`Failed to process property data: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in getPropertyDetailsByTxHash:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// async function getPropertyDetailsByTxHash(txHash) {
//   try {
//     console.log("Getting property details for transaction:", txHash);

//     // Get transaction receipt
//     const receipt = await web3Instance.eth.getTransactionReceipt(txHash);
//     if (!receipt) {
//       throw new Error("Transaction receipt not found");
//     }

//     console.log("Transaction receipt:", receipt);

//     // Get the PropertyRegistered event signature
//     const propertyRegisteredEvent = web3Instance.utils.sha3(
//       "PropertyRegistered(address,string,string,address)"
//     );

//     // Get the PropertyTransferred event signature
//     const propertyTransferredEvent = web3Instance.utils.sha3(
//       "OwnershipTransferred(address,address,address,uint256)"
//     );

//     // Find the relevant event log
//     const eventLog = receipt.logs.find(
//       (log) =>
//         log.topics[0] === propertyRegisteredEvent ||
//         log.topics[0] === propertyTransferredEvent
//     );

//     if (!eventLog) {
//       // If no specific event found, try to get property details from the transaction input data
//       const transaction = await web3Instance.eth.getTransaction(txHash);
//       console.log("Transaction data:", transaction);

//       if (transaction && transaction.input) {
//         // Decode the input data
//         const methodId = transaction.input.slice(0, 10);
//         const registerPropertyMethodId = web3Instance.utils
//           .keccak256("registerProperty(string,string,string,string)")
//           .slice(0, 10);
//         const transferOwnershipMethodId = web3Instance.utils
//           .keccak256("transferOwnership(address,address)")
//           .slice(0, 10);

//         if (
//           methodId === registerPropertyMethodId ||
//           methodId === transferOwnershipMethodId
//         ) {
//           // Get property details from contract using the to address
//           try {
//             const property = await contractInstance.methods
//               .getProperty(transaction.to)
//               .call();
//             return {
//               blockchainId: transaction.to,
//               owner: property.owner,
//               propertyId: property.propertyId,
//               propertyName: property.propertyName,
//               location: property.location,
//               propertyType: property.propertyType,
//               registrationDate: property.registrationDate,
//               isVerified: property.isVerified,
//               transactionHash: txHash,
//             };
//           } catch (contractError) {
//             console.error(
//               "Failed to get property from contract:",
//               contractError
//             );
//           }
//         }
//       }

//       throw new Error(
//         "Property registration or transfer event not found in transaction"
//       );
//     }

//     // Decode the event data based on the event type
//     let decodedData;
//     if (eventLog.topics[0] === propertyRegisteredEvent) {
//       decodedData = web3Instance.eth.abi.decodeLog(
//         [
//           {
//             type: "address",
//             name: "blockchainId",
//             indexed: true,
//           },
//           {
//             type: "string",
//             name: "propertyId",
//             indexed: false,
//           },
//           {
//             type: "string",
//             name: "propertyName",
//             indexed: false,
//           },
//           {
//             type: "address",
//             name: "owner",
//             indexed: false,
//           },
//         ],
//         eventLog.data,
//         [eventLog.topics[1]] // Include indexed parameter
//       );

//       // Get additional property details from contract
//       const property = await contractInstance.methods
//         .getProperty(decodedData.blockchainId)
//         .call();

//       return {
//         blockchainId: decodedData.blockchainId,
//         propertyId: decodedData.propertyId,
//         propertyName: decodedData.propertyName,
//         owner: decodedData.owner,
//         location: property.location,
//         propertyType: property.propertyType,
//         registrationDate: property.registrationDate,
//         isVerified: property.isVerified,
//         transactionHash: txHash,
//       };
//     } else {
//       // Handle transfer event
//       decodedData = web3Instance.eth.abi.decodeLog(
//         [
//           {
//             type: "address",
//             name: "blockchainId",
//             indexed: true,
//           },
//           {
//             type: "address",
//             name: "previousOwner",
//             indexed: true,
//           },
//           {
//             type: "address",
//             name: "newOwner",
//             indexed: true,
//           },
//           {
//             type: "uint256",
//             name: "transferDate",
//             indexed: false,
//           },
//         ],
//         eventLog.data,
//         [eventLog.topics[1], eventLog.topics[2], eventLog.topics[3]]
//       );

//       // Get property details from contract
//       const property = await contractInstance.methods
//         .getProperty(decodedData.blockchainId)
//         .call();

//       return {
//         blockchainId: decodedData.blockchainId,
//         previousOwner: decodedData.previousOwner,
//         newOwner: decodedData.newOwner,
//         transferDate: decodedData.transferDate,
//         propertyId: property.propertyId,
//         propertyName: property.propertyName,
//         location: property.location,
//         propertyType: property.propertyType,
//         isVerified: property.isVerified,
//         transactionHash: txHash,
//       };
//     }
//   } catch (error) {
//     console.error("Error in getPropertyDetailsByTxHash:", error);
//     throw error;
//   }
// }

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
            ${propertyData.blockchainId}
            <button class="copy-button" onclick="navigator.clipboard.writeText('${propertyData.blockchainId}')">
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
      console.log("Starting verification for:", searchValue);

      let result;
      if (searchValue.startsWith("0x") && searchValue.length === 66) {
        result = await getPropertyDetailsByTxHash(searchValue);
        console.log("Verification result:", result);
      } else {
        result = await getPropertyDetails(searchValue);
      }

      if (result.success && result.data) {
        console.log("Successfully retrieved property data:", result.data);
        resultContainer.innerHTML = createVerifiedProperty(result.data);

        // Get additional transaction data
        const txData = await web3Instance.eth.getTransaction(searchValue);
        const txReceipt = await web3Instance.eth.getTransactionReceipt(
          searchValue
        );

        // Display blockchain data with proper event handling
        displayBlockchainData(
          searchValue,
          result.data,
          { ...txData, ...txReceipt },
          [result.data] // Pass the property data as an event
        );
      } else {
        console.error("Property verification failed:", result.error);
        showNotFound(result.error);
      }
    } catch (error) {
      console.error("Verification error:", error);
      showError(error.message);
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
    </div>
  `;
}
