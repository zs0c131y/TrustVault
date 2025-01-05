import { setToken, logout, getToken } from "/auth.js";
import { auth } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const token = getToken();
    if (token) {
      const response = await fetch("/checkAuth", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.authenticated) {
        console.log("User is already logged in, redirecting to dashboard.");
        window.location.replace("/dashboard.html"); // Using replace instead of href
        return; // Add return to prevent further execution
      } else {
        console.warn("Token invalid, clearing token.");
        await logout();
      }
    }
  } catch (error) {
    console.error("Auth check failed:", error);
    await logout();
  }
});

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const errorBox = document.getElementById("errorBox");

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  signupTab.classList.remove("active");
  loginForm.classList.add("active");
  signupForm.classList.remove("active");
});

signupTab.addEventListener("click", () => {
  signupTab.classList.add("active");
  loginTab.classList.remove("active");
  signupForm.classList.add("active");
  loginForm.classList.remove("active");
});

document.querySelector(".loginform").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    if (!user.emailVerified) {
      showError("Please verify your email before logging in");
      return;
    }

    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        name: user.displayName,
        firebaseUID: user.uid,
      }),
    });

    const data = await response.json();
    console.log("Login response:", data);

    if (data.token) {
      await setToken(data.token);
      console.log("Token stored:", data.token);
      window.location.href = "./dashboard.html";
    } else {
      throw new Error("No token received from server");
    }
  } catch (error) {
    console.error("Login error:", error);
    showError(getErrorMessage(error.code || error.message));
  }
});

document.querySelector(".signupform").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;

  if (!validatePassword(password)) {
    showError(
      "Password must be at least 8 characters long, contain at least one uppercase letter, one number, and one special character."
    );
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    await updateProfile(user, {
      displayName: name,
    });

    await sendEmailVerification(user);

    // Save user to MongoDB after successful signup
    await saveUserToMongoDB(email, name);

    showError(
      "Please check your email to verify your account before logging in."
    );
    loginTab.click();
  } catch (error) {
    console.error("Signup error:", error);
    showError(getErrorMessage(error.code));
  }
});

async function saveUserToMongoDB(email, name) {
  try {
    const response = await fetch("/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, name }),
    });

    if (!response.ok) {
      throw new Error("Failed to save user data");
    }
  } catch (error) {
    console.error("Error saving user to MongoDB:", error);
    throw error;
  }
}

function validatePassword(password) {
  const passwordRegex =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
  setTimeout(() => {
    errorBox.style.display = "none";
  }, 5000);
}

function getErrorMessage(errorCode) {
  switch (errorCode) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please login instead.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/operation-not-allowed":
      return "Email/password accounts are not enabled. Please contact support.";
    case "auth/weak-password":
      return "Password is too weak. Please choose a stronger password.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/invalid-credential":
      return "Invalid Email or Password, please try again.";
    case "No token received from server":
      return "Authentication failed. Please try again.";
    default:
      return "An error occurred. Please try again.";
  }
}
