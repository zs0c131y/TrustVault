import { getToken, getAuthHeaders, isAuthenticated } from "./auth.js";
import { initWeb3 } from "./web3-config.js";

let web3Instance;
let contractInstance;

// Initialize Web3 and contract
async function initializeBlockchain() {
  try {
    const { web3, propertyContract } = await initWeb3();
    web3Instance = web3;
    contractInstance = propertyContract;
    console.log("Blockchain initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize blockchain:", error);
    return false;
  }
}

// Helper function in case of failure
async function retry(attempts, fn) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      console.log(`Retry attempt ${i + 1} of ${attempts}`);
    }
  }
}

// Helper function to verify event signature
function verifyEventSignature() {
  try {
    const eventSignature = "PropertyRegistered(address,string,string)";
    const topic = Web3.utils.sha3(eventSignature);
    console.log("Event signature check:", {
      signature: eventSignature,
      topic: topic,
    });
    return topic;
  } catch (error) {
    console.error("Error checking event signature:", error);
    return null;
  }
}

// Helper function to register property on blockchain
async function registerPropertyOnBlockchain(propertyData) {
  const submitButton = document.querySelector(".continue-btn");
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";

  try {
    // Check if MetaMask is installed
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }

    // Get accounts
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No MetaMask account available");
    }

    const account = accounts[0];

    // Format property data
    const formattedData = {
      propertyId: propertyData.propertyId,
      propertyName:
        `${propertyData.plotNumber} ${propertyData.propertyName}`.trim(),
      location: `${propertyData.street}, ${propertyData.locality}, ${propertyData.city}, ${propertyData.state}`,
      propertyType: propertyData.propertyType,
    };

    // Explicitly register the function selector
    const functionSignature = "registerProperty(string,string,string,string)";
    const functionSelector =
      web3Instance.eth.abi.encodeFunctionSignature(functionSignature);

    // Encode parameters separately
    const encodedParameters = web3Instance.eth.abi.encodeParameters(
      ["string", "string", "string", "string"],
      [
        formattedData.propertyId,
        formattedData.propertyName,
        formattedData.location,
        formattedData.propertyType,
      ]
    );

    // Combine selector and parameters
    const data = functionSelector + encodedParameters.slice(2); // Remove '0x' from parameters

    // Prepare transaction
    const transactionParameters = {
      to: contractInstance.options.address,
      from: account,
      data: data,
      type: "0x0", // Legacy transaction type
    };

    // First get gas estimate
    try {
      const gasEstimate = await window.ethereum.request({
        method: "eth_estimateGas",
        params: [transactionParameters],
      });

      transactionParameters.gas = web3Instance.utils.toHex(
        Math.round(Number(gasEstimate) * 1.2)
      ); // Add 20% buffer
    } catch (error) {
      console.error("Gas estimation failed:", error);
      throw new Error("Failed to estimate gas. The transaction might fail.");
    }

    // Get gas price
    try {
      const gasPrice = await window.ethereum.request({
        method: "eth_gasPrice",
      });

      transactionParameters.gasPrice = web3Instance.utils.toHex(
        Math.round(Number(gasPrice) * 1.1)
      ); // Add 10% buffer
    } catch (error) {
      console.error("Gas price fetch failed:", error);
      throw new Error("Failed to get gas price");
    }

    // Send transaction
    submitButton.textContent = "Confirm in MetaMask...";
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [transactionParameters],
    });

    if (!txHash) {
      throw new Error("Transaction failed");
    }

    submitButton.textContent = "Waiting for confirmation...";

    // Wait for transaction receipt
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (!receipt && attempts < maxAttempts) {
      try {
        receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });

        if (!receipt) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        if (!receipt.status) {
          throw new Error("Transaction failed");
        }

        // Debug log the receipt
        console.log("Transaction receipt:", receipt);

        // Check if we have logs
        if (!receipt.logs || receipt.logs.length === 0) {
          console.error("No logs found in receipt");
          return {
            success: true,
            blockchainId: formattedData.propertyId, // Fallback to propertyId
            transactionHash: txHash,
            blockNumber: web3Instance.utils.hexToNumber(receipt.blockNumber),
          };
        }

        // Find and decode the PropertyRegistered event
        try {
          const propertyRegisteredTopic = web3Instance.utils.sha3(
            "PropertyRegistered(address,string,string,address)" // Updated event signature
          );
          console.log("Looking for topic:", propertyRegisteredTopic);
          console.log("Available logs:", receipt.logs);

          const eventLog = receipt.logs.find(
            (log) => log.topics[0] === propertyRegisteredTopic
          );

          if (eventLog) {
            // Decode the event data - updated to match the actual event parameters
            const decodedData = web3Instance.eth.abi.decodeParameters(
              ["string", "string", "address"], // Update parameters to match event
              eventLog.data
            );
            console.log("Decoded event data:", decodedData);

            // The blockchainId is in the topics since it's indexed
            const blockchainId = eventLog.topics[1].slice(26).toLowerCase(); // Convert to checksum address

            return {
              success: true,
              blockchainId: blockchainId, // Use the actual blockchainId from event
              transactionHash: txHash,
              blockNumber: web3Instance.utils.hexToNumber(receipt.blockNumber),
            };
          }
        } catch (decodeError) {
          console.error("Error decoding event:", decodeError);
        }

        // Fallback return if event parsing fails
        return {
          success: true,
          blockchainId: formattedData.propertyId,
          transactionHash: txHash,
          blockNumber: web3Instance.utils.hexToNumber(receipt.blockNumber),
        };
      } catch (error) {
        console.error("Error while waiting for receipt:", error);
        if (attempts >= maxAttempts) {
          throw new Error("Transaction confirmation timeout");
        }
      }
    }

    throw new Error("Failed to get transaction receipt");
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: error.message || "Transaction failed",
    };
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Continue";
  }
}

// Web3 Debug
window.debugWeb3Setup = async function () {
  try {
    console.log("Starting Web3 debug setup...");

    // Initialize Web3
    const { web3, propertyContract, account } = await initWeb3();
    console.log("Web3 initialized successfully");
    console.log("Connected account:", account);

    // Get network details
    const networkId = await web3.eth.net.getId();
    console.log("Network ID:", networkId);

    // Check contract
    const contractAddress = propertyContract.options.address;
    console.log("Contract address:", contractAddress);

    // Test contract deployment
    const code = await web3.eth.getCode(contractAddress);
    console.log("Contract deployed:", code !== "0x");

    // Get ETH balance
    const balance = await web3.eth.getBalance(account);
    console.log(
      "Account balance:",
      web3.utils.fromWei(balance, "ether"),
      "ETH"
    );

    // Test contract with a properties mapping call
    try {
      console.log("Testing contract read operation...");
      const propertyDetails = await propertyContract.methods
        .properties(account)
        .call();
      console.log("Property details test:", propertyDetails);

      // Only attempt test registration if balance is sufficient
      if (web3.utils.fromWei(balance, "ether") > "1") {
        console.log("Testing contract write operation...");
        const gasEstimate = await propertyContract.methods
          .registerProperty(
            "TEST123",
            "Test Property",
            "Test Location",
            "Residential"
          )
          .estimateGas({ from: account });

        console.log("Estimated gas for registration:", gasEstimate);

        const testTx = await propertyContract.methods
          .registerProperty(
            "TEST123",
            "Test Property",
            "Test Location",
            "Residential"
          )
          .send({
            from: account,
            gas: Math.round(gasEstimate * 1.2), // Add 20% buffer
          });

        console.log("Test registration successful:", testTx);
      } else {
        console.log("Skipping test registration due to insufficient balance");
      }
    } catch (contractError) {
      // This is expected for new accounts or if property doesn't exist
      console.log("Contract interaction test result:", contractError.message);
      if (contractError.message.includes("gas")) {
        console.warn(
          "Gas estimation failed. This might indicate an issue with the contract or network configuration."
        );
      }
    }

    const summary = {
      networkConnected: true,
      networkId: networkId,
      contractDeployed: code !== "0x",
      accountConnected: !!account,
      balance: web3.utils.fromWei(balance, "ether") + " ETH",
    };

    console.log("Debug Summary:", summary);
    return "Debug complete - all systems operational";
  } catch (error) {
    console.error("Debug setup failed:", error);
    return `Debug failed: ${error.message}`;
  }
};

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
      } else {
        console.log("Email input field not found");
      }
    } else {
      console.log("No user email data available");
    }
  } catch (error) {
    console.error("Error prefilling email:", error);
  }
}

// India Post API integration for pincode lookup
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

// Validation helper functions
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
};

// Function to validate form fields
function validateForm() {
  const phoneInputs = document.querySelectorAll('input[type="tel"]');
  const emailInputs = document.querySelectorAll('input[type="email"]');
  const idInputs = document.querySelectorAll(
    'input[placeholder="Aadhar / PAN Number"]'
  );
  const transactionDate = document.querySelector('input[type="date"]').value;
  const selectedDate = new Date(transactionDate);
  const currentDate = new Date();

  let isValid = true;
  let errorMessage = "";

  // Check all required fields
  const allInputs = document.querySelectorAll('input:not([type="file"])');
  const allSelects = document.querySelectorAll("select");
  const allFileInputs = document.querySelectorAll('input[type="file"]');

  // Specifically check appointment details
  const registrarOffice = document.getElementById("Choose");
  const appointmentDateTime = document.getElementById("date");

  // Validate appointment details first
  if (
    !registrarOffice ||
    registrarOffice.value === "" ||
    registrarOffice.value === "register"
  ) {
    isValid = false;
    errorMessage = "Please select a Sub-Registrar Office";
    alert(errorMessage);
    return false;
  }

  if (
    !appointmentDateTime ||
    appointmentDateTime.value === "" ||
    appointmentDateTime.value === "date"
  ) {
    isValid = false;
    errorMessage = "Please select Date and Time for appointment";
    alert(errorMessage);
    return false;
  }

  // Validate all input fields are filled
  allInputs.forEach((input) => {
    if (input.value.trim() === "") {
      isValid = false;
      errorMessage = `${input.placeholder || "All fields"} is required`;
    }
  });

  // Validate all select fields are chosen
  allSelects.forEach((select) => {
    if (select.value === "") {
      isValid = false;
      errorMessage = `Please select ${select.id || "all dropdown fields"}`;
    }
  });

  // Validate all file inputs have files
  allFileInputs.forEach((fileInput) => {
    if (!fileInput.files || fileInput.files.length === 0) {
      isValid = false;
      const documentLabel = fileInput.previousElementSibling.textContent
        .trim()
        .split("\n")[0];
      errorMessage = `Please upload ${documentLabel}`;
    }
  });

  if (!isValid) {
    alert(errorMessage);
    return false;
  }

  // Validate phone numbers
  phoneInputs.forEach((input) => {
    if (!validations.phone.regex.test(input.value)) {
      isValid = false;
      errorMessage = validations.phone.message;
    }
  });

  // Validate emails
  emailInputs.forEach((input) => {
    if (!validations.email.regex.test(input.value)) {
      isValid = false;
      errorMessage = validations.email.message;
    }
  });

  // Validate ID numbers
  idInputs.forEach((input) => {
    const validation = validateIdNumber(input.value);
    if (!validation.isValid) {
      isValid = false;
      errorMessage = validation.message;
    }
  });

  // Validate date
  selectedDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);
  if (selectedDate > currentDate) {
    isValid = false;
    errorMessage = "Transaction date cannot be in the future";
  }

  if (!isValid) {
    alert(errorMessage);
  }
  return isValid;
}

// Function to validate ID based on format
function validateIdNumber(value) {
  const cleanValue = value.replace(/\s/g, "");

  if (/^\d+$/.test(cleanValue) && cleanValue.length === 12) {
    return {
      type: "aadhaar",
      isValid: validations.aadhaar.regex.test(cleanValue),
      value: cleanValue,
      message: validations.aadhaar.message,
    };
  }

  // For PAN, ensure it's in uppercase and follows the exact format
  const upperValue = cleanValue.toUpperCase();
  if (upperValue !== cleanValue) {
    return {
      type: "pan",
      isValid: false,
      value: upperValue,
      message: "PAN number must be in UPPERCASE (Format: ABCDE1234F)",
    };
  }

  return {
    type: "pan",
    isValid: validations.pan.regex.test(upperValue),
    value: upperValue,
    message: validations.pan.message,
  };
}

// Fee calculation helper
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

// Helper function to create locality dropdown UI
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

// Setup pincode lookup functionality
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

// Property data fetch and form population
async function fetchPropertyDetails(propertyId) {
  try {
    const response = await fetch(`/api/property/${propertyId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Property not found");
    }

    const data = await response.json();

    // Populate form fields with property data
    document.querySelector('input[placeholder="Property ID"]').value =
      propertyId;
    document.querySelector('input[placeholder="City"]').value = data.city || "";
    document.querySelector('input[placeholder="Land Area"]').value =
      data.land_area || "";
    document.querySelector('input[placeholder="Built-up Area"]').value =
      data.built_up_area || "";
    document.querySelector(
      'input[placeholder="Property Classification"]'
    ).value = data.property_classification || "";

    // Set property type and make it readonly
    const propertyTypeSelect = document.getElementById("propertyType");
    if (data.type_of_property) {
      Array.from(propertyTypeSelect.options).forEach((option) => {
        if (
          option.value.toLowerCase() === data.type_of_property.toLowerCase()
        ) {
          propertyTypeSelect.value = option.value;
          // Make the select element readonly
          propertyTypeSelect.disabled = true;
          propertyTypeSelect.style.opacity = "0.8";
          propertyTypeSelect.style.cursor = "not-allowed";
        }
      });
    }

    // Calculate and set stamp duty if purchase value exists
    const purchaseValueInput = document.querySelector(
      'input[placeholder="Purchase Value"]'
    );
    const stampDutyInput = document.querySelector(
      'input[placeholder="Stamp Duty & Registration Fees"]'
    );

    if (purchaseValueInput.value) {
      const estimatedFees = calculateEstimatedFees(
        purchaseValueInput.value,
        data.city,
        data.type_of_property
      );
      stampDutyInput.value = estimatedFees;
    }

    // If property has location info, trigger pincode lookup
    if (data.pincode) {
      const pincodeInput = document.querySelector(
        'input[placeholder="Pincode"]'
      );
      if (pincodeInput) {
        pincodeInput.value = data.pincode;
        // Create and dispatch an input event to trigger the pincode lookup
        const inputEvent = new Event("input", { bubbles: true });
        pincodeInput.dispatchEvent(inputEvent);
      }
    }

    // If property has plot/flat number
    if (data.plot_number) {
      document.querySelector('input[placeholder="Plot / Flat Number"]').value =
        data.plot_number;
    }

    // If property has street address
    if (data.street) {
      document.querySelector('input[placeholder="Street"]').value = data.street;
    }

    // If property has locality
    if (data.locality) {
      document.querySelector('input[placeholder="Locality"]').value =
        data.locality;
    }

    // Handle transaction type if available
    if (data.transaction_type) {
      const transactionTypeSelect = document.getElementById("transactionType");
      if (transactionTypeSelect) {
        Array.from(transactionTypeSelect.options).forEach((option) => {
          if (
            option.value.toLowerCase() === data.transaction_type.toLowerCase()
          ) {
            transactionTypeSelect.value = option.value;
          }
        });
      }
    }
  } catch (error) {
    console.error("Error fetching property details:", error);
    alert("Could not find property with the given ID");

    // Clear form fields
    const formFields = [
      "Property ID",
      "City",
      "Land Area",
      "Built-up Area",
      "Property Classification",
      "Plot / Flat Number",
      "Street",
      "Locality",
    ];

    formFields.forEach((field) => {
      const input = document.querySelector(`input[placeholder="${field}"]`);
      if (input) input.value = "";
    });

    // Reset property type select
    const propertyTypeSelect = document.getElementById("propertyType");
    if (propertyTypeSelect) {
      propertyTypeSelect.value = "";
      propertyTypeSelect.disabled = false;
      propertyTypeSelect.style.opacity = "1";
      propertyTypeSelect.style.cursor = "pointer";
    }

    // Reset transaction type select
    const transactionTypeSelect = document.getElementById("transactionType");
    if (transactionTypeSelect) {
      transactionTypeSelect.value = "";
    }
  }
}

// Initialize form function
async function initializeForm() {
  if (await checkAuthentication()) {
    console.log("Authentication successful, initializing form...");

    // Initialize blockchain
    await initializeBlockchain();

    // Prefill email
    await prefillUserEmail();

    // Setup form elements and event listeners
    setupFormElements();
    setupEventListeners();
  }
}

// Setup form elements
function setupFormElements() {
  const propertyForm = document.getElementById("propertyForm");
  const permanentAddressInputs = document.querySelectorAll(
    'input[placeholder="Permanent Address"]'
  );
  const currentAddressInputs = document.querySelectorAll(
    'input[placeholder="Current Address"]'
  );
  const addressNotes = document.querySelectorAll("em");

  // Back button
  document.getElementById("backButton")?.addEventListener("click", () => {
    history.back();
  });

  // Setup address copy functionality
  permanentAddressInputs.forEach((permanentInput, index) => {
    const currentInput = currentAddressInputs[index];
    const noteElement = addressNotes[index];

    if (
      noteElement &&
      currentInput &&
      noteElement.textContent.includes(
        "Current Address is same as permanent address?"
      )
    ) {
      noteElement.style.cursor = "pointer";
      noteElement.addEventListener("click", () => {
        if (permanentInput.value.trim()) {
          currentInput.value = permanentInput.value;
        } else {
          alert("Please fill in the permanent address first");
        }
      });
    }
  });

  // Setup form submission
  if (propertyForm) {
    propertyForm.addEventListener("submit", handleFormSubmit);
  }
}

// Handle form submission
// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!isAuthenticated()) {
    window.location.href = "/login.html";
    return;
  }

  if (!validateForm()) {
    return;
  }

  const submitButton = document.querySelector(".continue-btn");
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";

  try {
    // Collect form data
    const propertyData = {
      propertyId: document.querySelector('input[placeholder="Property ID"]')
        .value,
      plotNumber: document.querySelector(
        'input[placeholder="Plot / Flat Number"]'
      ).value,
      propertyName: document.querySelector('input[placeholder="Street"]').value,
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
      purchaseValue: document.querySelector(
        'input[placeholder="Purchase Value"]'
      ).value,
      stampDuty: document.querySelector(
        'input[placeholder="Stamp Duty & Registration Fees"]'
      ).value,
    };

    // Register on blockchain
    const blockchainResult = await registerPropertyOnBlockchain(propertyData);

    if (!blockchainResult.success) {
      throw new Error(blockchainResult.error);
    }

    // Create FormData instance
    const formData = new FormData();

    // Add the registration type
    formData.append("registrationType", "NEW_PROPERTY");

    // Add owner information
    const ownerInfo = {
      firstName: document.querySelector('input[placeholder="First Name"]')
        .value,
      lastName: document.querySelector('input[placeholder="Last Name"]').value,
      email: document.querySelector('input[placeholder="Email Address"]').value,
      phone: document.querySelector('input[placeholder="Phone Number"]').value,
      idNumber: document.querySelector(
        'input[placeholder="Aadhar / PAN Number"]'
      ).value,
      permanentAddress: document.querySelector(
        'input[placeholder="Permanent Address"]'
      ).value,
      currentAddress: document.querySelector(
        'input[placeholder="Current Address"]'
      ).value,
      blockchainId: blockchainResult.blockchainId,
    };
    formData.append("ownerInfo", JSON.stringify(ownerInfo));

    // Add property information
    const propertyInfo = {
      ...propertyData,
      blockchainId: blockchainResult.blockchainId,
      transactionHash: blockchainResult.transactionHash,
    };
    formData.append("propertyInfo", JSON.stringify(propertyInfo));

    // Add witness information
    const witnessInfo = {
      firstName: document.querySelectorAll('input[placeholder="First Name"]')[1]
        .value,
      lastName: document.querySelectorAll('input[placeholder="Last Name"]')[1]
        .value,
      email: document.querySelectorAll('input[placeholder="Email Address"]')[1]
        .value,
      phone: document.querySelectorAll('input[placeholder="Phone Number"]')[1]
        .value,
      idNumber: document.querySelectorAll(
        'input[placeholder="Aadhar / PAN Number"]'
      )[1].value,
      permanentAddress: document.querySelectorAll(
        'input[placeholder="Permanent Address"]'
      )[1].value,
      currentAddress: document.querySelectorAll(
        'input[placeholder="Current Address"]'
      )[1].value,
    };
    formData.append("witnessInfo", JSON.stringify(witnessInfo));

    // Add appointment information
    const appointmentInfo = {
      office: document.getElementById("Choose")?.value || "",
      datetime: document.getElementById("date")?.value || "",
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

    // Submit to backend
    const response = await fetch("/api/register-property", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        // Note: Don't set Content-Type when using FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    const responseData = await response.json();

    // Show success message
    alert(
      `Property registered successfully!\nBlockchain ID: ${blockchainResult.blockchainId}\nTransaction Hash: ${blockchainResult.transactionHash}`
    );

    // Redirect to success page
    window.location.href = "./registered.html";
  } catch (error) {
    console.error("Registration failed:", error);
    alert(`Registration failed: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Continue";
  }
}

// Helper function to handle API errors
async function handleApiResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Server error: ${response.status}`);
  }
  return response.json();
}

// Prepare form data for submission
async function prepareFormData(blockchainId) {
  const formData = new FormData();
  formData.append("registrationType", "NEW_PROPERTY");

  // Owner information with blockchain ID
  const ownerInfo = {
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
    blockchainId: blockchainId,
  };
  formData.append("ownerInfo", JSON.stringify(ownerInfo));

  // Property information
  const propertyInfo = {
    propertyId: document.querySelector('input[placeholder="Property ID"]')
      .value,
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
    blockchainId: blockchainId,
  };
  formData.append("propertyInfo", JSON.stringify(propertyInfo));

  // Witness information
  const witnessInfo = {
    firstName: document.querySelectorAll('input[placeholder="First Name"]')[1]
      .value,
    lastName: document.querySelectorAll('input[placeholder="Last Name"]')[1]
      .value,
    email: document.querySelectorAll('input[placeholder="Email Address"]')[1]
      .value,
    phone: document.querySelectorAll('input[placeholder="Phone Number"]')[1]
      .value,
    idNumber: document.querySelectorAll(
      'input[placeholder="Aadhar / PAN Number"]'
    )[1].value,
    permanentAddress: document.querySelectorAll(
      'input[placeholder="Permanent Address"]'
    )[1].value,
    currentAddress: document.querySelectorAll(
      'input[placeholder="Current Address"]'
    )[1].value,
  };
  formData.append("witnessInfo", JSON.stringify(witnessInfo));

  // Appointment details
  const appointmentInfo = {
    office: document.getElementById("Choose").value,
    datetime: document.getElementById("date").value,
  };
  formData.append("appointmentInfo", JSON.stringify(appointmentInfo));

  // Document files
  const documentInputs = [
    "saleDeed",
    "taxReceipts",
    "encumbrance",
    "occupancy",
    "buildingPlan",
    "powerAttorney",
    "photoCertificate",
  ];

  documentInputs.forEach((id) => {
    const fileInput = document.getElementById(id);
    if (fileInput.files[0]) {
      formData.append(id, fileInput.files[0]);
    }
  });

  return formData;
}

// Setup all event listeners
function setupEventListeners() {
  // Property ID lookup event
  const propertyIdInput = document.querySelector(
    'input[placeholder="Property ID"]'
  );
  propertyIdInput?.addEventListener("input", (e) => {
    const propertyId = e.target.value.trim();
    if (propertyId.length >= 6) {
      fetchPropertyDetails(propertyId);
    }
  });

  // Setup PAN input handling
  const panInputs = document.querySelectorAll(
    'input[placeholder="Aadhar / PAN Number"]'
  );
  panInputs.forEach((input) => {
    input.addEventListener("input", function (e) {
      const value = e.target.value;
      // Check if the input matches PAN format (or starting to)
      if (/^[A-Za-z0-9]*$/.test(value)) {
        // Convert to uppercase and update the input
        const upperValue = value.toUpperCase();
        e.target.value = upperValue;

        // Optional: Add visual feedback if it matches complete PAN format
        if (validations.pan.regex.test(upperValue)) {
          input.style.borderColor = "#4CAF50"; // Green for valid
        } else {
          input.style.borderColor = ""; // Reset to default
        }
      } else {
        // If invalid characters are entered, remove them
        e.target.value = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      }
    });
  });

  // Date validation
  setupDateValidation();

  // Purchase value and stamp duty calculation
  setupPurchaseValueCalculation();

  // Pincode lookup
  setupPincodeLookup();

  // File upload handling
  setupFileUploadHandlers();
}

// Setup date validation
function setupDateValidation() {
  const transactionDateInput = document.querySelector('input[type="date"]');
  if (transactionDateInput) {
    const today = new Date().toISOString().split("T")[0];
    transactionDateInput.setAttribute("max", today);

    transactionDateInput.addEventListener("input", function () {
      const selectedDate = new Date(this.value);
      const currentDate = new Date();

      selectedDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);

      if (selectedDate > currentDate) {
        this.value = today;
        alert("Transaction date cannot be in the future");
      }
    });
  }
}

// Setup purchase value calculation
function setupPurchaseValueCalculation() {
  const purchaseValueInput = document.querySelector(
    'input[placeholder="Purchase Value"]'
  );
  const cityInput = document.querySelector('input[placeholder="City"]');
  const propertyTypeSelect = document.getElementById("propertyType");
  const stampDutyInput = document.querySelector(
    'input[placeholder="Stamp Duty & Registration Fees"]'
  );

  purchaseValueInput?.addEventListener("input", function () {
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

// Setup file upload handlers
function setupFileUploadHandlers() {
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", function (e) {
      const file = e.target.files[0];
      const maxSize = e.target.dataset.maxSize * 1024 * 1024;
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeForm().catch((error) => {
    console.error("Form initialization failed:", error);
  });
  // debugWeb3Setup().then(console.log);
});

export { checkAuthentication, initializeForm };
