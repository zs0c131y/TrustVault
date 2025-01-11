// Environment and storage configuration
const isDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const ENV = isDev ? "dev" : "prod";

const STORAGE_KEYS = {
  TOKEN: `trustvault_${ENV}_token`,
  EXPIRY: `trustvault_${ENV}_expiry`,
  DEVICE: `trustvault_${ENV}_device`,
};

// Token storage and retrieval
export const setToken = async (token) => {
  try {
    const expiryTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.EXPIRY, expiryTime.toString());

    // Start refresh timer
    setupTokenRefresh();

    // Sync with server
    await syncTokenWithServer(token);

    return true;
  } catch (error) {
    console.error("Error storing token:", error);
    return false;
  }
};

// Get token
export const getToken = () => {
  try {
    // Try getting token for current environment first
    let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    let expiry = localStorage.getItem(STORAGE_KEYS.EXPIRY);

    // If no token in current environment, check other environment
    if (!token || !expiry) {
      const otherEnv = ENV === "dev" ? "prod" : "dev";
      token = localStorage.getItem(`trustvault_${otherEnv}_token`);
      expiry = localStorage.getItem(`trustvault_${otherEnv}_expiry`);

      // If found in other environment, migrate it
      if (token && expiry) {
        setToken(token);
        // Clean up old environment tokens
        localStorage.removeItem(`trustvault_${otherEnv}_token`);
        localStorage.removeItem(`trustvault_${otherEnv}_expiry`);
        localStorage.removeItem(`trustvault_${otherEnv}_device`);
      }
    }

    if (!token || !expiry) {
      return null;
    }

    // Check expiry
    if (Date.now() > parseInt(expiry)) {
      removeToken();
      return null;
    }

    return token;
  } catch (error) {
    console.error("Error retrieving token:", error);
    return null;
  }
};

// Device management
export const getDeviceId = () => {
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE);
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(STORAGE_KEYS.DEVICE, deviceId);
  }
  return deviceId;
};

const generateDeviceId = () => {
  return [
    navigator.platform,
    Date.now(),
    Math.random().toString(36).substring(2, 15),
  ].join("_");
};

const getDeviceInfo = () => {
  return {
    deviceId: getDeviceId(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timestamp: new Date().toISOString(),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    environment: ENV,
  };
};

// Server synchronization
const syncTokenWithServer = async (token) => {
  try {
    const response = await fetch("/api/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Device-ID": getDeviceId(),
      },
      body: JSON.stringify({
        deviceInfo: getDeviceInfo(),
      }),
    });

    if (!response.ok) {
      throw new Error("Token sync failed");
    }

    return true;
  } catch (error) {
    console.error("Token sync error:", error);
    return false;
  }
};

export async function syncDeviceSession() {
  const token = getToken();
  const deviceId = getDeviceId();

  if (!token || !deviceId) return;

  try {
    const response = await fetch("/api/auth/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Device-ID": deviceId,
        "X-Environment": "prod",
      },
      body: JSON.stringify({
        deviceInfo: {
          deviceId: deviceId,
          platform: navigator.platform || "unknown",
          userAgent: navigator.userAgent,
        },
      }),
    });

    if (!response.ok) {
      console.error("Failed to sync device session");
    }
  } catch (error) {
    console.error("Error syncing device session:", error);
  }
}

// Token refresh mechanism
const refreshToken = async () => {
  try {
    const currentToken = getToken();
    if (!currentToken) return null;

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentToken}`,
        "Content-Type": "application/json",
        "X-Device-ID": getDeviceId(),
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
    return newToken;
  } catch (error) {
    console.error("Token refresh failed:", error);
    await removeToken();
    return null;
  }
};

const setupTokenRefresh = () => {
  // Clear any existing refresh interval
  if (window.refreshInterval) {
    clearInterval(window.refreshInterval);
  }

  // Check every minute for token expiration
  window.refreshInterval = setInterval(async () => {
    const expiry = localStorage.getItem(STORAGE_KEYS.EXPIRY);
    if (!expiry) return;

    const timeToExpiry = parseInt(expiry) - Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (timeToExpiry > 0 && timeToExpiry < fiveMinutes) {
      await refreshToken();
    }
  }, 60000);
};

// Token removal and logout
export const removeToken = async () => {
  try {
    const token = getToken();
    if (token) {
      try {
        await fetch("/api/auth/invalidate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Device-ID": getDeviceId(),
          },
          body: JSON.stringify({
            deviceInfo: getDeviceInfo(),
          }),
        });
      } catch (error) {
        console.error("Error invalidating token on server:", error);
      }
    }

    // Clear all storage
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));

    // Clear refresh interval
    if (window.refreshInterval) {
      clearInterval(window.refreshInterval);
    }

    return true;
  } catch (error) {
    console.error("Error removing token:", error);
    return false;
  }
};

export const handleAuthRedirect = (currentPath) => {
  // Store the current path for post-login redirect
  sessionStorage.setItem("redirect_after_login", currentPath);
  window.location.href = "/login.html";
};

// Auth status check
export const isAuthenticated = async () => {
  try {
    const token = getToken();
    if (!token) {
      console.log("No token found during auth check");
      return false;
    }

    const response = await fetch("/checkAuth", {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Device-ID": getDeviceId(),
      },
    });

    if (!response.ok) {
      console.log("Auth check failed with status:", response.status);
      await removeToken();
      return false;
    }

    const data = await response.json();
    if (!data.authenticated) {
      console.log("Server returned not authenticated");
      await removeToken();
      return false;
    }

    return true;
  } catch (error) {
    console.error("Auth check failed:", error);
    return false;
  }
};

// Get headers for API requests
export function getAuthHeaders() {
  const token = getToken();
  const deviceId = getDeviceId();

  // Create headers object properly
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Device-ID": deviceId,
    "X-Environment": "prod",
  });

  return headers;
}

// User logout
export const logout = async () => {
  try {
    await removeToken();
    window.location.href = "/login.html";
  } catch (error) {
    console.error("Logout error:", error);
    // Force logout even if server sync fails
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    window.location.href = "/login.html";
  }
};

// Initialize auth service
export const initAuth = () => {
  console.log("Initializing auth service in environment:", ENV);
  console.log("Using storage keys:", STORAGE_KEYS);
  const token = getToken();
  console.log("Found token:", token ? "yes" : "no");
  setupTokenRefresh();
  return isAuthenticated();
};

// Debug helper (remove in production)
export const debugAuth = () => {
  return {
    environment: ENV,
    storageKeys: STORAGE_KEYS,
    currentToken: getToken(),
    deviceId: getDeviceId(),
    deviceInfo: getDeviceInfo(),
  };
};
