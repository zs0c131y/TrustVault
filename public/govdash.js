// Sample Data
const documents = {
    pending: [
        { 
            id: "DOC001", 
            type: "Sale Deed", 
            status: "urgent", 
            owner: "John Doe", 
            date: "2024-12-19",
            files: ["sale_deed.pdf", "property_photos.jpg", "id_proof.pdf"],
            details: "Sale deed for Property #123, Green Avenue"
        },
        { 
            id: "DOC002", 
            type: "Property Transfer", 
            status: "pending", 
            owner: "Jane Smith", 
            date: "2024-12-18",
            files: ["transfer_deed.pdf", "tax_receipt.pdf"],
            details: "Property transfer request for Plot #456"
        }
    ],
    transfer: [
        { 
            id: "TRF001", 
            type: "Ownership Transfer", 
            status: "pending", 
            from: "Alice", 
            to: "Bob", 
            date: "2024-12-19",
            files: ["ownership_papers.pdf", "consent_letter.pdf"],
            details: "Complete ownership transfer of residential property"
        },
        { 
            id: "TRF002", 
            type: "Lease Transfer", 
            status: "urgent", 
            from: "Charlie", 
            to: "Dave", 
            date: "2024-12-18",
            files: ["lease_agreement.pdf", "tenant_verification.pdf"],
            details: "Lease transfer for commercial property"
        }
    ],
    completed: [
        { 
            id: "DOC003", 
            type: "Sale Deed", 
            status: "completed", 
            owner: "Eve", 
            date: "2024-12-19",
            hash: "0x7d8f...2c1a",
            files: ["verified_deed.pdf"],
            details: "Completed sale deed verification"
        }
    ]
};

let activities = [];
let currentTab = 'details';

// UI Functions
function showModal(modalId) {
    document.getElementById('modalBackdrop')?.classList.remove('hidden');
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        if (modalId === 'pendingModal') showPendingList();
        if (modalId === 'transferModal') showTransferList();
        if (modalId === 'completedModal') showCompletedList();
    }
}

function closeModal(modalId) {
    document.getElementById('modalBackdrop')?.classList.add('hidden');
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.background = type === 'success' ? 'var(--green)' : 'var(--red)';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Document Management Functions
function showDocument(docId) {
    const doc = findDocument(docId);
    if (!doc) return;

    const content = document.getElementById('documentContent');
    updateDocumentContent(doc);
    showModal('documentModal');
}

function findDocument(docId) {
    return [...documents.pending, ...documents.transfer, ...documents.completed]
        .find(d => d.id === docId);
}

function updateDocumentContent(doc) {
    const content = document.getElementById('documentContent');
    
    switch(currentTab) {
        case 'details':
            content.innerHTML = generateDetailsHTML(doc);
            break;
        case 'files':
            content.innerHTML = generateFilesHTML(doc);
            break;
        case 'history':
            content.innerHTML = generateHistoryHTML(doc);
            break;
    }
}

function generateDetailsHTML(doc) {
    return `
        <div class="document-preview">
            <div class="document-meta">
                <div>
                    <h4>Document ID</h4>
                    <p>${doc.id}</p>
                </div>
                <div>
                    <h4>Type</h4>
                    <p>${doc.type}</p>
                </div>
                <div>
                    <h4>Status</h4>
                    <p><span class="status status-${doc.status}">${doc.status.toUpperCase()}</span></p>
                </div>
                <div>
                    <h4>Date</h4>
                    <p>${doc.date}</p>
                </div>
            </div>
            <div class="document-details">
                <h4>Details</h4>
                <p>${doc.details}</p>
            </div>
        </div>
    `;
}

function generateFilesHTML(doc) {
    return `
        <div class="file-list">
            ${doc.files.map(file => `
                <div class="file-item">
                    <div class="file-icon">
                        <i class="fas fa-file-${getFileIcon(file)}"></i>
                    </div>
                    <p>${file}</p>
                    <button class="btn-secondary" onclick="viewFile('${file}')">View</button>
                </div>
            `).join('')}
        </div>
    `;
}

function generateHistoryHTML(doc) {
    const docActivities = activities.filter(a => a.docId === doc.id);
    return `
        <div class="activity-list">
            ${docActivities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-${getActivityIcon(activity.type)}"></i>
                    </div>
                    <div>
                        <p>${getActivityDescription(activity)}</p>
                        <small class="text-gray">${activity.timestamp}</small>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch(ext) {
        case 'pdf': return 'pdf';
        case 'jpg':
        case 'jpeg':
        case 'png': return 'image';
        default: return 'document';
    }
}

function viewFile(filename) {
    showToast(`Opening ${filename}...`);
    // Implement actual file viewing logic here
}

// Document Lists
function showPendingList() {
    const list = document.getElementById('pendingList');
    list.innerHTML = generateDocumentTable(documents.pending);
}

function showTransferList() {
    const list = document.getElementById('transferList');
    list.innerHTML = generateDocumentTable(documents.transfer);
}

function showCompletedList() {
    const list = document.getElementById('completedList');
    list.innerHTML = generateDocumentTable(documents.completed);
}

function generateDocumentTable(docs) {
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
                ${docs.map(doc => `
                    <tr>
                        <td>${doc.id}</td>
                        <td>${doc.type}</td>
                        <td>${doc.date}</td>
                        <td><span class="status status-${doc.status}">${doc.status.toUpperCase()}</span></td>
                        <td>
                            <button class="btn-primary" onclick="showDocument('${doc.id}')">View Details</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Document Actions
function verifyDocument() {
    const docId = document.querySelector('#documentContent').querySelector('p').textContent;
    const doc = findDocument(docId);
    
    // Generate blockchain hash
    const hash = generateHash();
    
    // Add to activities
    addActivity({
        type: 'verify',
        docId: docId,
        hash: hash,
        timestamp: new Date().toLocaleString()
    });

    // Move to completed
    moveToCompleted(doc, hash);
    
    showToast(`Document ${docId} verified successfully`);
    closeModal('documentModal');
    updateDashboard();
}

function generateHash() {
    return '0x' + Math.random().toString(16).slice(2, 10);
}

function moveToCompleted(doc, hash) {
    // Remove from pending or transfer
    if (doc.id.startsWith('DOC')) {
        documents.pending = documents.pending.filter(d => d.id !== doc.id);
    } else {
        documents.transfer = documents.transfer.filter(d => d.id !== doc.id);
    }
    
    // Add to completed
    documents.completed.push({
        ...doc,
        status: 'completed',
        hash: hash
    });
}

// Activity Management
function addActivity(activity) {
    activities.unshift(activity);
    updateActivityList();
}

function updateActivityList() {
    const list = document.getElementById('activityList');
    list.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-${getActivityIcon(activity.type)}"></i>
            </div>
            <div>
                <p>${getActivityDescription(activity)}</p>
                <small class="text-gray">${activity.timestamp}</small>
            </div>
        </div>
    `).join('');
}

function getActivityIcon(type) {
    switch(type) {
        case 'verify': return 'check-circle';
        case 'transfer': return 'exchange-alt';
        default: return 'file-alt';
    }
}

function getActivityDescription(activity) {
    switch(activity.type) {
        case 'verify':
            return `Document ${activity.docId} verified with hash ${activity.hash}`;
        case 'transfer':
            return `Transfer ${activity.docId} processed`;
        default:
            return `Action performed on ${activity.docId}`;
    }
}

// Tab Management
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab UI
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');
    
    // Update content
    const docId = document.querySelector('#documentContent').querySelector('p').textContent;
    const doc = findDocument(docId);
    updateDocumentContent(doc);
}

// Event Listeners
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
        document.getElementById('modalBackdrop')?.classList.add('hidden');
    }
}

// Initialize dashboard
function updateDashboard() {
    showPendingList();
    showTransferList();
    showCompletedList();
    updateActivityList();
}

// Initial load
updateDashboard();