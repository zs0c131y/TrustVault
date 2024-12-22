export const setToken = (token) => {
  if (!token) {
    console.error("Attempted to set null/undefined token");
    return;
  }
  localStorage.setItem("token", token);
};

export const getToken = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.log("No token found in localStorage");
  }
  return token;
};

export const removeToken = () => {
  localStorage.removeItem("token");
};

const verifyToken = (req, res, next) => {
  // Get auth header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      authenticated: false,
      message: "No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({
      authenticated: false,
      message: "Invalid token",
    });
  }
};

export const isAuthenticated = () => {
  const token = getToken();
  return !!token;
};

export const getAuthHeaders = () => {
  const token = getToken();
  if (!token) {
    console.warn("Attempting to get auth headers without token");
  }
  return {
    Authorization: `Bearer ${token || ""}`,
    "Content-Type": "application/json",
  };
};

export const refreshToken = async () => {
  try {
    const currentToken = getToken();
    if (!currentToken) {
      throw new Error("No token to refresh");
    }

    const response = await fetch("/refreshToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: currentToken }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    if (data.token) {
      setToken(data.token);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Token refresh error:", error);
    removeToken();
    return false;
  }
};

export const logout = async () => {
  try {
    const token = getToken();
    if (token) {
      const response = await fetch("/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        removeToken();
        window.location.href = "/login.html";
      } else {
        throw new Error("Logout failed");
      }
    } else {
      window.location.href = "/login.html";
    }
  } catch (error) {
    console.error("Logout error:", error);
    removeToken();
    window.location.href = "/login.html";
  }
};
