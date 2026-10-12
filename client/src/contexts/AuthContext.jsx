import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext({ user: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (u) => {
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('userId', u.id);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
