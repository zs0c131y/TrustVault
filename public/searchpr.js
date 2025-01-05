// searchpr.js
document.addEventListener("DOMContentLoaded", function () {
  const resultsContainer = document.querySelector(".results");
  const searchInput = document.querySelector(".search-input");
  const backButton = document.getElementById("backButton");
  const propertyDetailsOverlay = document.createElement("div");
  propertyDetailsOverlay.className = "property-details-overlay";
  document.body.appendChild(propertyDetailsOverlay);

  // Handle back button
  if (backButton) {
    backButton.addEventListener("click", (e) => {
      e.preventDefault();
      history.back();
    });
  }

  // Handle new search
  if (searchInput) {
    searchInput.addEventListener("keypress", async function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        const searchParams = new URLSearchParams();
        searchParams.append("mainSearch", searchInput.value.trim());
        await loadSearchResults(searchParams.toString());
      }
    });
  }

  async function loadSearchResults(overrideParams = null) {
    if (!resultsContainer) return;

    try {
      showLoadingState();

      const token = localStorage.getItem("trustvault_dev_token");
      if (!token) {
        window.location.href = "./login.html";
        return;
      }

      const searchParams =
        overrideParams || sessionStorage.getItem("searchParams");
      if (!searchParams) {
        showNoResults("No search criteria provided");
        return;
      }

      const response = await fetch(`/api/property/search?${searchParams}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Search failed");
      }

      const data = await response.json();

      if (!data.properties || data.properties.length === 0) {
        showNoResults("No properties found matching your criteria");
        return;
      }

      displayResults(data.properties);

      if (searchInput && searchParams) {
        const params = new URLSearchParams(searchParams);
        if (params.get("mainSearch")) {
          searchInput.value = params.get("mainSearch");
        }
      }
    } catch (error) {
      console.error("Error loading search results:", error);
      showError("Failed to load search results. Please try again.");
    }
  }

  function displayResults(properties) {
    if (!resultsContainer) return;

    const resultsHTML = properties
      .map(
        (property) => `
            <div class="card" data-pid="${property.pid}">
                <div class="card-content">
                    <img src="./assets/defaultlandimage.png" alt="${escapeHtml(
                      property.property_name || "Property"
                    )}">
                    <h3>${escapeHtml(
                      property.property_name || "Unnamed Property"
                    )}</h3>
                    <p>${escapeHtml(
                      property.type_of_property || "Property Type N/A"
                    )}<br>
                    ${escapeHtml(property.city || "Location N/A")}${
          property.pin_code ? ", " + escapeHtml(property.pin_code) : ""
        }</p>
                </div>
            </div>
        `
      )
      .join("");

    resultsContainer.innerHTML = resultsHTML;

    // Add click handlers to all cards
    document.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", async (e) => {
        e.preventDefault(); // Prevent any default link behavior
        const pid = card.dataset.pid;
        await showPropertyDetails(pid);
      });
    });
  }

  async function showPropertyDetails(pid) {
    try {
      const token = localStorage.getItem("trustvault_dev_token");
      if (!token) {
        window.location.href = "./login.html";
        return;
      }

      const response = await fetch(`/api/property/${pid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch property details");

      const property = await response.json();

      propertyDetailsOverlay.innerHTML = `
                <div class="property-details-content">
                    <div class="details-header">
                        <button class="close-details">&times;</button>
                        <h2>${escapeHtml(
                          property.property_name || "Property Details"
                        )}</h2>
                    </div>
                    <div class="details-body">
                        <div class="details-section">
                            <h3>Basic Information</h3>
                            <p><strong>Property ID:</strong> ${escapeHtml(
                              property.pid || "N/A"
                            )}</p>
                            <p><strong>Type:</strong> ${escapeHtml(
                              property.type_of_property || "N/A"
                            )}</p>
                            <p><strong>Classification:</strong> ${escapeHtml(
                              property.property_classification || "N/A"
                            )}</p>
                            <p><strong>Land Area:</strong> ${escapeHtml(
                              property.land_area || "N/A"
                            )}</p>
                            <p><strong>Built Up Area:</strong> ${escapeHtml(
                              property.built_up_area || "N/A"
                            )}</p>
                        </div>
                        <div class="details-section">
                            <h3>Location Details</h3>
                            <p><strong>City:</strong> ${escapeHtml(
                              property.city || "N/A"
                            )}</p>
                            <p><strong>PIN Code:</strong> ${escapeHtml(
                              property.pin_code || "N/A"
                            )}</p>
                        </div>
                        <div class="details-section">
                            <h3>Property Information</h3>
                            <p><strong>Developer:</strong> ${escapeHtml(
                              property.developer || "N/A"
                            )}</p>
                            <p><strong>Project Name:</strong> ${escapeHtml(
                              property.property_name || "N/A"
                            )}</p>
                        </div>
                    </div>
                </div>
            `;

      propertyDetailsOverlay.classList.add("active");

      // Add close button handler
      const closeButton =
        propertyDetailsOverlay.querySelector(".close-details");
      if (closeButton) {
        closeButton.addEventListener("click", () => {
          propertyDetailsOverlay.classList.remove("active");
        });
      }

      // Close on clicking outside the content
      propertyDetailsOverlay.addEventListener("click", (e) => {
        if (e.target === propertyDetailsOverlay) {
          propertyDetailsOverlay.classList.remove("active");
        }
      });
    } catch (error) {
      console.error("Error fetching property details:", error);
      showError("Failed to load property details");
    }
  }

  function showLoadingState() {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Searching properties...</p>
            </div>
        `;
  }

  function showNoResults(message) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = `
            <div class="no-results">
                <p>${escapeHtml(message)}</p>
            </div>
        `;
  }

  function showError(message) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = `
            <div class="error-message">
                <p>${escapeHtml(message)}</p>
            </div>
        `;
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Load results when the page loads
  loadSearchResults();
});
