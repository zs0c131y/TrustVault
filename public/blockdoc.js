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
    const documentType =
      localStorage.getItem("documentType") || "Not Available";
    const verificationDate = new Date(
      data.verificationDate || Date.now()
    ).toLocaleDateString();

    return `
      <div class="property-details">
        Congratulations! Your Document is Verified
      </div>
      <div class="property-card">
        <div class="property-title">Document Type: <span id="document">${documentType}</span></div>
        <div class="address">Verified On: <span id="date">${verificationDate}</span></div>
        <div class="blockchain-id">Blockchain ID: <span>${
          data.blockchainId
        }</span></div>
        ${
          data.additionalInfo
            ? `<div class="additional-info">${data.additionalInfo}</div>`
            : ""
        }
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
      // Check authentication before proceeding
      if (!(await isAuthenticated())) {
        window.location.href = "./login.html";
        return;
      }

      errorMessage.style.display = "none";
      toggleLoading(true);

      // Make API call to verify document with proper error handling
      const response = await fetch(`/api/verify-document/${value}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      // Handle HTTP error responses
      if (!response.ok) {
        if (response.status === 404) {
          resultContainer.innerHTML = createPendingMessage(value);
          return;
        }

        // Try to get detailed error message from response
        let errorMsg = "Verification request failed";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (e) {
          // If parsing JSON fails, use status text
          errorMsg = response.statusText || errorMsg;
        }

        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (data.verified) {
        resultContainer.innerHTML = createVerifiedProperty({
          blockchainId: value,
          verificationDate: data.verificationDate,
          additionalInfo: data.additionalInfo,
        });
      } else {
        resultContainer.innerHTML = createPendingMessage(value);
      }
    } catch (error) {
      console.error("Verification error:", error);
      errorMessage.textContent =
        error.message || "Failed to verify document. Please try again.";
      errorMessage.style.display = "block";
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
