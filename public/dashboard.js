import { auth } from "../firebase.js";
import { getToken, removeToken, getAuthHeaders } from "./auth.js";

// Define handleCardClick in the global scope
window.handleCardClick = function (service) {
  switch (service) {
    case "land-registry":
      window.location.href = "landregservice.html";
      break;
    case "document-verification":
      window.location.href = "documentverservice.html";
      break;
    default:
      console.error("Unknown service:", service);
  }
};

// Your existing functions remain the same
async function checkAuth() {
  try {
    const token = getToken();
    console.log("Checking auth with token:", !!token);

    if (!token) {
      console.log("No token found, redirecting to login");
      window.location.href = "/login.html";
      return false;
    }

    const response = await fetch("/checkAuth", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!data.authenticated) {
      console.log("Token invalid, redirecting to login");
      removeToken();
      window.location.href = "/login.html";
      return false;
    }

    return true;
  } catch (error) {
    console.error("Auth check failed:", error);
    removeToken();
    window.location.href = "/login.html";
    return false;
  }
}

async function getUserName() {
  try {
    const token = getToken();
    if (!token) {
      throw new Error("No token available");
    }

    const response = await fetch("/getUserData", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user data: ${response.status}`);
    }

    const data = await response.json();
    return data.name || "User";
  } catch (error) {
    console.error("Error fetching user data:", error);
    return "User";
  }
}

async function updateGreeting() {
  try {
    const hour = new Date().getHours();
    let timeOfDay = "Good Morning";

    if (hour >= 12 && hour < 17) {
      timeOfDay = "Good Afternoon";
    } else if (hour >= 17) {
      timeOfDay = "Good Evening";
    }

    const userName = await getUserName();
    const greetingElement = document.querySelector("h1");

    if (greetingElement) {
      greetingElement.textContent = `${timeOfDay}, ${userName}`;
    }
  } catch (error) {
    console.error("Error updating greeting:", error);
  }
}

async function initializeDashboard() {
  console.log("Initializing dashboard...");
  const isAuthenticated = await checkAuth();
  console.log("Authentication check result:", isAuthenticated);

  if (isAuthenticated) {
    await updateGreeting();
  }
}

document.addEventListener("DOMContentLoaded", initializeDashboard);
