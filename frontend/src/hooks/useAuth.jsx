import { createContext, useContext, useState, useCallback } from 'react';
import { apiLogin, apiRegister } from '../services/api';

const AuthContext = createContext(null);

function loadUser() {
  try { return JSON.parse(localStorage.getItem('tr_user')); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const login = useCallback(async ({ email, password }) => {
    const token = await apiLogin({ email, password });
    localStorage.setItem('tr_token', token.access_token);
    const u = { id: token.user_id, role: token.role, email };
    localStorage.setItem('tr_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (fields) => {
    const u = await apiRegister(fields);
    // After registration user must log in (no token returned from register)
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tr_token');
    localStorage.removeItem('tr_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
