import { getToken, getAuthHeaders, isAuthenticated } from "./auth.js";
import {
  initWeb3,
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  getGasPrice,
} from "./web3-config.js";

let web3Instance;
let contractInstance;

// Initialize Web3 and contract
async function initializeBlockchain() {
  try {
    // Comprehensive startup checks
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }

    // Request account access with more robust error handling
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
    } catch (accessError) {
      console.error("Account access denied:", accessError);
      throw new Error("Please connect and authorize MetaMask");
    }

    // Initialize Web3 with explicit provider
    web3Instance = new Web3(window.ethereum);

    // Comprehensive network validation
    await checkNetwork(web3Instance);

    const accounts = await web3Instance.eth.getAccounts();
    console.log("Authorized Accounts:", accounts);

    if (!accounts || accounts.length === 0) {
      throw new Error("No blockchain accounts available");
    }

    console.log("Initializing contract with:", {
      contractAddress: CONTRACT_ADDRESS,
      abiMethods: CONTRACT_ABI.map((item) => item.name).filter(Boolean),
    });

    // Initialize contract with more detailed configuration
    contractInstance = new web3Instance.eth.Contract(
      CONTRACT_ABI,
      CONTRACT_ADDRESS,
      {
        from: accounts[0],
        gas: 5000000,
        gasPrice: await web3Instance.eth.getGasPrice(),
      }
    );

    // Verify contract deployment
    const code = await web3Instance.eth.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
      throw new Error("Contract not deployed at specified address");
    }

    console.log("Contract Deployment Code Length:", code.length);

    // Debug contract methods
    await debugContractMethods();

    // Add MetaMask listeners
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());

    return true;
  } catch (error) {
    console.error("Blockchain Initialization Failure:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    throw error;
  }
}

async function checkNetwork(web3) {
  try {
    const chainId = await web3.eth.getChainId();
    console.log("Current Chain ID:", chainId);

    // Hardhat's default local network chainId
    const HARDHAT_CHAIN_ID = 31337;
    const HARDHAT_CHAIN_ID_HEX = "0x7a69";

    if (chainId !== HARDHAT_CHAIN_ID) {
      console.log("Attempting to switch network...");
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: HARDHAT_CHAIN_ID_HEX }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          console.log("Network not found, attempting to add...");
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: HARDHAT_CHAIN_ID_HEX,
                  chainName: "Hardhat Local Network",
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
          } catch (addError) {
            console.error("Failed to add network:", addError);
          }
        } else {
          console.error("Failed to switch network:", switchError);
        }
      }
    }
  } catch (error) {
    console.error("Network check failed:", error);
  }
}

// Debugs
async function debugContractMethods() {
  try {
    // Detailed network and account logging
    const chainId = await web3Instance.eth.getChainId();
    console.log("Current Blockchain Details:", {
      chainId,
      networkId: await web3Instance.eth.net.getId(),
    });

    const accounts = await web3Instance.eth.getAccounts();
    console.log("Blockchain Accounts:", {
      accounts,
      firstAccount: accounts[0],
      balance: await web3Instance.eth.getBalance(accounts[0]),
    });

    // More robust method for testing property registration
    try {
      // Use try-catch with more specific error handling
      const registerMethod = contractInstance.methods.registerProperty(
        "TEST_PROPERTY_" + Date.now(),
        "Test Property",
        "Test Location",
        "Residential"
      );

      const gasEstimate = await registerMethod.estimateGas({
        from: accounts[0],
      });
      console.log("Gas Estimate for Registration:", gasEstimate);

      const receipt = await registerMethod.send({
        from: accounts[0],
        gas: Math.ceil(gasEstimate * 1.5), // More generous gas limit
      });

      console.log("Test Property Registration Successful:", receipt);
    } catch (registrationError) {
      console.error("Detailed Registration Error:", {
        name: registrationError.name,
        message: registrationError.message,
        code: registrationError.code,
        stack: registrationError.stack,
      });
    }
  } catch (error) {
    console.error("Comprehensive Debug Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
}

// Debug function to verify property and contract state
async function debugPropertyTransfer(propertyId) {
  try {
    console.log("Starting property transfer debug...");

    // Check web3 and contract initialization
    console.log("Web3 initialized:", !!web3Instance);
    console.log("Contract initialized:", !!contractInstance);
    console.log("Contract address:", contractInstance?.options?.address);

    // Check network
    const networkId = await web3Instance.eth.net.getId();
    console.log("Current network ID:", networkId);

    // Check account
    const accounts = await web3Instance.eth.getAccounts();
    console.log("Current account:", accounts[0]);

    // Check account balance
    const balance = await web3Instance.eth.getBalance(accounts[0]);
    console.log(
      "Account balance:",
      web3Instance.utils.fromWei(balance, "ether"),
      "ETH"
    );

    // Get property registration data
    const response = await fetch(`/api/registrations/${propertyId}`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    console.log("Property registration data:", data);

    if (data?.propertyInfo?.blockchainId) {
      const blockchainAddress = data.propertyInfo.blockchainId.startsWith("0x")
        ? data.propertyInfo.blockchainId
        : `0x${data.propertyInfo.blockchainId}`;

      // Check if address is valid
      console.log(
        "Is valid address:",
        web3Instance.utils.isAddress(blockchainAddress)
      );

      // Check contract code at address
      const code = await web3Instance.eth.getCode(
        contractInstance.options.address
      );
      console.log("Contract deployed:", code !== "0x");

      // Try to get property info
      try {
        const propertyInfo = await contractInstance.methods
          .getProperty(blockchainAddress)
          .call();
        console.log("Property info:", propertyInfo);
      } catch (error) {
        console.error("Failed to get property info:", error);
      }
    }

    console.log("Debug complete");
  } catch (error) {
    console.error("Debug failed:", error);
  }
}

// Authentication check function
async function checkAuthentication() {
  try {
    const token = getToken();
    console.log("Token found");

    if (!token) {
      console.log("No token found, redirecting to login...");
      window.location.href = "/login.html";
      return false;
    }

    const response = await fetch("/checkAuth", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    if (!data.authenticated) {
      console.log("Authentication failed, redirecting to login...");
      window.location.href = "/login.html";
      return false;
    }

    console.log("Authentication successful");
    return true;
  } catch (error) {
    console.error("Authentication check failed:", error);
    window.location.href = "/login.html";
    return false;
  }
}

// User data fetch
async function getUserData() {
  try {
    const response = await fetch("/getUserData", {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user data: ${response.status}`);
    }

    const data = await response.json();
    console.log("User data received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

// Helper function to convert property ID to blockchain address
async function getBlockchainAddressFromPropertyId(propertyId) {
  try {
    console.log("Fetching blockchain address for propertyId:", propertyId);

    // First check if web3 and contract are initialized
    if (!web3Instance || !contractInstance) {
      throw new Error("Blockchain not initialized. Please refresh the page.");
    }

    // Get current account
    const accounts = await web3Instance.eth.getAccounts();
    if (!accounts || accounts.length === 0) {
      throw new Error("No Ethereum account connected");
    }
    const currentAccount = accounts[0];

    // Fetch the property registration details
    const response = await fetch(`/api/registrations/${propertyId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch property data: ${response.status}`);
    }

    const data = await response.json();
    console.log("API Response:", data);

    // Get blockchainId from the response
    let blockchainAddress;
    if (data && data.propertyInfo && data.propertyInfo.blockchainId) {
      blockchainAddress = data.propertyInfo.blockchainId;
      // Ensure the address has the '0x' prefix
      blockchainAddress = blockchainAddress.startsWith("0x")
        ? blockchainAddress
        : `0x${blockchainAddress}`;

      // Validate address format
      if (!web3Instance.utils.isAddress(blockchainAddress)) {
        throw new Error(
          `Invalid Ethereum address format: ${blockchainAddress}`
        );
      }
    } else {
      throw new Error("Blockchain ID not found in property data");
    }

    // Verify the property exists on blockchain
    try {
      const propertyInfo = await contractInstance.methods
        .getProperty(blockchainAddress)
        .call();
      console.log("Property info from blockchain:", propertyInfo);

      // If property exists but isn't verified, verify it
      if (propertyInfo && !propertyInfo.isVerified) {
        console.log("Property exists but needs verification");

        try {
          const verifyMethod =
            contractInstance.methods.verifyProperty(blockchainAddress);
          const gasEstimate = await verifyMethod.estimateGas({
            from: currentAccount,
          });

          await verifyMethod.send({
            from: currentAccount,
            gas: Math.ceil(gasEstimate * 1.2),
          });

          console.log("Property verification successful");
        } catch (verifyError) {
          console.error("Verification failed:", verifyError);
          // Continue even if verification fails - the property still exists
        }
      }

      return blockchainAddress;
    } catch (propertyError) {
      console.log(
        "Property not found on blockchain, attempting registration..."
      );

      // Get property details for registration
      const propertyDetailsResponse = await fetch(
        `/api/property/${propertyId}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!propertyDetailsResponse.ok) {
        throw new Error("Failed to fetch property details for registration");
      }

      const propertyDetails = await propertyDetailsResponse.json();

      // Register the property
      const registerMethod = contractInstance.methods.registerProperty(
        propertyId,
        propertyDetails.propertyName || "Property",
        `${propertyDetails.city || ""}, ${propertyDetails.state || ""}`,
        propertyDetails.propertyType || "residential"
      );

      // Estimate gas for registration
      const gasEstimate = await registerMethod.estimateGas({
        from: currentAccount,
      });

      // Execute registration
      const receipt = await registerMethod.send({
        from: currentAccount,
        gas: Math.ceil(gasEstimate * 1.2),
      });

      // Add these debug logs
      console.log("Contract address:", contractInstance.options.address);
      console.log("Contract methods:", Object.keys(contractInstance.methods));
      console.log("Current account:", await web3Instance.eth.getAccounts());
      console.log("Network ID:", await web3Instance.eth.net.getId());
      console.log("Gas price:", await web3Instance.eth.getGasPrice());

      // Check contract deployment
      const code = await web3Instance.eth.getCode(
        contractInstance.options.address
      );
      console.log("Contract deployed:", code !== "0x");

      console.log("Property registration successful:", receipt);

      // Return the original blockchain address after registration
      return blockchainAddress;
    }
  } catch (error) {
    console.error("Error getting blockchain address:", error);
    throw error;
  }
}

// Utility functions for blockchain address handling
const blockchainUtils = {
  // Format and validate Ethereum address
  formatAddress(address) {
    if (!address) return null;

    // Add 0x prefix if missing
    const formattedAddress = address.startsWith("0x")
      ? address
      : `0x${address}`;

    // Check if it's a valid Ethereum address
    if (!web3Instance.utils.isAddress(formattedAddress)) {
      throw new Error(`Invalid Ethereum address format: ${formattedAddress}`);
    }

    return formattedAddress;
  },

  // Check if property exists on blockchain
  async checkPropertyExists(address) {
    try {
      const property = await contractInstance.methods
        .getProperty(address)
        .call();
      return (
        property &&
        property.owner !== "0x0000000000000000000000000000000000000000"
      );
    } catch (error) {
      return false;
    }
  },

  // Verify property on blockchain
  async verifyProperty(address, account) {
    try {
      const verifyMethod = contractInstance.methods.verifyProperty(address);
      const gasEstimate = await verifyMethod.estimateGas({ from: account });

      const receipt = await verifyMethod.send({
        from: account,
        gas: Math.ceil(gasEstimate * 1.2),
      });

      return receipt;
    } catch (error) {
      console.error("Property verification failed:", error);
      throw error;
    }
  },
};

// Prefill user email function
async function prefillUserEmail() {
  try {
    const userData = await getUserData();
    console.log("Attempting to prefill email with user data:", userData);

    if (userData && userData.email) {
      const emailInput = document.querySelector(
        'section:first-of-type input[type="email"]'
      );
      if (emailInput) {
        emailInput.value = userData.email;
        emailInput.readOnly = true;
        emailInput.style.backgroundColor = "#f0f0f0";
        console.log("Email prefilled successfully:", userData.email);
      }
    }
  } catch (error) {
    console.error("Error prefilling email:", error);
  }
}

// Validation helper objects
const validations = {
  phone: {
    regex: /^(?:(?:\+|91)?[6-9]\d{9})$/,
    message: "Please enter a valid 10-digit Indian phone number",
  },
  email: {
    regex: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    message: "Please enter a valid email address",
  },
  aadhaar: {
    regex: /^[2-9]\d{3}\s?\d{4}\s?\d{4}$/,
    message: "Please enter a valid 12-digit Aadhaar number",
  },
  pan: {
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    message: "Please enter a valid PAN number (Format: ABCDE1234F)",
  },
  ethereum: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    message: "Please enter a valid Ethereum address",
  },
};

// Form validation function
function validateForm() {
  let isValid = true;
  let errorMessage = "";

  // Validate phone numbers
  document.querySelectorAll('input[type="tel"]').forEach((input) => {
    if (!validations.phone.regex.test(input.value)) {
      isValid = false;
      errorMessage = validations.phone.message;
    }
  });

  // Validate emails
  document.querySelectorAll('input[type="email"]').forEach((input) => {
    if (!validations.email.regex.test(input.value)) {
      isValid = false;
      errorMessage = validations.email.message;
    }
  });

  // Validate ID numbers (Aadhaar/PAN)
  document
    .querySelectorAll('input[placeholder="Aadhar / PAN Number"]')
    .forEach((input) => {
      const value = input.value.replace(/\s/g, "");
      if (value.length === 12) {
        if (!validations.aadhaar.regex.test(value)) {
          isValid = false;
          errorMessage = validations.aadhaar.message;
        }
      } else {
        if (!validations.pan.regex.test(value.toUpperCase())) {
          isValid = false;
          errorMessage = validations.pan.message;
        }
      }
    });

  // Validate Ethereum address
  const ethAddressInput = document.querySelector(
    'input[name="newOwner_ethAddress"]'
  );
  if (
    ethAddressInput &&
    !validations.ethereum.regex.test(ethAddressInput.value)
  ) {
    isValid = false;
    errorMessage = validations.ethereum.message;
  }

  // Validate dates
  const transactionDate = document.querySelector('input[type="date"]').value;
  const selectedDate = new Date(transactionDate);
  const currentDate = new Date();

  selectedDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);

  if (selectedDate > currentDate) {
    isValid = false;
    errorMessage = "Transaction date cannot be in the future";
  }

  // Validate required fields
  document
    .querySelectorAll("input[required], select[required]")
    .forEach((input) => {
      if (!input.value.trim()) {
        isValid = false;
        errorMessage = "Please fill in all required fields";
      }
    });

  if (!isValid) {
    alert(errorMessage);
  }
  return isValid;
}

// Setup form validation event listeners
function setupValidation() {
  // Phone number validation
  document.querySelectorAll('input[type="tel"]').forEach((input) => {
    input.addEventListener("input", function () {
      const isValid = validations.phone.regex.test(this.value);
      this.setCustomValidity(isValid ? "" : validations.phone.message);
      this.reportValidity();
    });
  });

  // Email validation
  document.querySelectorAll('input[type="email"]').forEach((input) => {
    input.addEventListener("input", function () {
      const isValid = validations.email.regex.test(this.value);
      this.setCustomValidity(isValid ? "" : validations.email.message);
      this.reportValidity();
    });
  });

  // ID number validation
  document
    .querySelectorAll('input[placeholder="Aadhar / PAN Number"]')
    .forEach((input) => {
      input.addEventListener("input", function () {
        const value = this.value.replace(/\s/g, "");
        let isValid = false;
        let message = "";

        if (value.length === 12) {
          isValid = validations.aadhaar.regex.test(value);
          message = validations.aadhaar.message;
        } else {
          const upperValue = value.toUpperCase();
          this.value = upperValue;
          isValid = validations.pan.regex.test(upperValue);
          message = validations.pan.message;
        }

        this.setCustomValidity(isValid ? "" : message);
        this.reportValidity();
      });
    });

  // Ethereum address validation
  const ethAddressInput = document.querySelector(
    'input[name="newOwner_ethAddress"]'
  );
  if (ethAddressInput) {
    ethAddressInput.addEventListener("input", function () {
      const isValid = validations.ethereum.regex.test(this.value);
      this.setCustomValidity(isValid ? "" : validations.ethereum.message);
      this.reportValidity();
    });
  }
}

// India Post API integration
async function getLocationFromPincode(pincode) {
  try {
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`
    );
    const data = await response.json();

    if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice) {
      return {
        success: true,
        postOffices: data[0].PostOffice.map((po) => ({
          locality: po.Name,
          city: po.District,
          state: po.State,
          block: po.Block,
          branchType: po.BranchType,
          deliveryStatus: po.DeliveryStatus,
        })),
      };
    }
    return { success: false, error: "No data found" };
  } catch (error) {
    console.error("Error fetching location data:", error);
    return { success: false, error: error.message };
  }
}

// Setup same address functionality
function setupSameAddressButtons() {
  const addressNotes = document.querySelectorAll("em");
  addressNotes.forEach((note, index) => {
    note.style.cursor = "pointer";
    note.addEventListener("click", () => {
      const section = note.closest("section");
      const permanentAddress = section.querySelector(
        'input[placeholder="Permanent Address"]'
      );
      const currentAddress = section.querySelector(
        'input[placeholder="Current Address"]'
      );

      if (permanentAddress && currentAddress) {
        if (permanentAddress.value) {
          currentAddress.value = permanentAddress.value;
        } else {
          alert("Please fill in the permanent address first");
        }
      }
    });
  });
}

// Property data fetch and autofill
async function fetchPropertyDetails(propertyId) {
  try {
    const response = await fetch(`/api/property/${propertyId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Property not found");
    }

    const data = await response.json();
    console.log("Property data fetched:", data);

    // Autofill form fields
    const mappings = {
      "Property ID": propertyId,
      "Plot / Flat Number": data.plotNumber,
      Street: data.street,
      Locality: data.locality,
      City: data.city,
      State: data.state,
      Pincode: data.pincode,
      "Land Area": data.landArea,
      "Built-up Area": data.builtUpArea,
      "Property Classification": data.classification,
    };

    // Fill in the form fields
    Object.entries(mappings).forEach(([placeholder, value]) => {
      const input = document.querySelector(
        `input[placeholder="${placeholder}"]`
      );
      if (input && value) {
        input.value = value;
      }
    });

    // Handle property type selection
    const propertyTypeSelect = document.getElementById("propertyType");
    if (data.propertyType && propertyTypeSelect) {
      propertyTypeSelect.value = data.propertyType.toLowerCase();
      propertyTypeSelect.disabled = true;
    }

    // Handle current owner information if available
    if (data.currentOwner) {
      const ownerMappings = {
        "First Name": data.currentOwner.firstName,
        "Last Name": data.currentOwner.lastName,
        "Email Address": data.currentOwner.email,
        "Phone Number": data.currentOwner.phone,
        "Aadhar / PAN Number": data.currentOwner.idNumber,
        "Permanent Address": data.currentOwner.permanentAddress,
        "Current Address": data.currentOwner.currentAddress,
      };

      // Fill in current owner details
      Object.entries(ownerMappings).forEach(([placeholder, value]) => {
        const input = document.querySelector(
          `section:first-of-type input[placeholder="${placeholder}"]`
        );
        if (input && value) {
          input.value = value;
          input.readOnly = true;
        }
      });
    }

    // Trigger pincode lookup if pincode is available
    const pincodeInput = document.querySelector('input[placeholder="Pincode"]');
    if (pincodeInput && data.pincode) {
      pincodeInput.value = data.pincode;
      const event = new Event("input", { bubbles: true });
      pincodeInput.dispatchEvent(event);
    }
  } catch (error) {
    console.error("Error fetching property details:", error);
    alert("Could not find property with the given ID");
  }
}

// Setup property lookup
function setupPropertyLookup() {
  const propertyIdInput = document.querySelector(
    'input[placeholder="Property ID"]'
  );
  if (propertyIdInput) {
    propertyIdInput.addEventListener("input", (e) => {
      const propertyId = e.target.value.trim();
      if (propertyId.length >= 6) {
        fetchPropertyDetails(propertyId);
        getBlockchainAddressFromPropertyId(propertyId);
      }
    });
  }
}

// Calculate stamp duty and registration fees
function calculateEstimatedFees(propertyValue, city, propertyType) {
  propertyValue = Number(propertyValue);
  let stampDuty = 0;
  let registrationFee = 0;

  switch (city) {
    case "Delhi":
      stampDuty = propertyValue * 0.06;
      registrationFee = propertyValue * 0.01;
      break;
    case "Mumbai":
      stampDuty = propertyValue * 0.05;
      registrationFee = propertyValue * 0.01;
      break;
    case "Bangalore":
      stampDuty = propertyValue * 0.056;
      registrationFee = propertyValue * 0.01;
      break;
    case "Chennai":
      stampDuty = propertyValue * 0.07;
      registrationFee = propertyValue * 0.01;
      break;
    case "Hyderabad":
      stampDuty = propertyValue * 0.06;
      registrationFee = propertyValue * 0.005;
      break;
    default:
      stampDuty = propertyValue * 0.05;
      registrationFee = propertyValue * 0.01;
  }

  if (propertyType === "Commercial" || propertyType === "Industrial") {
    stampDuty *= 1.1;
  }

  return Math.round(stampDuty + registrationFee);
}

// Setup fee calculation
function setupFeeCalculation() {
  const purchaseValueInput = document.querySelector(
    'input[placeholder="Purchase Value"]'
  );
  const cityInput = document.querySelector('input[placeholder="City"]');
  const propertyTypeSelect = document.getElementById("propertyType");
  const stampDutyInput = document.querySelector(
    'input[placeholder="Stamp Duty & Registration Fees"]'
  );

  if (purchaseValueInput && cityInput && propertyTypeSelect && stampDutyInput) {
    purchaseValueInput.addEventListener("input", function () {
      if (this.value && cityInput.value && propertyTypeSelect.value) {
        const estimatedFees = calculateEstimatedFees(
          this.value,
          cityInput.value,
          propertyTypeSelect.value
        );
        stampDutyInput.value = estimatedFees;
      }
    });
  }
}

// Setup pincode lookup
function setupPincodeLookup() {
  const sections = document.querySelectorAll("section");
  sections.forEach((section) => {
    const pincodeInput = section.querySelector('input[placeholder="Pincode"]');
    if (pincodeInput) {
      const stateInput = section.querySelector('input[placeholder="State"]');
      const cityInput = section.querySelector('input[placeholder="City"]');
      const localityInput = section.querySelector(
        'input[placeholder="Locality"]'
      );
      let currentDropdown = null;

      if (stateInput && cityInput) {
        pincodeInput.addEventListener("input", async function (e) {
          const pincode = e.target.value.trim();

          // Remove existing dropdown if any
          if (currentDropdown) {
            currentDropdown.remove();
            currentDropdown = null;
          }

          // Reset fields
          stateInput.readOnly = false;
          cityInput.readOnly = false;
          stateInput.value = "";
          cityInput.value = "";

          if (localityInput) {
            localityInput.readOnly = false;
            localityInput.value = "";
            localityInput.style.opacity = "1";
            localityInput.style.cursor = "text";
          }

          [stateInput, cityInput].forEach((input) => {
            input.style.opacity = "1";
            input.style.cursor = "text";
          });

          if (pincode.length === 6 && /^\d+$/.test(pincode)) {
            try {
              // Show loading state
              stateInput.value = "Loading...";
              cityInput.value = "Loading...";
              if (localityInput) localityInput.value = "Loading...";

              const result = await getLocationFromPincode(pincode);

              if (result.success && result.postOffices.length > 0) {
                if (result.postOffices.length === 1) {
                  // Single location case
                  const location = result.postOffices[0];
                  stateInput.value = location.state;
                  cityInput.value = location.city;
                  if (localityInput) localityInput.value = location.locality;
                } else {
                  // Multiple locations case
                  const { dropdownContainer, select } = createLocalityDropdown(
                    result.postOffices,
                    section
                  );
                  const targetInput = localityInput || pincodeInput;
                  targetInput.parentNode.insertBefore(
                    dropdownContainer,
                    targetInput.nextSibling
                  );
                  currentDropdown = dropdownContainer;

                  // Set first location's city and state
                  stateInput.value = result.postOffices[0].state;
                  cityInput.value = result.postOffices[0].city;

                  // Handle locality selection
                  select.addEventListener("change", (e) => {
                    const selected = result.postOffices[e.target.value];
                    if (localityInput) {
                      localityInput.value = selected.locality;
                      localityInput.readOnly = true;
                      localityInput.style.opacity = "0.8";
                      localityInput.style.cursor = "not-allowed";
                    }
                    stateInput.value = selected.state;
                    cityInput.value = selected.city;

                    dropdownContainer.remove();
                    currentDropdown = null;
                    select.disabled = true;
                  });
                }

                // Make city and state readonly
                stateInput.readOnly = true;
                cityInput.readOnly = true;
                [stateInput, cityInput].forEach((input) => {
                  input.style.opacity = "0.8";
                  input.style.cursor = "not-allowed";
                });
              } else {
                alert("Could not find location data for this PIN code");
                // Reset loading state
                stateInput.value = "";
                cityInput.value = "";
                if (localityInput) localityInput.value = "";
              }
            } catch (error) {
              console.error("Error in pincode lookup:", error);
              alert("Error fetching location data");
              // Reset loading state
              stateInput.value = "";
              cityInput.value = "";
              if (localityInput) localityInput.value = "";
            }
          }
        });
      }
    }
  });
}

// Create locality dropdown UI
function createLocalityDropdown(postOffices, section) {
  const dropdownContainer = document.createElement("div");
  dropdownContainer.className = "locality-dropdown-container";

  const select = document.createElement("select");
  select.className = "locality-dropdown";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select Area/Locality";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  postOffices.forEach((po, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${po.locality} (${po.branchType})`;
    select.appendChild(option);
  });

  dropdownContainer.appendChild(select);

  const infoText = document.createElement("small");
  infoText.className = "locality-info";
  infoText.textContent = `${postOffices.length} locations found for this pincode`;
  dropdownContainer.appendChild(infoText);

  return { dropdownContainer, select };
}

// Transfer property on blockchain
async function transferPropertyOnBlockchain(propertyData, newOwnerAddress) {
  const submitButton = document.querySelector(".continue-btn");
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";

  try {
    // Comprehensive blockchain initialization check
    if (!web3Instance || !contractInstance) {
      throw new Error("Blockchain not properly initialized");
    }

    // Get current account
    const accounts = await web3Instance.eth.getAccounts();
    if (!accounts || accounts.length === 0) {
      throw new Error("No Ethereum account found");
    }
    const account = accounts[0];

    await debugPropertyTransfer(propertyId); // Temporary

    // Get the property ID
    const propertyId = propertyData.propertyId || propertyData;
    console.log("Starting property transfer process:", {
      propertyId,
      currentAccount: account,
      newOwnerAddress,
    });

    // Get blockchain address with error handling
    let blockchainAddress;
    try {
      const response = await fetch(`/api/registrations/${propertyId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        console.error("API Response not OK:", response.status);
        throw new Error(`Failed to fetch property data: ${response.status}`);
      }

      const data = await response.json();
      console.log("Property registration data:", data);

      if (data?.propertyInfo?.blockchainId) {
        blockchainAddress = data.propertyInfo.blockchainId;
        blockchainAddress = blockchainAddress.startsWith("0x")
          ? blockchainAddress
          : `0x${blockchainAddress}`;

        if (!web3Instance.utils.isAddress(blockchainAddress)) {
          throw new Error(
            `Invalid blockchain address format: ${blockchainAddress}`
          );
        }
      } else {
        throw new Error("Blockchain ID not found in property data");
      }
    } catch (error) {
      console.error("Error fetching blockchain address:", error);
      throw new Error(
        `Could not retrieve blockchain address: ${error.message}`
      );
    }

    console.log("Retrieved blockchain address:", blockchainAddress);

    // Check if property exists
    let propertyInfo;
    try {
      propertyInfo = await contractInstance.methods
        .getProperty(blockchainAddress)
        .call();
      console.log("Property info from blockchain:", propertyInfo);

      if (
        !propertyInfo ||
        propertyInfo.owner === "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error("Property not found on blockchain");
      }
    } catch (error) {
      console.error("Error retrieving property:", error);
      throw new Error("Failed to retrieve property from blockchain");
    }

    // Verify ownership
    if (propertyInfo.owner.toLowerCase() !== account.toLowerCase()) {
      throw new Error("Only the current owner can transfer this property");
    }

    // Check verification status
    if (!propertyInfo.isVerified) {
      console.log("Property needs verification, verifying...");
      try {
        const verifyMethod =
          contractInstance.methods.verifyProperty(blockchainAddress);
        const verifyGas = await verifyMethod.estimateGas({ from: account });

        await verifyMethod.send({
          from: account,
          gas: Math.ceil(verifyGas * 1.2),
        });
        console.log("Property verification successful");
      } catch (verifyError) {
        console.error("Verification failed:", verifyError);
        throw new Error("Property verification failed");
      }
    }

    // Prepare transfer transaction
    console.log("Preparing transfer transaction...");
    const transferMethod = contractInstance.methods.transferOwnership(
      blockchainAddress,
      newOwnerAddress
    );

    // Estimate gas
    const gasEstimate = await transferMethod
      .estimateGas({
        from: account,
      })
      .catch((error) => {
        console.error("Gas estimation error:", error);
        throw new Error("Failed to estimate gas for transfer");
      });

    // Get gas price
    const gasPrice = await web3Instance.eth.getGasPrice();
    const adjustedGasPrice = Math.ceil(Number(gasPrice) * 1.1);

    console.log("Transfer parameters:", {
      from: account,
      blockchainAddress,
      newOwnerAddress,
      gasEstimate,
      gasPrice: adjustedGasPrice,
    });

    // Execute transfer
    const receipt = await transferMethod
      .send({
        from: account,
        gas: Math.ceil(gasEstimate * 1.2),
        gasPrice: adjustedGasPrice,
      })
      .catch((error) => {
        console.error("Transfer execution error:", error);
        throw new Error("Failed to execute transfer transaction");
      });

    console.log("Transfer successful:", receipt);

    return {
      success: true,
      propertyId: propertyId,
      blockchainId: blockchainAddress,
      previousOwner: account,
      newOwner: newOwnerAddress,
      transferDate: Math.floor(Date.now() / 1000),
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error("Property transfer failed:", {
      error,
      message: error.message,
      code: error.code,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    throw new Error(`Failed to transfer property: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Continue";
  }
}

// Prepare form data for submission
async function prepareFormData(blockchainResult) {
  const formData = new FormData();

  // Current owner information
  const currentOwnerInfo = {
    firstName: document.querySelector('input[placeholder="First Name"]').value,
    lastName: document.querySelector('input[placeholder="Last Name"]').value,
    email: document.querySelector('input[placeholder="Email Address"]').value,
    phone: document.querySelector('input[placeholder="Phone Number"]').value,
    idNumber: document.querySelector('input[placeholder="Aadhar / PAN Number"]')
      .value,
    permanentAddress: document.querySelector(
      'input[placeholder="Permanent Address"]'
    ).value,
    currentAddress: document.querySelector(
      'input[placeholder="Current Address"]'
    ).value,
  };
  formData.append("currentOwnerInfo", JSON.stringify(currentOwnerInfo));

  // New owner information
  const newOwnerInfo = {
    firstName: document.querySelector('input[name="newOwner_firstName"]').value,
    lastName: document.querySelector('input[name="newOwner_lastName"]').value,
    email: document.querySelector('input[name="newOwner_email"]').value,
    phone: document.querySelector('input[name="newOwner_phone"]').value,
    idNumber: document.querySelector('input[name="newOwner_idNumber"]').value,
    permanentAddress: document.querySelector(
      'input[name="newOwner_permanentAddress"]'
    ).value,
    currentAddress: document.querySelector(
      'input[name="newOwner_currentAddress"]'
    ).value,
    ethAddress: document.querySelector('input[name="newOwner_ethAddress"]')
      .value,
  };
  formData.append("newOwnerInfo", JSON.stringify(newOwnerInfo));

  // Property information
  const propertyInfo = {
    propertyId: blockchainResult.blockchainId,
    plotNumber: document.querySelector(
      'input[placeholder="Plot / Flat Number"]'
    ).value,
    street: document.querySelector('input[placeholder="Street"]').value,
    locality: document.querySelector('input[placeholder="Locality"]').value,
    city: document.querySelector('input[placeholder="City"]').value,
    state: document.querySelector('input[placeholder="State"]').value,
    pincode: document.querySelector('input[placeholder="Pincode"]').value,
    propertyType: document.getElementById("propertyType").value,
    landArea: document.querySelector('input[placeholder="Land Area"]').value,
    builtUpArea: document.querySelector('input[placeholder="Built-up Area"]')
      .value,
    classification: document.querySelector(
      'input[placeholder="Property Classification"]'
    ).value,
    transactionType: document.getElementById("transactionType").value,
    transactionDate: document.querySelector('input[type="date"]').value,
    purchaseValue: document.querySelector('input[placeholder="Purchase Value"]')
      .value,
    stampDuty: document.querySelector(
      'input[placeholder="Stamp Duty & Registration Fees"]'
    ).value,
  };
  formData.append("propertyInfo", JSON.stringify(propertyInfo));

  // Add blockchain transaction details
  formData.append(
    "blockchainInfo",
    JSON.stringify({
      transactionHash: blockchainResult.transactionHash,
      blockchainId: blockchainResult.blockchainId,
      previousOwner: blockchainResult.previousOwner,
      newOwner: blockchainResult.newOwner,
      transferDate: blockchainResult.transferDate,
    })
  );

  // Add witness information
  const witnessInfo = {
    firstName: document.querySelectorAll('input[placeholder="First Name"]')[2]
      .value,
    lastName: document.querySelectorAll('input[placeholder="Last Name"]')[2]
      .value,
    email: document.querySelectorAll('input[placeholder="Email Address"]')[2]
      .value,
    phone: document.querySelectorAll('input[placeholder="Phone Number"]')[2]
      .value,
    idNumber: document.querySelectorAll(
      'input[placeholder="Aadhar / PAN Number"]'
    )[2].value,
    permanentAddress: document.querySelectorAll(
      'input[placeholder="Permanent Address"]'
    )[2].value,
    currentAddress: document.querySelectorAll(
      'input[placeholder="Current Address"]'
    )[2].value,
  };
  formData.append("witnessInfo", JSON.stringify(witnessInfo));

  // Add appointment information
  const appointmentInfo = {
    office: document.getElementById("Choose").value,
    datetime: document.getElementById("date").value,
  };
  formData.append("appointmentInfo", JSON.stringify(appointmentInfo));

  // Add document files
  const documentTypes = [
    "saleDeed",
    "taxReceipts",
    "encumbrance",
    "occupancy",
    "buildingPlan",
    "powerAttorney",
    "photoCertificate",
  ];

  documentTypes.forEach((type) => {
    const fileInput = document.getElementById(type);
    if (fileInput?.files[0]) {
      formData.append(type, fileInput.files[0]);
    }
  });

  return formData;
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  const submitButton = document.querySelector(".continue-btn");
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";

  try {
    // Get form values
    const propertyId = document.querySelector(
      'input[placeholder="Property ID"]'
    ).value;
    const newOwnerEthAddress = document.querySelector(
      'input[name="newOwner_ethAddress"]'
    ).value;

    if (!propertyId || !newOwnerEthAddress) {
      throw new Error("Property ID and new owner address are required");
    }

    console.log("Initiating property transfer:", {
      propertyId,
      newOwnerAddress: newOwnerEthAddress,
    });

    // First perform the blockchain transfer
    const blockchainResult = await transferPropertyOnBlockchain(
      propertyId,
      newOwnerEthAddress
    );

    if (!blockchainResult.success) {
      throw new Error(blockchainResult.error || "Blockchain transfer failed");
    }

    // Prepare and submit form data
    const formData = await prepareFormData(blockchainResult);

    const response = await fetch("/api/transfer-property", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Server error");
    }

    // Show success message and redirect
    alert("Property transfer successful!");
    window.location.href = "./registered.html";
  } catch (error) {
    console.error("Transfer failed:", error);
    alert(`Transfer failed: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Continue";
  }
}

// Setup file upload handlers
function setupFileUploadHandlers() {
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", function (e) {
      const file = e.target.files[0];
      const maxSize = e.target.dataset.maxSize * 1024 * 1024; // Convert to bytes
      const fileNameDisplay =
        e.target.parentElement.querySelector(".file-name");
      const documentItem = e.target.parentElement;

      if (file) {
        if (file.size > maxSize) {
          alert("File size exceeds 10MB limit");
          e.target.value = "";
          documentItem.classList.remove("has-file");
          fileNameDisplay.textContent = "";
          return;
        }

        const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png"];
        const fileExtension = "." + file.name.split(".").pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
          alert(
            "Invalid file type. Please upload PDF, JPG, or PNG files only."
          );
          e.target.value = "";
          documentItem.classList.remove("has-file");
          fileNameDisplay.textContent = "";
          return;
        }

        documentItem.classList.add("has-file");
        fileNameDisplay.textContent = file.name;
      } else {
        documentItem.classList.remove("has-file");
        fileNameDisplay.textContent = "";
      }
    });
  });
}

// Setup all event listeners
function setupEventListeners() {
  // Form submission
  const propertyForm = document.getElementById("propertyForm");
  if (propertyForm) {
    propertyForm.addEventListener("submit", handleFormSubmit);
  }

  // Back button
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", () => {
      history.back();
    });
  }

  setupValidation();
  setupSameAddressButtons();
  setupPropertyLookup();
  setupFeeCalculation();
  setupFileUploadHandlers();
  setupPincodeLookup();
}

// Initialize form
async function initializeForm() {
  try {
    if (await checkAuthentication()) {
      console.log("Authentication successful, initializing form...");

      // Initialize blockchain
      try {
        await initializeBlockchain();
        console.log("Blockchain initialization complete");
      } catch (error) {
        console.error("Blockchain initialization failed:", error);
        alert("Failed to initialize blockchain: " + error.message);
      }

      // Prefill user email
      await prefillUserEmail();

      // Setup all event listeners and handlers
      setupEventListeners();

      console.log("Form initialization complete");
    }
  } catch (error) {
    console.error("Form initialization failed:", error);
    throw error;
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initializeForm();

    // Additional debug logging
    console.log("Form Initialization Complete");

    // Run additional diagnostics
    await debugContractMethods();
  } catch (error) {
    console.error("Comprehensive Initialization Failure:", {
      error,
      message: error.message,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    alert("Failed to initialize form. Please check console for details.");
  }
});

export {
  checkAuthentication,
  initializeForm,
  validateForm,
  handleFormSubmit,
  transferPropertyOnBlockchain,
  blockchainUtils,
};
