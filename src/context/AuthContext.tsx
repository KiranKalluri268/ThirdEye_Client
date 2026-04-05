/**
 * @file AuthContext.tsx
 * @description React context that holds the authenticated user state.
 *              Provides login, logout, and register actions.
 *              On mount, calls GET /api/auth/me to restore session from cookie.
 */

import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../api/api';
import type { IUser } from '../types';

interface AuthContextValue {
  user:     IUser | null;
  loading:  boolean;
  login:    (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout:   () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * @description Wraps the app and provides authentication state + actions
 *              to all descendant components via useAuth hook.
 * @param children - React child nodes
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser]       = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * @description Fetches the current user from the server on mount.
   *              Silently fails if the cookie is missing/expired.
   */
  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; user: IUser }>('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  /**
   * @description Logs in with email and password. Sets user state on success.
   * @param email    - User email
   * @param password - User password
   * @throws {AxiosError} On invalid credentials
   */
  const login = async (email: string, password: string): Promise<void> => {
    const res = await api.post<{ success: boolean; user: IUser }>('/auth/login', { email, password });
    setUser(res.data.user);
  };

  /**
   * @description Registers a new user and sets the user state.
   * @param name     - Full name
   * @param email    - Email address
   * @param password - Password (min 6 chars recommended)
   * @param role     - 'student' | 'instructor'
   */
  const register = async (name: string, email: string, password: string, role: string): Promise<void> => {
    const res = await api.post<{ success: boolean; user: IUser }>('/auth/register', { name, email, password, role });
    setUser(res.data.user);
  };

  /**
   * @description Logs out the current user and clears persisted cookie.
   */
  const logout = async (): Promise<void> => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
