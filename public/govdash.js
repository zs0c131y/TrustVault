import { getToken, getAuthHeaders, isAuthenticated } from "./auth.js";

// State management
let activities = [];
let currentTab = "details";
let currentVerificationDoc = null;

// Fetch dashboard metrics
async function fetchMetrics() {
  try {
    const response = await fetch("/api/metrics", {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Raw metrics response:", data);
    updateMetricsDisplay(data);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    showToast("Failed to load metrics", "error");
  }
}

// Update metrics display
function updateMetricsDisplay(data) {
  console.log("Updating metrics display:", data);

  // Pending Verifications (Registration)
  const pendingValue = document.querySelector(".metric-value.text-red");
  if (pendingValue) {
    pendingValue.textContent = data?.pendingCount || "0";
  }
  const pendingSubtext = document.querySelector(".card .metric-subtext");
  if (pendingSubtext) {
    pendingSubtext.textContent = `${data?.urgentCount || "0"} urgent`;
  }

  // Transfer Requests
  const transferValue = document.querySelector(".metric-value.text-yellow");
  if (transferValue) {
    transferValue.textContent = data?.transferCount || "0";
  }
  const transferSubtext = document.querySelector(
    ".card:nth-child(2) .metric-subtext"
  );
  if (transferSubtext) {
    transferSubtext.textContent = `${
      data?.pendingApprovalCount || "0"
    } pending approval`;
  }

  // Document Verifications
  const verificationValue = document.querySelector(".metric-value.text-green");
  if (verificationValue) {
    verificationValue.textContent = data?.verificationCount || "0";
  }
  const verificationSubtext = document.querySelector(
    ".card:nth-child(3) .metric-subtext"
  );
  if (verificationSubtext) {
    verificationSubtext.textContent = `${data?.verifiedCount || "0"} verified`;
  }
}

// Add this new function to fetch verification documents
async function fetchVerificationDocuments() {
  try {
    const response = await fetch("/api/pending-documents", {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Fetched verification documents:", data);
    return data.success ? data.documents : [];
  } catch (error) {
    console.error("Error fetching verification documents:", error);
    showToast("Failed to load verification documents", "error");
    return [];
  }
}

// Update the verification documents display
async function showVerificationList() {
  try {
    const verificationDocs = await fetchVerificationDocuments();
    const list = document.getElementById("verificationList");
    if (!list) {
      console.error("Verification list container not found");
      return;
    }

    list.innerHTML = '<p class="text-center p-4">Loading documents...</p>';
    list.innerHTML = generateVerificationTable(verificationDocs);
  } catch (error) {
    console.error("Error showing verification list:", error);
    const list = document.getElementById("verificationList");
    if (list) {
      list.innerHTML =
        '<p class="text-center p-4 text-red">Error loading documents</p>';
    }
  }
}

// Update the table generation function to match other tables
function generateVerificationTable(docs) {
  if (!docs || !docs.length) {
    return '<p class="text-center p-4">No verification documents found</p>';
  }

  return `
      <div class="table-container">
          <table class="table">
              <thead>
                  <tr>
                      <th>Request ID</th>
                      <th>Document Type</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th>Action</th>
                  </tr>
              </thead>
              <tbody>
                  ${docs
                    .map(
                      (doc) => `
                      <tr>
                          <td>${doc.requestId}</td>
                          <td>${doc.documentType
                            ?.replace(/-/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}</td>
                          <td>${new Date(
                            doc.submissionDate
                          ).toLocaleDateString()}</td>
                          <td>
                              <span class="status status-${
                                doc.isVerified ? "verified" : "pending"
                              }">
                                  ${doc.isVerified ? "Verified" : "Pending"}
                              </span>
                          </td>
                          <td>
                              <button class="btn-primary" onclick="showVerificationDetails('${
                                doc.requestId
                              }', 'document')">
                                  View & Verify
                              </button>
                          </td>
                      </tr>
                  `
                    )
                    .join("")}
              </tbody>
          </table>
      </div>
  `;
}

// Global window functions
window.showModal = function (modalId) {
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modal = document.getElementById(modalId);

  if (!modal) {
    console.error(`Modal with id ${modalId} not found`);
    return;
  }

  // Show backdrop
  if (modalBackdrop) {
    modalBackdrop.classList.remove("hidden");
  }

  // Show modal
  modal.style.display = "block";

  // Load appropriate content based on modal type
  if (modalId === "pendingModal") {
    showPendingList();
  } else if (modalId === "transferModal") {
    showTransferList();
  } else if (modalId === "verificationModal") {
    showVerificationList();
  }
};

window.closeModal = function (modalId) {
  document.getElementById("modalBackdrop")?.classList.add("hidden");
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
  // Reset current verification doc when closing the modal
  if (modalId === "propertyVerificationModal") {
    currentVerificationDoc = null;
  }
};

window.showToast = function (message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.display = "block";
  toast.style.background = type === "success" ? "var(--green)" : "var(--red)";

  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
};

// Fetch and display pending documents
async function fetchPendingDocuments() {
  try {
    const response = await fetch("/api/pending-requests", {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Fetched pending documents:", data);
    return data.requests || [];
  } catch (error) {
    console.error("Error fetching pending documents:", error);
    showToast("Failed to load pending documents", "error");
    return [];
  }
}

// Document Lists
async function showPendingList() {
  const pendingDocs = await fetchPendingDocuments();
  const list = document.getElementById("pendingList");
  if (list) {
    const registrationDocs =
      pendingDocs.filter((doc) => doc?.type === "registration") || [];
    list.innerHTML = generateDocumentTable(registrationDocs);
  }
}

async function showTransferList() {
  const pendingDocs = await fetchPendingDocuments();
  const list = document.getElementById("transferList");
  if (list) {
    const transferDocs =
      pendingDocs.filter((doc) => doc?.type === "transfer") || [];
    list.innerHTML = generateDocumentTable(transferDocs);
  }
}

async function showCompletedList() {
  try {
    const response = await fetch("/api/pending-requests", {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Fetched completed documents:", data);
    const list = document.getElementById("completedList");
    if (list) {
      const completedDocs =
        data.requests.filter((doc) => doc?.status === "completed") || [];
      list.innerHTML = generateDocumentTable(completedDocs);
    }
  } catch (error) {
    console.error("Error fetching completed documents:", error);
    showToast("Failed to load completed documents", "error");
  }
}

function generateDocumentTable(docs) {
  if (!docs || !docs.length) {
    return '<p class="text-center p-4">No documents found</p>';
  }

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Property ID</th>
          <th>Type</th>
          <th>Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${docs
          .map((doc) => {
            // Extract propertyId from the document structure
            const propertyId = doc.propertyId || "N/A";

            return `
            <tr>
              <td>${propertyId}</td>
              <td>${
                (doc.propertyType || "Unknown").charAt(0).toUpperCase() +
                (doc.propertyType || "").slice(1)
              }</td>
              <td>${
                doc.createdAt
                  ? new Date(doc.createdAt).toLocaleDateString()
                  : "N/A"
              }</td>
              <td>
                <span class="status status-${doc.status || "pending"}">
                  ${(doc.status || "PENDING").toUpperCase()}
                </span>
              </td>
              <td>
                <button class="btn-primary" onclick="showVerificationDetails('${propertyId}', '${
              doc.type
            }')">
                  View & Verify
                </button>
              </td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

// Verification details display
window.showVerificationDetails = async function (id, type) {
  try {
    console.log("Showing verification details for:", { id, type });

    let response;
    let request;

    // Different handling based on verification type
    if (type === "registration" || type === "transfer") {
      // Property verification logic remains the same
      const modal = document.getElementById("propertyVerificationModal");
      if (!modal) return;

      response = await fetch("/api/pending-requests", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      request = data.requests.find(
        (req) => req.propertyId === id && req.type === type
      );

      if (!request) {
        throw new Error("Details not found");
      }

      currentVerificationDoc = request;

      const titleElement = modal.querySelector(".modal-header h2");
      if (titleElement) {
        titleElement.innerHTML = `<i class="fas fa-check-circle"></i> ${
          type === "transfer" ? "Property Transfer" : "Property Registration"
        } Verification`;
      }

      const tabsElement = modal.querySelector(".tabs");
      if (tabsElement) {
        tabsElement.style.display = "flex";
        switchVerificationTab("details");
      }

      modal.style.display = "block";
      document.getElementById("modalBackdrop")?.classList.remove("hidden");
    } else {
      // For document verifications - updated to use correct selectors
      const modal = document.getElementById("verificationModal");
      const content = modal.querySelector(".document-list"); // Changed from modal-body to document-list

      if (!modal || !content) {
        console.error("Modal elements not found");
        return;
      }

      content.innerHTML =
        '<div class="text-center p-4">Loading verification details...</div>';
      modal.style.display = "block";
      document.getElementById("modalBackdrop")?.classList.remove("hidden");

      response = await fetch(`/api/pending-documents/${id}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      content.innerHTML = generateDocumentVerificationContent(data.document);
    }
  } catch (error) {
    console.error("Error showing verification details:", error);
    let errorContainer;

    if (type === "registration" || type === "transfer") {
      errorContainer = document.getElementById("verificationContent");
    } else {
      errorContainer = document.querySelector(".document-list"); // Changed from modal-body
    }

    if (errorContainer) {
      errorContainer.innerHTML = `
              <div class="text-center p-4 text-red">
                  Error loading verification details: ${error.message}
              </div>
          `;
    }
  }
};

window.switchVerificationTab = function (tabName) {
  if (!currentVerificationDoc) return;

  // Update tab styling
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    if (tab.getAttribute("onclick").includes(tabName)) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  // Update content based on selected tab
  const content = document.getElementById("verificationContent");
  if (!content) return;

  try {
    switch (tabName) {
      case "details":
        content.innerHTML = generatePropertyDetails(currentVerificationDoc);
        break;
      case "owner":
        content.innerHTML = generateOwnerInfo(currentVerificationDoc);
        break;
      case "documents":
        content.innerHTML = generateDocumentsList(currentVerificationDoc);
        break;
      case "blockchain":
        content.innerHTML = generateBlockchainInfo(currentVerificationDoc);
        break;
      default:
        content.innerHTML =
          '<p class="text-center p-4">Tab content not available</p>';
    }
  } catch (error) {
    console.error(`Error generating ${tabName} content:`, error);
    content.innerHTML =
      '<p class="text-center p-4 text-red">Error loading content</p>';
  }
};

// Function to generate document verification content
function generateDocumentVerificationContent(doc) {
  return `
    <div class="document-verification-details">
      <!-- Personal Information Section -->
      <div class="section mb-6">
        <h3 class="text-lg font-medium mb-4">Personal Information</h3>
        <div class="detail-row">
          <div class="detail-item">
            <label>Name:</label>
            <span>${doc.personalInfo?.firstName} ${
    doc.personalInfo?.lastName
  }</span>
          </div>
          <div class="detail-item">
            <label>Email:</label>
            <span>${doc.personalInfo?.email || "N/A"}</span>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-item">
            <label>Document Type:</label>
            <span>${doc.documentType || "N/A"}</span>
          </div>
          <div class="detail-item">
            <label>Submission Date:</label>
            <span>${new Date(doc.submissionDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <!-- Document Preview Section -->
      <div class="section mb-6">
        <h3 class="text-lg font-medium mb-4">Document Preview</h3>
        <div class="document-preview">
          ${Object.entries(doc.documents || {})
            .map(
              ([key, value]) => `
            <div class="document-item p-2 border rounded mb-2 flex justify-between items-center">
              <span>${key.replace(/([A-Z])/g, " $1").trim()}</span>
              <button onclick="window.viewVerificationDocument('${
                doc.requestId
              }', '${key}')" class="btn-secondary">
                <i class="fas fa-eye"></i> View
              </button>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <!-- Verification Status Section -->
      <div class="section mb-6">
        <h3 class="text-lg font-medium mb-4">Verification Status</h3>
        <div class="verification-steps">
          ${doc.verificationSteps
            .map(
              (step) => `
            <div class="verification-step ${step.status}">
              <div class="step-icon">
                ${getStepStatusIcon(step.status)}
              </div>
              <div class="step-details">
                <div class="step-name capitalize">${step.step.replace(
                  /_/g,
                  " "
                )}</div>
                <div class="step-timestamp text-gray">
                  ${
                    step.timestamp
                      ? new Date(step.timestamp).toLocaleString()
                      : "Pending"
                  }
                </div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <!-- Blockchain Information -->
      <div class="section mb-6">
        <h3 class="text-lg font-medium mb-4">Blockchain Information</h3>
        <div class="blockchain-info p-4 bg-darker rounded">
          <div class="detail-row">
            <span class="detail-label">IPFS Hash:</span>
            <span class="detail-value">${
              doc.blockchainDetails?.transactionHash || "N/A"
            }</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Blockchain ID:</span>
            <span class="detail-value">${
              doc.blockchainDetails?.contractAddress || "N/A"
            }</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Verification Status:</span>
            <span class="status status-${
              doc.isVerified ? "verified" : "pending"
            }">
              ${doc.isVerified ? "Verified" : "Pending"}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Helper function for step status icons
function getStepStatusIcon(status) {
  switch (status) {
    case "completed":
      return '<i class="fas fa-check-circle text-green"></i>';
    case "pending":
      return '<i class="fas fa-clock text-yellow"></i>';
    default:
      return '<i class="fas fa-circle text-gray"></i>';
  }
}

// Property details generation
window.generatePropertyDetails = function (doc) {
  console.log("Generating property details for doc:", doc);

  return `
      <div class="property-details p-4">
          <div class="detail-row">
              <div class="detail-item">
                  Property ID: ${doc.propertyId || "N/A"}
              </div>
              <div class="detail-item">
                  Property Type: ${
                    (doc.propertyType || "N/A").charAt(0).toUpperCase() +
                    (doc.propertyType || "").slice(1)
                  }
              </div>
          </div>

          <div class="detail-row">
              <div class="detail-item">
                  Location: ${doc.location || "N/A"}
              </div>
              <div class="detail-item">
                  Land Area: ${doc.landArea || "N/A"}
              </div>
          </div>

          <div class="detail-row">
              <div class="detail-item">
                  Built Up Area: ${doc.builtUpArea || "N/A"}
              </div>
              <div class="detail-item">
                  Classification: ${doc.classification || "N/A"}
              </div>
          </div>

          <div class="detail-row">
              <div class="detail-item">
                  Transaction Type: ${
                    (doc.transactionType || "N/A").charAt(0).toUpperCase() +
                    (doc.transactionType || "").slice(1)
                  }
              </div>
              <div class="detail-item">
                  Registration Date: ${
                    doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString()
                      : "N/A"
                  }
              </div>
          </div>

          <div class="detail-row">
              <div class="detail-item">
                  Plot Number: ${doc.plotNumber || "N/A"}
              </div>
          </div>

          <div class="detail-row">
              <div class="detail-item">
                  Purchase Value: ₹${
                    doc.purchaseValue
                      ? Number(doc.purchaseValue).toLocaleString()
                      : "N/A"
                  }
              </div>
              <div class="detail-item">
                  Stamp Duty: ₹${
                    doc.stampDuty
                      ? Number(doc.stampDuty).toLocaleString()
                      : "N/A"
                  }
              </div>
          </div>

          <div class="verification-notes mt-4">
              <h3>Verification Notes</h3>
              <textarea id="verificationNotes" class="w-full p-2 mt-2" rows="4" 
                  placeholder="Add your verification notes here!"></textarea>
          </div>
      </div>
  `;
};

window.generateOwnerInfo = function (doc) {
  const owner = doc.ownerInfo || {};

  return `
    <div class="owner-info">
      <h3 class="mb-4">Owner Details</h3>
      <div class="grid grid-cols-2 gap-4">
        <div class="detail-item">
          <label>Name:</label>
          <span>${owner.name || "N/A"}</span>
        </div>
        <div class="detail-item">
          <label>Email:</label>
          <span>${owner.email || "N/A"}</span>
        </div>
        <div class="detail-item">
          <label>ID Number:</label>
          <span>${owner.idNumber || "N/A"}</span>
        </div>
      </div>
    </div>
  `;
};

window.generateDocumentsList = function (doc) {
  const documents = doc.documents || {};

  return `
    <div class="documents-list">
      ${
        Object.keys(documents).length
          ? Object.entries(documents)
              .map(
                ([key, value]) => `
              <div class="document-item p-2 border rounded mb-2 flex justify-between items-center">
                <span>${key.replace(/([A-Z])/g, " $1").trim()}</span>
                <button onclick="window.viewDocument('${
                  doc.propertyId
                }', '${key}', '${doc.type}')" class="btn-secondary">
                  <i class="fas fa-eye"></i> View
                </button>
              </div>
            `
              )
              .join("")
          : '<p class="text-center p-4">No documents available</p>'
      }
    </div>
  `;
};

window.generateBlockchainInfo = function (doc) {
  const blockchain = doc.blockchainDetails || {};

  return `
    <div class="blockchain-info">
      <h3>Blockchain Information</h3>
      
      <div class="detail-row">
        <span class="detail-label">Transaction Hash:</span>
        <span class="detail-value">${blockchain.transactionHash || "N/A"}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Blockchain ID:</span>
        <span class="detail-value">${blockchain.contractAddress || "N/A"}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Block Number:</span>
        <span class="detail-value">${blockchain.blockNumber || "N/A"}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Verification Status:</span>
        <span class="detail-value status-${
          blockchain.verificationStatus?.toLowerCase() === "verified"
            ? "verified"
            : "pending"
        }">
          ${blockchain.verificationStatus || "Pending"}
        </span>
      </div>
    </div>
  `;
};

// Document viewer
window.viewDocument = async function (propertyId, docKey, type) {
  try {
    const url = `/api/property/${propertyId}/document/${docKey}/view?type=${type}`;
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  } catch (error) {
    console.error("Error viewing document:", error);
    showToast("Failed to load document", "error");
  }
};

// Document verification
window.verifyDocument = async function (docId, type) {
  try {
    const notes = document.getElementById("verificationNotes")?.value;
    if (!notes) {
      showToast("Please add verification notes", "error");
      return;
    }

    const response = await fetch("/api/complete-verification", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: docId,
        type: type || "registration",
        verificationNotes: notes,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    showToast("Document verified successfully");
    closeModal("propertyVerificationModal");
    updateDashboard();
  } catch (error) {
    console.error("Error verifying document:", error);
    showToast("Failed to verify document: " + error.message, "error");
  }
};

// Document rejection
window.rejectDocument = async function (docId) {
  if (!currentVerificationDoc) return;

  const notes = document.getElementById("verificationNotes").value;
  if (!notes) {
    showToast("Please add rejection notes", "error");
    return;
  }

  try {
    const response = await fetch("/api/reject-verification", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: docId,
        type: currentVerificationDoc.type || "registration",
        rejectionNotes: notes,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    showToast("Document rejected");
    closeModal("propertyVerificationModal");
    updateDashboard();
  } catch (error) {
    console.error("Error rejecting document:", error);
    showToast("Failed to reject document", "error");
  }
};

// Generate document details
window.generateDocumentDetails = function (doc) {
  console.log("Generating document details for doc:", doc);

  if (!doc)
    return '<p class="text-center p-4">No document details available</p>';

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  // Get verification step status icon
  const getStepStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return '<i class="fas fa-check-circle text-green"></i>';
      case "pending":
        return '<i class="fas fa-clock text-yellow"></i>';
      default:
        return '<i class="fas fa-circle text-gray"></i>';
    }
  };

  return `
      <div class="document-details p-4">
          <!-- Personal Information Section -->
          <div class="detail-section mb-6">
              <h3 class="text-lg font-medium mb-4">Personal Information</h3>
              <div class="detail-row">
                  <div class="detail-item">
                      <label>Name:</label>
                      <span>${doc.personalInfo.firstName} ${
    doc.personalInfo.lastName
  }</span>
                  </div>
                  <div class="detail-item">
                      <label>Email:</label>
                      <span>${doc.personalInfo.email}</span>
                  </div>
              </div>
              <div class="detail-row">
                  <div class="detail-item">
                      <label>Phone:</label>
                      <span>${doc.personalInfo.phone}</span>
                  </div>
                  <div class="detail-item">
                      <label>ID Number:</label>
                      <span>${doc.personalInfo.idNumber}</span>
                  </div>
              </div>
              <div class="detail-row">
                  <div class="detail-item">
                      <label>Document Type:</label>
                      <span class="capitalize">${doc.documentType.replace(
                        /-/g,
                        " "
                      )}</span>
                  </div>
                  <div class="detail-item">
                      <label>Submission Date:</label>
                      <span>${formatDate(doc.submissionDate)}</span>
                  </div>
              </div>
          </div>

          <!-- Verification Progress Section -->
          <div class="detail-section mb-6">
              <h3 class="text-lg font-medium mb-4">Verification Progress</h3>
              <div class="verification-steps">
                  ${doc.verificationSteps
                    .map(
                      (step) => `
                      <div class="verification-step ${step.status}">
                          <div class="step-icon">
                              ${getStepStatusIcon(step.status)}
                          </div>
                          <div class="step-details">
                              <div class="step-name capitalize">${step.step.replace(
                                /_/g,
                                " "
                              )}</div>
                              <div class="step-timestamp text-gray">
                                  ${
                                    step.timestamp
                                      ? formatDate(step.timestamp)
                                      : "Pending"
                                  }
                              </div>
                          </div>
                      </div>
                  `
                    )
                    .join("")}
              </div>
          </div>

          <!-- Submitted Documents Section -->
          <div class="detail-section mb-6">
              <h3 class="text-lg font-medium mb-4">Submitted Documents</h3>
              <div class="documents-grid grid grid-cols-2 gap-4">
                  ${Object.entries(doc.documents || {})
                    .map(
                      ([key, document]) => `
                      <div class="document-item p-4 border rounded">
                          <div class="document-icon mb-2">
                              <i class="fas fa-file-pdf text-xl"></i>
                          </div>
                          <div class="document-info">
                              <div class="document-name text-sm font-medium mb-1">
                                  ${key.replace(/([A-Z])/g, " $1").trim()}
                              </div>
                              <div class="document-size text-gray text-sm">
                                  ${Math.round(document.size / 1024)} KB
                              </div>
                          </div>
                          <button onclick="window.viewVerificationDocument('${
                            doc.requestId
                          }', '${key}')" 
                                  class="btn-secondary mt-2 w-full">
                              <i class="fas fa-eye"></i> View
                          </button>
                      </div>
                  `
                    )
                    .join("")}
              </div>
          </div>

          <!-- Blockchain Information -->
          <div class="detail-section mb-6">
              <h3 class="text-lg font-medium mb-4">Blockchain Information</h3>
              <div class="blockchain-info p-4 bg-darker rounded">
                  <div class="detail-row">
                      <span class="detail-label">Blockchain ID:</span>
                      <span class="detail-value monospace">${
                        doc.currentBlockchainId || "Not available"
                      }</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Verification Status:</span>
                      <span class="status status-${
                        doc.isVerified ? "verified" : "pending"
                      }">
                          ${doc.isVerified ? "Verified" : "Pending"}
                      </span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Last Updated:</span>
                      <span class="detail-value">${formatDate(
                        doc.lastUpdated
                      )}</span>
                  </div>
              </div>
          </div>

          <!-- Verification Notes -->
          <div class="verification-notes mt-6">
              <h3 class="text-lg font-medium mb-2">Verification Notes</h3>
              <textarea id="verificationNotes" class="w-full p-2 mt-2 bg-darker" rows="4" 
                  placeholder="Add your verification notes here..."></textarea>
          </div>
      </div>
  `;
};

// Add helper function to view verification documents
window.viewVerificationDocument = async function (requestId, documentKey) {
  try {
    const response = await fetch(
      `/api/verification-requests/${requestId}/document/${documentKey}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Create blob from response and open in new window
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (error) {
    console.error("Error viewing document:", error);
    showToast("Failed to load document", "error");
  }
};

// Activity Management
function addActivity(activity) {
  activities.unshift(activity);
  updateActivityList();
}

function updateActivityList() {
  const list = document.getElementById("activityList");
  if (!list) return;

  if (!activities.length) {
    list.innerHTML = '<p class="text-center p-4">No recent activity</p>';
    return;
  }

  list.innerHTML = activities
    .map(
      (activity) => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-${getActivityIcon(activity.type)}"></i>
            </div>
            <div>
                <p>${getActivityDescription(activity)}</p>
                <small class="text-gray">${activity.timestamp}</small>
            </div>
        </div>
    `
    )
    .join("");
}

function getActivityIcon(type) {
  switch (type) {
    case "verify":
      return "check-circle";
    case "transfer":
      return "exchange-alt";
    default:
      return "file-alt";
  }
}

function getActivityDescription(activity) {
  switch (activity.type) {
    case "verify":
      return `Document ${activity.docId} verified with hash ${activity.hash}`;
    case "transfer":
      return `Transfer ${activity.docId} processed`;
    default:
      return `Action performed on ${activity.docId}`;
  }
}

// Initialize dashboard
async function updateDashboard() {
  await Promise.all([
    fetchMetrics(),
    showPendingList(),
    showTransferList(),
    showVerificationList(),
    updateActivityList(),
  ]);
}

// Event Listeners
window.addEventListener("load", () => {
  updateDashboard();
  setInterval(updateDashboard, 300000);
});

// Modal backdrop click handler
window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none";
    document.getElementById("modalBackdrop")?.classList.add("hidden");
  }
};

// Initial load
updateDashboard();
