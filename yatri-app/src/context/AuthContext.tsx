import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../services/api';

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  preferred_language: string;
  avatar_url?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, language?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await api.getUser();
        if (saved) {
          setUser(saved);
          // Verify token is still valid
          const profile = await api.getProfile().catch(() => null);
          if (profile) setUser(profile);
          else { await api.logout(); setUser(null); }
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await api.login(email, password);
    setUser(data.user);
  };

  const signUp = async (name: string, email: string, password: string, language = 'hi') => {
    const data = await api.register(name, email, password, language);
    setUser(data.user);
  };

  const signOut = async () => {
    await api.logout();
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    const updated = await api.updateProfile(updates);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
