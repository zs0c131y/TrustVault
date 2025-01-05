// auth.js

// Constants
const APP_PREFIX = "trustvault";
const ENV = window.location.hostname === "localhost" ? "dev" : "prod";
const KEY_BASE = `${APP_PREFIX}_${ENV}`;

const STORAGE_KEYS = {
  TOKEN: `${KEY_BASE}_token`,
  EXPIRY: `${KEY_BASE}_expiry`,
  DEVICE: `${KEY_BASE}_device`,
};

// Generate or get device ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE);
  if (!deviceId) {
    const randomPart = Math.random().toString(36).substring(2, 15);
    deviceId = `${navigator.platform}_${Date.now()}_${randomPart}`;
    localStorage.setItem(STORAGE_KEYS.DEVICE, deviceId);
  }
  return deviceId;
};

// Store token with expiry
export const setToken = async (token) => {
  try {
    const expiryTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.EXPIRY, expiryTime.toString());

    // Sync with server
    await fetch("/api/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceInfo: getDeviceInfo(),
      }),
    });

    // Start refresh timer
    setupTokenRefresh();

    return true;
  } catch (error) {
    console.error("Error storing token:", error);
    return false;
  }
};

// Get device information
const getDeviceInfo = () => {
  return {
    deviceId: getDeviceId(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timestamp: new Date().toISOString(),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

// Get token if valid
export const getToken = () => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEYS.EXPIRY);

  if (!token || !expiry) {
    return null;
  }

  if (Date.now() > parseInt(expiry)) {
    logout();
    return null;
  }

  return token;
};

// Logout function
export const logout = async () => {
  try {
    const token = getToken();
    if (token) {
      // Notify server about logout
      try {
        await fetch("/api/auth/invalidate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceInfo: getDeviceInfo(),
          }),
        });
      } catch (error) {
        console.error("Error invalidating token on server:", error);
      }
    }

    // Clear storage
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));

    // Redirect to login
    window.location.href = "/login.html";
  } catch (error) {
    console.error("Logout error:", error);
    // Force logout even if server sync fails
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    window.location.href = "/login.html";
  }
};

// Get headers for API requests
export const getAuthHeaders = () => {
  const token = getToken();
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
    "X-Device-ID": getDeviceId(),
  };
};

// Check authentication status
export const isAuthenticated = async () => {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch("/checkAuth", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!data.authenticated) {
      await logout();
      return false;
    }

    return true;
  } catch (error) {
    console.error("Auth check failed:", error);
    return false;
  }
};

// Refresh token before expiry
const refreshToken = async () => {
  try {
    const token = getToken();
    if (!token) return;

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceInfo: getDeviceInfo(),
      }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const { token: newToken } = await response.json();
    await setToken(newToken);
  } catch (error) {
    console.error("Token refresh failed:", error);
    await logout();
  }
};

// Setup token refresh interval
const setupTokenRefresh = () => {
  // Clear any existing refresh interval
  if (window.refreshInterval) {
    clearInterval(window.refreshInterval);
  }

  // Set new refresh interval
  window.refreshInterval = setInterval(async () => {
    const expiry = localStorage.getItem(STORAGE_KEYS.EXPIRY);
    if (!expiry) return;

    const timeToExpiry = parseInt(expiry) - Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (timeToExpiry > 0 && timeToExpiry < fiveMinutes) {
      await refreshToken();
    }
  }, 60000); // Check every minute
};

// Initialize auth
export const initAuth = () => {
  setupTokenRefresh();
  return isAuthenticated();
};
