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

  // Pending Verifications
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

  // Completed Today
  const completedValue = document.querySelector(".metric-value.text-green");
  if (completedValue) {
    completedValue.textContent = data?.completedCount || "0";
  }
  const completedSubtext = document.querySelector(
    ".card:nth-child(3) .metric-subtext"
  );
  if (completedSubtext) {
    const lastTime = data?.lastCompletedTime
      ? new Date(data.lastCompletedTime).toLocaleTimeString()
      : "N/A";
    completedSubtext.textContent = `Last: ${lastTime}`;
  }
}

// Global window functions
window.showModal = function (modalId) {
  document.getElementById("modalBackdrop")?.classList.remove("hidden");
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "block";
    if (modalId === "pendingModal") showPendingList();
    if (modalId === "transferModal") showTransferList();
    if (modalId === "completedModal") showCompletedList();
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
                    <th>ID</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${docs
                  .map(
                    (doc) => `
                    <tr>
                        <td>${doc?.propertyId || "N/A"}</td>
                        <td>${doc?.type || "Unknown"}</td>
                        <td>${
                          doc?.createdAt
                            ? new Date(doc.createdAt).toLocaleDateString()
                            : "N/A"
                        }</td>
                        <td>
                            <span class="status status-${
                              doc?.status || "pending"
                            }">
                                ${(doc?.status || "PENDING").toUpperCase()}
                            </span>
                        </td>
                        <td>
                            <button class="btn-primary" onclick="showVerificationDetails('${
                              doc?._id
                            }', '${doc?.type}')">
                                View & Verify
                            </button>
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
    `;
}

// Improved verification details display
// Verification details display
window.showVerificationDetails = async function (docId, type) {
  try {
    const response = await fetch(`/api/pending-requests`, {
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
    console.log("Fetched document data:", data);

    const doc = data.requests.find((req) => req._id === docId);
    if (!doc) {
      throw new Error("Document not found");
    }

    currentVerificationDoc = doc;
    console.log("Current verification doc:", currentVerificationDoc);

    showModal("propertyVerificationModal");
    window.switchVerificationTab("details");
  } catch (error) {
    console.error("Error showing verification details:", error);
    showToast("Failed to load document details", "error");
  }
};

// Tab switching
window.switchVerificationTab = function (tabName) {
  if (!currentVerificationDoc) {
    console.error("No document loaded for verification");
    return;
  }

  // Update tab styling
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.classList.remove("active");
    if (tab.getAttribute("onclick").includes(tabName)) {
      tab.classList.add("active");
    }
  });

  // Update content based on selected tab
  const content = document.getElementById("verificationContent");
  if (!content) return;

  switch (tabName) {
    case "details":
      content.innerHTML = window.generatePropertyDetails(
        currentVerificationDoc
      );
      break;
    case "owner":
      content.innerHTML = window.generateOwnerInfo(currentVerificationDoc);
      break;
    case "documents":
      content.innerHTML = window.generateDocumentsList(currentVerificationDoc);
      break;
    case "blockchain":
      content.innerHTML = window.generateBlockchainInfo(currentVerificationDoc);
      break;
  }
};

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
                  Property Name: ${doc.propertyName || "N/A"}
              </div>
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
                }', '${key}')" class="btn-secondary">
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
window.viewDocument = async function (propertyId, docKey) {
  try {
    const url = `/api/property/${propertyId}/document/${docKey}/view`;
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
    showCompletedList(),
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
