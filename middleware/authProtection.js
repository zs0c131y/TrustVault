async function checkAuthStatus() {
  try {
    const response = await fetch("/checkAuth");
    const data = await response.json();

    if (!data.authenticated) {
      window.location.href = "/login.html";
      return false;
    }
    return true;
  } catch (error) {
    console.error("Auth check failed:", error);
    window.location.href = "/login.html";
    return false;
  }
}
