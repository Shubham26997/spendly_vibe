"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, getMeUser, loginUser, registerUser } from "../lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: str) => Promise<void>;
  register: (email: string, password: str, fullName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("spendly_token");
    if (savedToken) {
      setToken(savedToken);
      getMeUser()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem("spendly_token");
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: str) => {
    const data = await loginUser(email, password);
    localStorage.setItem("spendly_token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const register = async (email: string, password: str, fullName?: string) => {
    const data = await registerUser(email, password, fullName);
    localStorage.setItem("spendly_token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("spendly_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
