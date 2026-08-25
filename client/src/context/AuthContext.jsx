import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username, password, remember) => {
    const data = await api.post("/auth/login", { username, password, remember: !!remember });
    setUser(data.user);
    return data.user;
  };

  // Devuelve { status: 'pending' } o { status: 'active', user, reactivated }
  const register = async (username, password) => {
    const data = await api.post("/auth/register", { username, password });
    if (data.user) setUser(data.user);
    return data;
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  };

  const forgotPassword = async (username) => {
    await api.post("/auth/forgot-password", { username });
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh, changePassword, forgotPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
