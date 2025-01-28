document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("personal-info-form");
  const documentForm = document.getElementById("document-info-form");
  const continueButton = document.getElementById("continue-button");
  const sameAddressCheckbox = document.getElementById("same-address");
  const permanentAddress = document.getElementById("permanent-address");
  const currentAddress = document.getElementById("current-address");
  const uploadInput = document.getElementById("upload-document");
  const loadingOverlay = document.getElementById("loading-overlay");
  const emailInput = document.getElementById("email");

  // Check authentication status
  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found");
        return false;
      }

      const response = await fetch("/checkAuth", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.log("Auth check failed");
        return false;
      }

      const data = await response.json();
      return data.authenticated;
    } catch (error) {
      console.error("Auth check error:", error);
      return false;
    }
  };

  // Fetch and autofill user data from JWT
  const autoFillUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token for user data fetch");
        return;
      }

      const response = await fetch("/getUserData", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }

      const userData = await response.json();

      // Autofill email and make it read-only
      emailInput.value = userData.email;
      emailInput.readOnly = true;
      emailInput.classList.add("readonly-field");

      // If name is available, autofill name fields
      if (userData.name) {
        const names = userData.name.split(" ");
        document.getElementById("first-name").value = names[0] || "";
        document.getElementById("last-name").value =
          names.slice(1).join(" ") || "";
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  // Initialize form with auth check
  const initializeForm = async () => {
    const isAuthenticated = await checkAuth();

    if (!isAuthenticated) {
      console.log("User not authenticated");
      if (confirm("Please log in to continue. Redirect to login page?")) {
        window.location.href = "./login.html";
      }
      return;
    }

    await autoFillUserData();
  };

  // Call initialize function
  await initializeForm();

  // Generate a unique request ID
  const generateRequestId = () => {
    return "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  };

  // Show/hide loading overlay
  const toggleLoading = (show) => {
    loadingOverlay.classList.toggle("hidden", !show);
    continueButton.disabled = show;
  };

  // Validate file type using both extension and MIME type
  const validateFile = (file) => {
    // Allowed file extensions and MIME types
    const allowedExtensions = [".pdf"];
    const allowedMimeTypes = ["application/pdf"];

    // Get file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = "." + fileName.split(".").pop();

    // Check extension
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error("Please upload a PDF document");
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error("Invalid file type. Please upload a valid PDF document");
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("File size should not exceed 10MB");
    }

    return true;
  };

  // Handle same address checkbox
  sameAddressCheckbox.addEventListener("change", () => {
    if (sameAddressCheckbox.checked) {
      currentAddress.value = permanentAddress.value;
      currentAddress.disabled = true;
    } else {
      currentAddress.disabled = false;
    }
  });

  // Handle file upload
  uploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        validateFile(file);
      } catch (error) {
        alert(error.message);
        uploadInput.value = "";
      }
    }
  });

  // Form validation
  const validateForm = () => {
    const firstName = document.getElementById("first-name").value;
    const lastName = document.getElementById("last-name").value;
    const email = emailInput.value;
    const phone = document.getElementById("phone-number").value;
    const idNumber = document.getElementById("aadhaar-pan").value;
    const pAddress = permanentAddress.value;
    const cAddress = currentAddress.value;
    const documentType = document.getElementById("document-type").value;
    const uploadedFile = uploadInput.files[0];

    if (
      !firstName ||
      !lastName ||
      !phone ||
      !idNumber ||
      !pAddress ||
      !cAddress ||
      !documentType ||
      !uploadedFile
    ) {
      throw new Error(
        "Please fill in all required fields and upload a document"
      );
    }

    // Validate phone number (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      throw new Error("Please enter a valid 10-digit phone number");
    }

    // Validate ID number (Aadhaar: 12 digits, PAN: 10 alphanumeric)
    const aadhaarRegex = /^\d{12}$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!aadhaarRegex.test(idNumber) && !panRegex.test(idNumber)) {
      throw new Error(
        "Please enter a valid Aadhaar (12 digits) or PAN (10 alphanumeric) number"
      );
    }

    return {
      firstName,
      lastName,
      email,
      phone,
      idNumber,
      permanentAddress: pAddress,
      currentAddress: cAddress,
      documentType,
    };
  };

  // Form submission handler
  continueButton.addEventListener("click", async (e) => {
    e.preventDefault();

    // Check authentication before submission
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      if (
        confirm("Your session has expired. Please log in again to continue.")
      ) {
        window.location.href = "./login.html";
      }
      return;
    }

    try {
      // Validate form and get form data
      const formData = new FormData();
      const personalInfo = validateForm();
      const uploadedFile = uploadInput.files[0];

      // Validate file again
      validateFile(uploadedFile);

      // Generate request ID
      const requestId = generateRequestId();

      // Append all data to FormData
      formData.append("requestId", requestId);
      formData.append("document", uploadedFile);
      formData.append("personalInfo", JSON.stringify(personalInfo));

      // Show loading spinner
      toggleLoading(true);

      // Submit the form data
      const response = await fetch("/api/request-verification", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Submission failed");
      }

      const result = await response.json();

      // Store the verification request ID
      localStorage.setItem("verificationRequestId", result.requestId);
      localStorage.setItem("documentType", personalInfo.documentType);

      // Redirect to view documents page
      window.location.href = "./viewdoc.html";
    } catch (error) {
      console.error("Submission error:", error);
      alert(
        error.message ||
          "There was an error submitting your document. Please try again."
      );
    } finally {
      toggleLoading(false);
    }
  });

  // Back button functionality
  document.getElementById("backButton").addEventListener("click", () => {
    history.back();
  });
});
