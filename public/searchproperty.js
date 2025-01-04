// DOM Elements
const mainSearchInput = document.querySelector(".search-input");
const filterInputs = document.querySelectorAll(".filter-input");
const areaInput = document.querySelector('.filter-input[placeholder="Area"]');
const propertyIdInput = document.querySelector(
  '.filter-input[placeholder="Property ID"]'
);
const logicOperator1 = document.getElementById("logic-operator-1");
const searchButton = document.querySelector(".search");
const backButton = document.getElementById("backButton");

// First, let's add the results containers to the page
const container = document.querySelector(".container");
const resultsContainer = document.createElement("div");
resultsContainer.id = "searchResults";
resultsContainer.className = "search-results";
container.appendChild(resultsContainer);

const propertyDetailsContainer = document.createElement("div");
propertyDetailsContainer.id = "propertyDetails";
propertyDetailsContainer.className = "property-details";
propertyDetailsContainer.style.display = "none";
container.appendChild(propertyDetailsContainer);

// Remove default link behavior from search button
if (searchButton) {
  const parentAnchor = searchButton.parentElement;
  if (parentAnchor && parentAnchor.tagName === "A") {
    parentAnchor.replaceWith(searchButton);
  }
}

// Event Listeners
if (backButton) {
  backButton.addEventListener("click", (e) => {
    e.preventDefault();
    history.back();
  });
}

if (searchButton) {
  searchButton.addEventListener("click", (e) => {
    e.preventDefault();
    handleSearch();
  });
}

// Main search function
async function handleSearch() {
  // Create an empty object for search parameters
  const searchParams = new URLSearchParams();

  // Only add non-empty values
  if (mainSearchInput?.value.trim()) {
    searchParams.append("mainSearch", mainSearchInput.value.trim());
  }

  if (areaInput?.value.trim()) {
    searchParams.append("area", areaInput.value.trim());
  }

  if (propertyIdInput?.value.trim()) {
    searchParams.append("propertyId", propertyIdInput.value.trim());
  }

  // Check if we have any search criteria
  if (searchParams.toString() === "") {
    showMessage("Please enter at least one search criterion");
    return;
  }

  showLoading();

  try {
    const response = await fetch(`/api/property/search?${searchParams}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Search failed");
    }

    const data = await response.json();

    if (data.properties && Array.isArray(data.properties)) {
      if (data.properties.length > 0) {
        const resultsHTML = data.properties
          .map(
            (property) => `
              <div class="property-card" onclick="showPropertyDetails('${
                property.pid
              }')">
                  <div class="property-info">
                      <h3>${property.property_name || "Property"}</h3>
                      <p><strong>ID:</strong> ${property.pid || "N/A"}</p>
                      <p><strong>Area:</strong> ${
                        property.land_area || "N/A"
                      }</p>
                      <p><strong>Location:</strong> ${
                        property.city || "N/A"
                      }</p>
                      <p><strong>Type:</strong> ${
                        property.type_of_property || "N/A"
                      }</p>
                  </div>
              </div>
          `
          )
          .join("");

        const searchResults = document.getElementById("searchResults");
        searchResults.innerHTML = `
            <div class="results-header">
                <h2>Search Results (${data.properties.length})</h2>
            </div>
            <div class="results-grid">
                ${resultsHTML}
            </div>
        `;
        searchResults.style.display = "block";
        document.getElementById("propertyDetails").style.display = "none";
      } else {
        showMessage("No properties found matching your criteria");
      }
    } else {
      showMessage("Invalid response from server");
    }
  } catch (error) {
    console.error("Search error:", error);
    showMessage(error.message || "An error occurred while searching");
  }
}

// Show property details
async function showPropertyDetails(pid) {
  if (!pid) {
    showMessage("Invalid property ID");
    return;
  }

  const searchResults = document.getElementById("searchResults");
  const propertyDetails = document.getElementById("propertyDetails");

  if (!searchResults || !propertyDetails) return;

  try {
    const response = await fetch(`/api/property/${encodeURIComponent(pid)}`);

    if (!response.ok) {
      throw new Error("Failed to fetch property details");
    }

    const property = await response.json();

    propertyDetails.innerHTML = `
        <div class="details-container">
            <div class="details-header">
                <button onclick="closePropertyDetails()" class="close-button">←</button>
                <h2>${property.property_name || "Property Details"}</h2>
            </div>
            <div class="details-content">
                <div class="details-section">
                    <h3>Basic Information</h3>
                    <p><strong>Property ID:</strong> ${
                      property.pid || "N/A"
                    }</p>
                    <p><strong>Type:</strong> ${
                      property.type_of_property || "N/A"
                    }</p>
                    <p><strong>Classification:</strong> ${
                      property.property_classification || "N/A"
                    }</p>
                    <p><strong>Land Area:</strong> ${
                      property.land_area || "N/A"
                    }</p>
                    <p><strong>Built Up Area:</strong> ${
                      property.built_up_area || "N/A"
                    }</p>
                </div>
                <div class="details-section">
                    <h3>Location Details</h3>
                    <p><strong>City:</strong> ${property.city || "N/A"}</p>
                    <p><strong>PIN Code:</strong> ${
                      property.pin_code || "N/A"
                    }</p>
                </div>
                <div class="details-section">
                    <h3>Property Information</h3>
                    <p><strong>Developer:</strong> ${
                      property.developer || "N/A"
                    }</p>
                    <p><strong>Project Name:</strong> ${
                      property.property_name || "N/A"
                    }</p>
                </div>
            </div>
        </div>
    `;

    searchResults.style.display = "none";
    propertyDetails.style.display = "block";
  } catch (error) {
    console.error("Error fetching property details:", error);
    showMessage("Failed to load property details");
  }
}

// Close property details
function closePropertyDetails() {
  const searchResults = document.getElementById("searchResults");
  const propertyDetails = document.getElementById("propertyDetails");

  if (!searchResults || !propertyDetails) return;

  propertyDetails.style.display = "none";
  searchResults.style.display = "block";
}

// Utility Functions
function showLoading() {
  const searchResults = document.getElementById("searchResults");
  const propertyDetails = document.getElementById("propertyDetails");

  if (!searchResults || !propertyDetails) return;

  searchResults.innerHTML =
    '<div class="loading">Searching properties...</div>';
  searchResults.style.display = "block";
  propertyDetails.style.display = "none";
}

function showMessage(message) {
  const searchResults = document.getElementById("searchResults");
  const propertyDetails = document.getElementById("propertyDetails");

  if (!searchResults || !propertyDetails) return;

  searchResults.innerHTML = `<div class="message">${message}</div>`;
  searchResults.style.display = "block";
  propertyDetails.style.display = "none";
}

// Add styles to document
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    .search-results, .property-details {
        max-width: 1200px;
        margin: 20px auto;
        padding: 0 20px;
    }

    .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
    }

    .property-card {
        background-color: #1c1c1e;
        border: 1px solid #444;
        border-radius: 10px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .property-card:hover {
        border-color: #04e7f3;
        transform: translateY(-2px);
    }

    .property-info h3 {
        margin: 0 0 15px 0;
        color: #fff;
    }

    .property-info p {
        margin: 8px 0;
        color: #fff;
    }

    .property-info strong {
        color: #888;
        margin-right: 5px;
    }

    .details-container {
        background-color: #1c1c1e;
        border: 1px solid #444;
        border-radius: 10px;
        padding: 20px;
    }

    .details-header {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
    }

    .close-button {
        background: none;
        border: none;
        color: #fff;
        font-size: 24px;
        cursor: pointer;
        padding: 5px 10px;
        margin-right: 15px;
    }

    .details-layout {
        display: grid;
        grid-template-columns: 1fr 400px;
        gap: 30px;
        align-items: start;
    }

    .details-content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
    }

    .property-image {
        position: sticky;
        top: 20px;
        height: fit-content;
    }

    .property-image img {
        width: 100%;
        height: 300px;
        object-fit: cover;
        border-radius: 10px;
        border: 1px solid #444;
    }

    @media (max-width: 1024px) {
        .details-layout {
            grid-template-columns: 1fr;
        }
        
        .property-image {
            position: relative;
            top: 0;
        }
    }

    .details-section {
        margin-bottom: 20px;
    }

    .details-section h3 {
        color: #fff;
        margin: 0 0 15px 0;
        font-size: 18px;
    }

    .loading, .message {
        text-align: center;
        padding: 40px;
        color: #888;
        font-size: 16px;
    }

    @media (max-width: 768px) {
        .results-grid {
            grid-template-columns: 1fr;
        }

        .details-content {
            grid-template-columns: 1fr;
        }
    }
`;
document.head.appendChild(styleSheet);
