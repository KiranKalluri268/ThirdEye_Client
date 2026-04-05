/**
 * @file Login.tsx
 * @description Login page with split-screen glassmorphism design.
 *              Submits credentials to POST /api/auth/login via AuthContext.
 *              Redirects to /dashboard on success.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TextField, Button, Alert, CircularProgress } from '@mui/material';
import useAuth from '../hooks/useAuth';

/**
 * @description Renders the login form. On submit, calls auth.login() and
 *              redirects to the dashboard. Shows inline error on failure.
 */
const Login: React.FC = () => {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  /**
   * @description Handles form submit — validates fields, calls login, redirects.
   * @param e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Left — branding panel */}
      <div
        className="hidden lg:flex flex-col justify-center px-16 w-1/2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #13151f 0%, #1a1d2e 100%)' }}
      >
        {/* Background decoration */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
             style={{ background: 'var(--accent)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10"
             style={{ background: 'var(--accent-light)', filter: 'blur(60px)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                 style={{ background: 'var(--accent)', color: '#fff' }}>
              TE
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>ThirdEye</span>
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight" style={{ color: 'var(--text-primary)' }}>
            AI-Powered<br />Online Learning
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            Real-time engagement monitoring that helps instructors understand their students — invisibly.
          </p>

          {/* Feature bullets */}
          <div className="mt-10 flex flex-col gap-3">
            {['Live video classrooms', 'AI engagement detection', 'Instant session insights'].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                     style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
                  ✓
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        <div
          className="glass w-full max-w-md p-8 rounded-2xl fade-in"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-1 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                 style={{ background: 'var(--accent)', color: '#fff' }}>TE</div>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>ThirdEye</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome back</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Sign in to your account</p>

          {error && <Alert severity="error" sx={{ mb: 2, background: '#2d1b1b' }}>{error}</Alert>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoComplete="email"
              sx={inputSx}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
              sx={inputSx}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 1, py: 1.5, borderRadius: '12px', textTransform: 'none',
                background: 'var(--accent)', fontWeight: 600, fontSize: '1rem',
                '&:hover': { background: 'var(--accent-dark)' },
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

/** Shared MUI TextField dark theme styles */
const inputSx = {
  '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--accent)' },
  '& .MuiOutlinedInput-root': {
    color: 'var(--text-primary)',
    background: 'var(--bg-elevated)',
    borderRadius: '10px',
    '& fieldset': { borderColor: 'var(--border)' },
    '&:hover fieldset': { borderColor: 'var(--accent)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
  },
};

export default Login;
