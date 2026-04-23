/**
 * @file App.tsx
 * @description Root application component. Defines client-side routing with
 *              React Router v6. All protected routes are wrapped in ProtectedRoute.
 *              The MUI theme is configured here with the new Black/White/Blue tokens.
 *              The ToastProvider wraps the entire tree.
 */

import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';

import { AuthProvider }    from './context/AuthContext';
import { ToastProvider }   from './context/ToastContext';
import ProtectedRoute      from './components/layout/ProtectedRoute';

import Login            from './pages/Login';
import Register         from './pages/Register';
import Dashboard        from './pages/Dashboard';
import Sessions         from './pages/Sessions';
import Classroom        from './pages/Classroom';
import SessionAnalytics from './pages/SessionAnalytics';
import AdminDashboard   from './pages/AdminDashboard';

/* ── MUI Theme ─────────────────────────────────────────────────────────── */

/** MUI light theme tuned to ThirdEye's Light Mode design tokens */
const lightTheme = createTheme({
  palette: {
    mode:       'light',
    primary:    { main: '#2563eb', light: '#bfdbfe', dark: '#1d4ed8' },
    error:      { main: '#dc2626' },
    warning:    { main: '#ea580c' },
    success:    { main: '#16a34a' },
    info:       { main: '#0284c7' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    text:       { primary: '#0f172a', secondary: '#475569' },
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, letterSpacing: '-0.02em' },
    h3: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: '#f8fafc' } },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: '0.7rem' },
      },
    },
  },
});

/* ── Page transition wrapper ────────────────────────────────────────────── */

/**
 * @description Listens for route changes and injects the .page-enter animation
 *              class on the content wrapper so pages fade-scale in on navigation.
 */
const AnimatedRoutes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const ref      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('page-enter');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('page-enter');
  }, [location.pathname]);

  return (
    <div ref={ref} className="page-enter" style={{ flex: 1 }}>
      {children}
    </div>
  );
};

/* ── Root Component ─────────────────────────────────────────────────────── */

/**
 * @description Root component — renders ThemeProvider, ToastProvider, AuthProvider,
 *              and the full client-side route tree with animated transitions.
 */
const App: React.FC = () => (
  <ThemeProvider theme={lightTheme}>
    <CssBaseline />
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutesWrapper />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
);

import AppShell from './components/layout/AppShell';

/** Inner wrapper that needs BrowserRouter context for useLocation */
const AnimatedRoutesWrapper: React.FC = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/login"    element={<AnimatedRoutes><Login /></AnimatedRoutes>}    />
    <Route path="/register" element={<AnimatedRoutes><Register /></AnimatedRoutes>} />

    {/* Classroom is completely full-screen & standalone */}
    <Route path="/classroom/:roomCode" element={
      <AnimatedRoutes>
        <ProtectedRoute><Classroom /></ProtectedRoute>
      </AnimatedRoutes>
    } />

    {/* Persistent AppShell wrapped routes */}
    <Route element={
      <ProtectedRoute>
        <AppShell>
          <AnimatedRoutes>
            <Outlet />
          </AnimatedRoutes>
        </AppShell>
      </ProtectedRoute>
    }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:sessionId/analytics" element={<SessionAnalytics />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

    {/* Default redirect */}
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default App;
