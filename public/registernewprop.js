import { getToken, getAuthHeaders, isAuthenticated } from "./auth.js";

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
      // Target the first email input in the owner's section
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

// UI helper for locality selection
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

    // Set property type if available
    const propertyTypeSelect = document.getElementById("propertyType");
    if (data.type_of_property) {
      Array.from(propertyTypeSelect.options).forEach((option) => {
        if (
          option.value.toLowerCase() === data.type_of_property.toLowerCase()
        ) {
          propertyTypeSelect.value = option.value;
        }
      });
    }

    // Calculate and set stamp duty
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
  } catch (error) {
    console.error("Error fetching property details:", error);
    alert("Could not find property with the given ID");
  }
}

// Initialize form function
async function initializeForm() {
  if (await checkAuthentication()) {
    console.log("Authentication successful, initializing form...");

    // First prefill the email
    await prefillUserEmail();

    // Form elements
    const propertyForm = document.getElementById("propertyForm");
    const permanentAddressInputs = document.querySelectorAll(
      'input[placeholder="Permanent Address"]'
    );
    const currentAddressInputs = document.querySelectorAll(
      'input[placeholder="Current Address"]'
    );
    const addressNotes = document.querySelectorAll("em");

    // Property lookup and fee calculation elements
    const propertyIdInput = document.querySelector(
      'input[placeholder="Property ID"]'
    );
    const purchaseValueInput = document.querySelector(
      'input[placeholder="Purchase Value"]'
    );
    const cityInput = document.querySelector('input[placeholder="City"]');
    const propertyTypeSelect = document.getElementById("propertyType");
    const stampDutyInput = document.querySelector(
      'input[placeholder="Stamp Duty & Registration Fees"]'
    );

    // Property ID lookup event
    propertyIdInput?.addEventListener("input", (e) => {
      const propertyId = e.target.value.trim();
      if (propertyId.length >= 6) {
        fetchPropertyDetails(propertyId);
      }
    });

    // Purchase value and stamp duty calculation event
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

    // Pincode lookup functionality
    const sections = document.querySelectorAll("section");
    sections.forEach((section) => {
      const pincodeInput = section.querySelector(
        'input[placeholder="Pincode"]'
      );
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
                    const { dropdownContainer, select } =
                      createLocalityDropdown(result.postOffices, section);
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
                }
              } catch (error) {
                console.error("Error in pincode lookup:", error);
                alert("Error fetching location data");
              }
            }
          });
        }
      }
    });

    // Same address functionality
    addressNotes.forEach((note, index) => {
      note.style.cursor = "pointer";
      note.addEventListener("click", () => {
        const permanentAddress =
          permanentAddressInputs[Math.floor(index / 2)].value;
        const currentAddressInput = currentAddressInputs[Math.floor(index / 2)];

        if (permanentAddress) {
          currentAddressInput.value = permanentAddress;
        } else {
          alert("Please fill in the permanent address first");
        }
      });
    });

    // File upload handling
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

    // Form submission
    propertyForm?.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!isAuthenticated()) {
        window.location.href = "/login.html";
        return;
      }

      const formData = new FormData();

      // Owner information
      const ownerInfo = {
        firstName: document.querySelector('input[placeholder="First Name"]')
          .value,
        lastName: document.querySelector('input[placeholder="Last Name"]')
          .value,
        email: document.querySelector('input[placeholder="Email Address"]')
          .value,
        phone: document.querySelector('input[placeholder="Phone Number"]')
          .value,
        idNumber: document.querySelector(
          'input[placeholder="Aadhar / PAN Number"]'
        ).value,
        permanentAddress: document.querySelector(
          'input[placeholder="Permanent Address"]'
        ).value,
        currentAddress: document.querySelector(
          'input[placeholder="Current Address"]'
        ).value,
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
        landArea: document.querySelector('input[placeholder="Land Area"]')
          .value,
        builtUpArea: document.querySelector(
          'input[placeholder="Built-up Area"]'
        ).value,
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
      formData.append("propertyInfo", JSON.stringify(propertyInfo));

      // Witness information
      const witnessInfo = {
        firstName: document.querySelectorAll(
          'input[placeholder="First Name"]'
        )[1].value,
        lastName: document.querySelectorAll('input[placeholder="Last Name"]')[1]
          .value,
        email: document.querySelectorAll(
          'input[placeholder="Email Address"]'
        )[1].value,
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

      try {
        const response = await fetch("/api/register-property", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        });

        const data = await response.json();

        if (response.ok) {
          window.location.href = "./registered.html";
        } else {
          alert(
            `Error: ${data.message || "Failed to submit registration request"}`
          );
        }
      } catch (error) {
        console.error("Error:", error);
        alert("Failed to submit registration request. Please try again.");
      }
    });

    // Back button
    document.getElementById("backButton")?.addEventListener("click", () => {
      history.back();
    });
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeForm().catch((error) => {
    console.error("Form initialization failed:", error);
  });
});

export { checkAuthentication, initializeForm };
