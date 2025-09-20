import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch user session from the server
  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/auth/session', { withCredentials: true });
      if (response.data.loggedIn) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user session:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user on initial component mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Function to handle login
  const login = (userData) => {
    setUser(userData);
  };

  // Function to handle logout
  const logout = async () => {
    try {
      await axios.post('http://localhost:3001/api/auth/logout', {}, { withCredentials: true });
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Function to update parts of the user object dynamically
  const updateUser = useCallback((updates) => {
    setUser(currentUser => {
      if (!currentUser) return null;
      return { ...currentUser, ...updates };
    });
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ user, loading, login, logout, updateUser }), [user, loading, updateUser]);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};