const CONTRACT_ABI = [
  {
    // Register Property Function
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
    // Verify Property Function
    inputs: [
      { internalType: "address", name: "_blockchainId", type: "address" },
    ],
    name: "verifyProperty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    // Get Property Function
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
    // Transfer Ownership Function
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
    // Property Registered Event
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
    // Property Verified Event
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
    // Ownership Transferred Event
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

// Contract address on Hardhat network
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Function to check if MetaMask is installed and unlocked
async function checkMetaMaskConnection() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed!");
  }

  try {
    // Check if already connected
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    if (accounts.length === 0) {
      // If not connected, request connection
      await window.ethereum.request({
        method: "eth_requestAccounts",
      });
    }

    return true;
  } catch (error) {
    console.error("MetaMask connection error:", error);
    throw new Error("Failed to connect to MetaMask");
  }
}

// Initialize Web3 and smart contract
async function initWeb3() {
  try {
    // First check MetaMask connection
    await checkMetaMaskConnection();

    let web3;
    if (window.Web3) {
      web3 = new Web3(window.ethereum);
    } else if (window.ethers) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      web3 = {
        eth: {
          getAccounts: async () => {
            const signer = await provider.getSigner();
            return [await signer.getAddress()];
          },
          Contract: function (abi, address, options) {
            const contract = new ethers.Contract(address, abi, provider);
            return contract;
          },
          getCode: async (address) => {
            return await provider.getCode(address);
          },
          getGasPrice: async () => {
            return (await provider.getFeeData()).gasPrice.toString();
          },
          estimateGas: async (txObject) => {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
              txObject.to,
              CONTRACT_ABI,
              signer
            );
            return await contract.estimateGas[txObject.data](txObject.params);
          },
        },
        utils: {
          toHex: (num) => ethers.toBeHex(num),
          fromWei: (num) => ethers.formatEther(num),
          isAddress: (address) => ethers.isAddress(address),
        },
      };
    } else {
      throw new Error("No Web3 or ethers library found");
    }

    // Get the current account
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];

    if (!account) {
      throw new Error("No account found. Please connect to MetaMask.");
    }

    // Create contract instance
    const propertyContract = new web3.eth.Contract(
      CONTRACT_ABI,
      CONTRACT_ADDRESS,
      {
        from: account,
        gas: 5000000,
        gasPrice: "20000000000",
      }
    );

    // Verify contract deployment
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
      throw new Error("Contract not deployed at specified address");
    }

    // Check network
    await checkNetwork(web3);

    // Add event listeners for network and account changes
    window.ethereum.on("chainChanged", () => {
      console.log("Network changed. Reloading...");
      window.location.reload();
    });

    window.ethereum.on("accountsChanged", () => {
      console.log("Account changed. Reloading...");
      window.location.reload();
    });

    return {
      web3,
      propertyContract,
      account,
      initialized: true,
    };
  } catch (error) {
    console.error("Failed to initialize Web3:", error);
    throw error;
  }
}

// Check if the correct network is selected
async function checkNetwork(web3) {
  try {
    const chainId = await web3.eth.getChainId();

    if (chainId !== 31337) {
      // Hardhat network chainId
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }], // 31337 in hex
      });
    }
    return true;
  } catch (error) {
    if (error.code === 4902) {
      // Network doesn't exist, add it
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x7a69",
            chainName: "Hardhat Network",
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["http://127.0.0.1:8545/"],
            blockExplorerUrls: [],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

// Function to get current gas price with safety margin
async function getGasPrice(web3) {
  const gasPrice = await web3.eth.getGasPrice();
  return Math.ceil(Number(gasPrice) * 1.1); // Add 10% margin
}

// Function to handle property transfers
async function transferProperty(
  web3,
  propertyContract,
  blockchainId,
  newOwnerAddress
) {
  try {
    const accounts = await web3.eth.getAccounts();
    const currentAccount = accounts[0];

    // First verify the current owner
    const propertyInfo = await propertyContract.methods
      .getProperty(blockchainId)
      .call();

    if (propertyInfo.owner.toLowerCase() !== currentAccount.toLowerCase()) {
      throw new Error("Only the current owner can transfer the property");
    }

    // Prepare the transfer transaction
    const transferMethod = propertyContract.methods.transferOwnership(
      blockchainId,
      newOwnerAddress
    );

    // Estimate gas
    const gasEstimate = await transferMethod.estimateGas({
      from: currentAccount,
    });
    const gasPrice = await getGasPrice(web3);

    // Send the transaction
    const receipt = await transferMethod.send({
      from: currentAccount,
      gas: Math.ceil(gasEstimate * 1.2), // Add 20% margin for gas estimate
      gasPrice: gasPrice,
    });

    // Check for the OwnershipTransferred event
    const transferEvent = receipt.events.OwnershipTransferred;
    if (!transferEvent) {
      throw new Error("Transfer event not found in transaction receipt");
    }

    return {
      success: true,
      transactionHash: receipt.transactionHash,
      blockchainId: transferEvent.returnValues.blockchainId,
      previousOwner: transferEvent.returnValues.previousOwner,
      newOwner: transferEvent.returnValues.newOwner,
      transferDate: transferEvent.returnValues.transferDate,
    };
  } catch (error) {
    console.error("Property transfer failed:", error);
    throw error;
  }
}

// Export all functions and constants
export {
  initWeb3,
  checkNetwork,
  getGasPrice,
  checkMetaMaskConnection,
  transferProperty,
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
};
