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

document.querySelector(".signupform").addEventListener("submit", (e) => {
  e.preventDefault(); // Prevent form submission
  const passwordInput = signupForm.querySelector('input[type="password"]');
  const password = passwordInput.value;

  const isValidPassword = validatePassword(password);

  if (!isValidPassword) {
    showError("Password must be at least 8 characters long, contain at least one uppercase letter, one number, and one special character.");
  } else {
    // If password is valid, proceed with form submission or next steps
    alert("Signup successful!");
    signupForm.submit(); // Uncomment this if backend handling is ready
  }
});

function validatePassword(password) {
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";

  // Auto-hide the error box after 5 seconds
  setTimeout(() => {
    errorBox.style.display = "none";
  }, 5000);
}
