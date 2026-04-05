/**
 * @file App.tsx
 * @description Root application component. Defines client-side routing with
 *              React Router v6. All protected routes are wrapped in ProtectedRoute.
 *              The MUI theme is configured here with dark mode defaults.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';

import { AuthProvider }   from './context/AuthContext';
import ProtectedRoute     from './components/layout/ProtectedRoute';

import Login            from './pages/Login';
import Register         from './pages/Register';
import Dashboard        from './pages/Dashboard';
import Sessions         from './pages/Sessions';
import Classroom        from './pages/Classroom';
import SessionAnalytics from './pages/SessionAnalytics';

/** MUI dark theme tuned to ThirdEye's design tokens */
const darkTheme = createTheme({
  palette: {
    mode:       'dark',
    primary:    { main: '#7c6fff' },
    background: { default: '#090b12', paper: '#11141f' },
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: '#090b12' } },
    },
  },
});

/**
 * @description Root component — renders the MUI ThemeProvider, AuthProvider,
 *              and the full client-side route tree.
 */
const App: React.FC = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
