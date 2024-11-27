import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';

export const AuthContext = createContext(null);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes

// Helper to get stored tokens
const getStoredTokens = () => {
  const accessToken = localStorage.getItem('token') || sessionStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
  return { accessToken, refreshToken };
};

// Helper to store tokens
const storeTokens = (accessToken, refreshToken, rememberMe = false) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('token', accessToken);
  storage.setItem('refreshToken', refreshToken);
  
  // Set axios default header
  axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
};

// Helper to clear tokens
const clearTokens = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
  delete axios.defaults.headers.common['Authorization'];
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const verifyToken = useCallback(async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data.user;
    } catch (error) {
      throw error;
    }
  }, []);

  const refreshTokens = useCallback(async (refreshToken) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, { refreshToken });
      return response.data;
    } catch (error) {
      throw error;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { accessToken, refreshToken } = getStoredTokens();
        
        if (!accessToken || !refreshToken) {
          setLoading(false);
          return;
        }

        try {
          // First try with current access token
          const userData = await verifyToken(accessToken);
          if (mounted) {
            setUser(userData);
            storeTokens(accessToken, refreshToken);
          }
        } catch (verifyError) {
          // If access token fails, try refresh token
          try {
            const { token: newAccessToken, refreshToken: newRefreshToken } = await refreshTokens(refreshToken);
            const userData = await verifyToken(newAccessToken);
            
            if (mounted) {
              setUser(userData);
              storeTokens(
                newAccessToken,
                newRefreshToken,
                localStorage.getItem('token') !== null
              );
            }
          } catch (refreshError) {
            if (mounted) {
              clearTokens();
              setUser(null);
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          clearTokens();
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [verifyToken, refreshTokens]);

  // Auto refresh token
  useEffect(() => {
    if (!user) return;

    const refreshTokenAndUpdate = async () => {
      try {
        const { refreshToken } = getStoredTokens();
        if (!refreshToken) throw new Error('No refresh token');

        const { token: newAccessToken, refreshToken: newRefreshToken } = await refreshTokens(refreshToken);
        storeTokens(
          newAccessToken,
          newRefreshToken,
          localStorage.getItem('token') !== null
        );
      } catch (err) {
        console.error('Token refresh failed:', err);
        clearTokens();
        setUser(null);
      }
    };

    const intervalId = setInterval(refreshTokenAndUpdate, TOKEN_REFRESH_INTERVAL);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshTokenAndUpdate();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshTokens]);

  const login = async (email, password, rememberMe = false) => {
    try {
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });

      const { token: accessToken, refreshToken, user: userData } = response.data;
      
      storeTokens(accessToken, refreshToken, rememberMe);
      setUser(userData);
      
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'An error occurred during login';
      setError(message);
      return { success: false, error: message };
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        const { accessToken } = getStoredTokens();
        await axios.post(
          `${API_BASE_URL}/api/auth/logout`,
          {},
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearTokens();
      setUser(null);
      setError(null);
    }
  };

  const value = {
    user,
    error,
    loading,
    isAuthenticated: !!user,
    login,
    logout: handleLogout,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
