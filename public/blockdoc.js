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
        <div class="status-badge ${
          data.isVerified ? "status-verified" : "status-pending"
        }">
          ${data.isVerified ? "Verified ✅" : "Not Verified ⌛"}
        </div>
      </div>
      <div class="property-card">
        <div class="property-title">Document Type: ${
          data.documentType || "Not Available"
        }</div>
        <div class="blockchain-id">Blockchain ID: ${
          data.currentBlockchainId
        }</div>
        <div class="details">
          <div class="detail-row">
            <span class="label">Request ID:</span>
            <span class="value">${data.requestId}</span>
          </div>
          <div class="detail-row">
            <span class="label">Owner:</span>
            <span class="value">${data.owner}</span>
          </div>
          <div class="detail-row">
            <span class="label">Submission Date:</span>
            <span class="value">${new Date(
              data.transactions[0].timestamp
            ).toLocaleString()}</span>
          </div>
          ${
            data.ipfsHash
              ? `
            <div class="detail-row">
              <span class="label">IPFS Hash:</span>
              <span class="value">${data.ipfsHash}</span>
            </div>
          `
              : ""
          }
        </div>
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

      if (!response.ok) {
        throw new Error("Failed to fetch document verification status");
      }

      const data = await response.json();
      console.log("Verification response:", data);

      if (data.success) {
        resultContainer.innerHTML = createVerifiedProperty(data.document);
      } else {
        resultContainer.innerHTML = `
          <div class="property-details">
            <div class="status-badge status-error">
              Document Not Found ❌
            </div>
          </div>
          <div class="property-card">
            <div class="blockchain-id">Blockchain ID: ${value}</div>
            <div class="error-details">
              No verification record found for this blockchain ID
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error("Verification error:", error);
      errorMessage.textContent =
        error.message || "Failed to verify document. Please try again.";
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
