/**
 * @file ProtectedRoute.tsx
 * @description Route guard component. Redirects unauthenticated users to /login.
 *              Shows a loading spinner while the auth state is being restored.
 *              Optionally restricts access by user role.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import useAuth from '../../hooks/useAuth';
import type { RoleType } from '../../types';

interface ProtectedRouteProps {
  children:      React.ReactNode;
  /** If provided, only users with this role can access the route */
  allowedRoles?: RoleType[];
}

/**
 * @description Guards a route behind authentication (and optional role check).
 *              While loading: shows a centered spinner.
 *              Not authenticated: redirects to /login.
 *              Wrong role: redirects to /dashboard.
 * @param children     - The page component to render if authorised
 * @param allowedRoles - Optional array of permitted roles
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <CircularProgress sx={{ color: 'var(--accent)' }} />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
