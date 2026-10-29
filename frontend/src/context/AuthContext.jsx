/**
 * MedLink Authentication Context
 * 
 * Manages user authentication state, JWT persistence, and role switching.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMe, setAuthToken, getStoredToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('medlink_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setTokenState] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  // Verify token on initial app load
  useEffect(() => {
    async function verifySession() {
      const existingToken = getStoredToken();
      if (!existingToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await getMe();
        if (res.success && res.user) {
          setUser(res.user);
          localStorage.setItem('medlink_user', JSON.stringify(res.user));
        }
      } catch (err) {
        console.warn('⚠️ Session verification failed:', err.message);
        // Clear invalid session
        setAuthToken(null);
        setTokenState(null);
        setUser(null);
        localStorage.removeItem('medlink_user');
      } finally {
        setLoading(false);
      }
    }

    verifySession();
  }, []);

  const login = async (email, password, portal) => {
    const res = await loginUser(email, password, portal);
    if (res.success && res.token) {
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      localStorage.setItem('medlink_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.error || 'Login failed');
  };

  const register = async (userData) => {
    const res = await registerUser(userData);
    if (res.success && res.token) {
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      localStorage.setItem('medlink_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.error || 'Registration failed');
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    localStorage.removeItem('medlink_user');
  };

  const updateUser = (updatedUserData) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedUserData };
      localStorage.setItem('medlink_user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        role: user?.role || null,
        loading,
        login,
        register,
        logout,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
