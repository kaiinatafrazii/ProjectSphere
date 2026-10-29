import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    localStorage.removeItem('projectsphere_token');
    localStorage.removeItem('projectsphere_user');

    const handleUnauthorized = () => setUser(null);
    window.addEventListener('projectsphere:unauthorized', handleUnauthorized);

    apiRequest('/auth/me')
      .then((response) => setUser(response.user))
      .catch((error) => {
        if (!error.message.includes('Authentication required') && !error.message.includes('Invalid or expired')) {
          console.error('Unable to restore authentication session:', error);
        }
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => window.removeEventListener('projectsphere:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthenticating(true);
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      setUser(response.user);
      return response;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setAuthenticating(true);
    try {
      const response = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setUser(response.user);
      return response;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, authenticating, login, register, logout, isAuthenticated: Boolean(user) }),
    [user, loading, authenticating, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
