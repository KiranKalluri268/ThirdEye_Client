/**
 * @file useAuth.ts
 * @description Custom hook that provides access to the AuthContext.
 *              Throws if used outside of AuthProvider.
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * @description Returns the authentication context value.
 *              Must be called inside a component wrapped by AuthProvider.
 * @returns {{ user, loading, login, register, logout }} Auth context
 * @throws {Error} If called outside AuthProvider
 */
const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default useAuth;
