'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player } from './types';

interface AuthContextType {
  user: Player | null;
  loading: boolean;
  viewingAsUser: boolean;
  setViewingAsUser: (v: boolean) => void;
  login: (name: string, password: string) => Promise<void>;
  register: (name: string, password: string, email?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Player>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingAsUser, setViewingAsUserState] = useState(false);

  useEffect(() => {
    setViewingAsUserState(localStorage.getItem('viewingAsUser') === '1');
  }, []);

  const setViewingAsUser = (v: boolean) => {
    setViewingAsUserState(v);
    localStorage.setItem('viewingAsUser', v ? '1' : '0');
  };

  // Mask admin powers in the UI while "view as user" is on; the real
  // is_admin flag stays in the DB so it restores instantly.
  const effectiveUser = user && viewingAsUser ? { ...user, is_admin: false } : user;

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (name: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await res.json();
    setUser(data);
  };

  const register = async (name: string, password: string, email?: string, phone?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, email, phone }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await res.json();
    setUser(data);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setViewingAsUser(false);
  };

  const updateProfile = async (data: Partial<Player>) => {
    const res = await fetch('/api/players', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Update failed');
    }

    const updated = await res.json();
    setUser(updated);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user: effectiveUser, loading, viewingAsUser, setViewingAsUser, login, register, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
