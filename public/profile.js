// Import Firebase authentication
import { logout } from "./auth.js";
import { auth } from "../firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Animation for new activities
document.querySelectorAll(".new-activity").forEach((element) => {
  element.addEventListener("mouseover", () => {
    element.style.animation = "none";
  });
});

// Interactive buttons
document.getElementById("view-property").addEventListener("click", () => {
  window.location = "./viewdetail.html";
});

document.getElementById("view-all-activities").addEventListener("click", () => {
  window.location = "./activity.html";
});

document.getElementById("view-documents").addEventListener("click", () => {
  window.location = "./viewdoc.html";
});

// Profile picture upload handling
document
  .getElementById("upload-profile-picture")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        // Update the profile picture with the uploaded image
        document.getElementById("profile-picture").src = e.target.result;
        alert("Profile picture updated successfully!");
      };
      reader.readAsDataURL(file);
    } else {
      alert("No file selected.");
    }
  });

// Profile picture hover effects
document.querySelector(".profile-picture").addEventListener("mouseover", () => {
  document.querySelector(".profile-picture").style.opacity = "0.8";
});

document.querySelector(".profile-picture").addEventListener("mouseout", () => {
  document.querySelector(".profile-picture").style.opacity = "1";
});

// Logout functionality
document.getElementById("logout").addEventListener("click", async () => {
  try {
    // Sign out from Firebase
    await signOut(auth);

    // Use our JWT logout function
    await logout();

    // No need for redirect here as it's handled in the logout function
  } catch (error) {
    console.error("Logout error:", error);
    alert("Error during logout. Please try again.");

    // Even if there's an error, attempt to clean up
    localStorage.removeItem("token");
    window.location.href = "./Login.html";
  }
});
