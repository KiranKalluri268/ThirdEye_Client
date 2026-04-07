/**
 * @file App.tsx
 * @description Root application component. Defines client-side routing with
 *              React Router v6. All protected routes are wrapped in ProtectedRoute.
 *              The MUI theme is configured here with the new Black/White/Blue tokens.
 *              The ToastProvider wraps the entire tree.
 */

import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

/* ── MUI Theme ─────────────────────────────────────────────────────────── */

/** MUI dark theme tuned to ThirdEye's Black/White/Blue design tokens */
const darkTheme = createTheme({
  palette: {
    mode:       'dark',
    primary:    { main: '#2563eb', light: '#60a5fa', dark: '#1d4ed8' },
    error:      { main: '#ef4444' },
    warning:    { main: '#f97316' },
    success:    { main: '#22c55e' },
    info:       { main: '#38bdf8' },
    background: { default: '#090b12', paper: '#11141f' },
  },
  typography: {
    fontFamily: "'Tektur', system-ui, sans-serif",
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: '#090b12' } },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
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
    <div ref={ref} className="page-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
  <ThemeProvider theme={darkTheme}>
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

/** Inner wrapper that needs BrowserRouter context for useLocation */
const AnimatedRoutesWrapper: React.FC = () => (
  <AnimatedRoutes>
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={<Login />}    />
      <Route path="/register" element={<Register />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/sessions" element={
        <ProtectedRoute><Sessions /></ProtectedRoute>
      } />
      <Route path="/classroom/:roomCode" element={
        <ProtectedRoute><Classroom /></ProtectedRoute>
      } />
      <Route path="/sessions/:sessionId/analytics" element={
        <ProtectedRoute><SessionAnalytics /></ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </AnimatedRoutes>
);

export default App;
