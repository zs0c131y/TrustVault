// blockdoc.js
import { isAuthenticated, getAuthHeaders } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchInput");
  const verifyButton = document.getElementById("verifyButton");
  const errorMessage = document.getElementById("errorMessage");
  const resultContainer = document.getElementById("resultContainer");
  const backButton = document.getElementById("backButton");
  const loadingSpinner = document.getElementById("loadingSpinner");

  // Initialize with auth check
  const initializePage = async () => {
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        window.location.href = "./login.html";
        return;
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      window.location.href = "./login.html";
    }
  };

  // Call initialize function
  await initializePage();

  // Add visibility change listener for continuous auth check
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      isAuthenticated().then((auth) => {
        if (!auth) {
          window.location.href = "./login.html";
        }
      });
    }
  });

  const isValidEthereumAddress = (address) => {
    const ethereumRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethereumRegex.test(address);
  };

  const toggleLoading = (show) => {
    if (loadingSpinner) {
      loadingSpinner.style.display = show ? "block" : "none";
    }
    if (verifyButton) {
      verifyButton.disabled = show;
    }
  };

  const createVerifiedProperty = (data) => {
    return `
      <div class="property-details">
        Your Document is ${data.verified ? 'Verified ✅' : 'Not Verified ⌛'}
      </div>
      <div class="property-card">
        <div class="property-title">Document Type: ${data.documentType}</div>
        <div class="blockchain-id">Blockchain ID: ${data.blockchainId}</div>
      </div>
    `;
  };

  const createPendingMessage = (blockchainId) => {
    const documentType =
      localStorage.getItem("documentType") || "Not Available";

    return `
      <div class="property-details">
        Your Document is Not Verified
      </div>
      <div class="property-card">
        <div class="property-title">Document Type: ${documentType}</div>
        <div class="address">Verified On: Not Verified</div>
        <div class="blockchain-id">Blockchain ID: ${blockchainId}</div>
      </div>
    `;
  };

  const handleVerification = async () => {
    const value = searchInput.value;
  
    if (!isValidEthereumAddress(value)) {
      errorMessage.textContent = "Please enter a valid blockchain ID";
      errorMessage.style.display = "block";
      resultContainer.innerHTML = "";
      return;
    }
  
    try {
      if (!(await isAuthenticated())) {
        window.location.href = "./login.html";
        return;
      }
  
      errorMessage.style.display = "none";
      toggleLoading(true);
  
      const response = await fetch(`/api/verify-document/${value}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || 'Verification request failed');
      }
  
      resultContainer.innerHTML = createVerifiedProperty({
        blockchainId: value,
        verified: data.verified,
        documentType: data.documentType
      });
    } catch (error) {
      console.error("Verification error:", error);
      errorMessage.textContent = error.message || "Failed to verify document. Please try again.";
      errorMessage.style.display = "block";
      resultContainer.innerHTML = "";
    } finally {
      toggleLoading(false);
    }
  };

  // Enable/disable verify button based on input
  searchInput?.addEventListener("input", (e) => {
    const value = e.target.value;
    errorMessage.style.display = "none";
    verifyButton.disabled = !value;
  });

  // Handle verification on button click
  verifyButton?.addEventListener("click", handleVerification);

  // Handle back button click
  backButton?.addEventListener("click", () => {
    history.back();
  });

  // Handle enter key press
  searchInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !verifyButton.disabled) {
      handleVerification();
    }
  });

  // Error handling utility
  const handleError = (error, customMessage = "An error occurred") => {
    console.error(error);
    errorMessage.textContent = customMessage;
    errorMessage.style.display = "block";
    toggleLoading(false);
  };

  // Add some basic error handlers
  window.addEventListener("unhandledrejection", (event) => {
    handleError(
      event.reason,
      "An unexpected error occurred. Please try again."
    );
  });

  // Handle network errors
  window.addEventListener("offline", () => {
    handleError(
      new Error("Network offline"),
      "Please check your internet connection."
    );
  });
});
