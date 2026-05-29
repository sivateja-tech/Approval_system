import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '../api/auth.api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);  // true = still checking token

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // no token — not logged in, stop loading immediately
      setLoading(false);
      return;
    }
    // token exists — verify it and restore the user
    getCurrentUser()
      .then((res) => {
        setUser(res.data.data);
      })
      .catch(() => {
        // token is invalid or expired — clear it
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);