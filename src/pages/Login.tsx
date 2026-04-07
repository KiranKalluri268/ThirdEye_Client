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
import Logo    from '../components/layout/Logo';

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
    <div className="flex min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)' }}>
      {/* Global Background decoration */}
      <div className="absolute top-10 -left-10 w-96 h-96 rounded-full opacity-30 pointer-events-none"
           style={{ background: 'var(--accent)', filter: 'blur(100px)' }} />
      <div className="absolute bottom-10 right-10 w-[30rem] h-[30rem] rounded-full opacity-20 pointer-events-none"
           style={{ background: 'var(--info)', filter: 'blur(120px)' }} />

      {/* Left — branding panel */}
      <div
        className="hidden lg:flex flex-col justify-center w-1/2 relative z-10"
        style={{ padding: '0 10rem' }}
      >

        <div className="relative z-10 w-full xl:w-[85%] 2xl:w-[75%] mx-auto flex flex-col justify-center h-full">
          <div className="mb-16">
            <Logo size={42} />
          </div>
          <h1 className="text-5xl xl:text-6xl font-extrabold mb-0 leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
            AI-Powered<br />
            <span style={{ color: 'var(--accent)' }}>Online Learning</span>
          </h1>
          <p className="text-xl xl:text-xl font-medium leading-relaxed mb-12 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Real-time engagement monitoring that helps instructors understand their students — invisibly.
          </p>

          {/* Feature bullets */}
          <div className="mt-8 flex flex-col gap-6">
            {['Live video classrooms with real-time feedback', 'Innocuous AI engagement detection', 'Instant post-session statistical insights'].map((f) => (
              <div key={f} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                     style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        <div
          className="glass w-full max-w-md rounded-2xl fade-in shadow-xl"
          style={{ border: '1px solid var(--border)', padding: '2.5rem' }}
        >
          <div className="flex items-center gap-2 mb-1 lg:hidden">
            <Logo size={26} />
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome back</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Sign in to your account</p>

          {error && <Alert severity="error" sx={{ mb: 2, background: '#2d1b1b' }}>{error}</Alert>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoComplete="email"
              sx={{ ...inputSx, mb: 2 }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
              sx={{ ...inputSx, mb: 1 }}
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
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
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
