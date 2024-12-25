// Using Web3 from window object (loaded via CDN in HTML)

// Contract ABI - Replace this with your actual contract ABI
const CONTRACT_ABI = [
  {
    inputs: [
      {
        internalType: "string",
        name: "_propertyId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_propertyName",
        type: "string",
      },
      {
        internalType: "string",
        name: "_location",
        type: "string",
      },
      {
        internalType: "string",
        name: "_propertyType",
        type: "string",
      },
    ],
    name: "registerProperty",
    outputs: [],
    stateMutability: "nonpayable",
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

// Contract address on Hardhat network
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Initialize Web3 and smart contract
async function initWeb3() {
  try {
    // Check if MetaMask is installed
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }

    // Request account access
    await window.ethereum.request({ method: "eth_requestAccounts" });

    // Create Web3 instance
    const web3 = new Web3(window.ethereum);

    // Get the current account
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];

    // Create contract instance
    const propertyContract = new web3.eth.Contract(
      CONTRACT_ABI,
      CONTRACT_ADDRESS,
      {
        from: account,
        gas: 5000000, // Default gas limit
        gasPrice: "20000000000", // 20 Gwei default gas price
      }
    );

    // Verify contract deployment
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
      throw new Error("Contract not deployed at specified address");
    }

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
    };
  } catch (error) {
    console.error("Failed to initialize Web3:", error);
    throw error;
  }
}

// Check if the correct network is selected
async function checkNetwork(web3) {
  const networkId = await web3.eth.net.getId();
  const chainId = await web3.eth.getChainId();

  if (chainId !== 31337) {
    // Hardhat network chainId
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }], // 31337 in hex
      });
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
  return true;
}

// Function to get current gas price with safety margin
async function getGasPrice(web3) {
  const gasPrice = await web3.eth.getGasPrice();
  return Math.ceil(Number(gasPrice) * 1.1); // Add 10% margin
}

// Export functions and constants
export { initWeb3, checkNetwork, getGasPrice, CONTRACT_ABI, CONTRACT_ADDRESS };
