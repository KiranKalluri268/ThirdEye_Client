/**
 * @file Register.tsx
 * @description Registration page. Mirrors the Login layout with an added
 *              role selector (Student / Instructor). On success, redirects
 *              to /dashboard via AuthContext.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TextField, Button, Alert, CircularProgress, ToggleButton, ToggleButtonGroup } from '@mui/material';
import SchoolIcon  from '@mui/icons-material/School';
import PersonIcon  from '@mui/icons-material/Person';
import useAuth from '../hooks/useAuth';

/**
 * @description Renders the registration form with name, email, password,
 *              and role toggle. Calls auth.register() on submit.
 */
const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<'student' | 'instructor'>('student');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  /**
   * @description Validates and submits the registration form.
   * @param e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name || !email || !password) { setError('All fields are required'); return; }
    if (password.length < 6)          { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, role);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: 'var(--bg-primary)' }}>
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 pointer-events-none"
           style={{ background: 'var(--accent)', filter: 'blur(100px)' }} />

      <div className="glass w-full max-w-md p-8 rounded-2xl fade-in relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
               style={{ background: 'var(--accent)', color: '#fff' }}>TE</div>
          <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>ThirdEye</span>
        </div>

        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Create account</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Join ThirdEye to get started</p>

        {/* Role selector */}
        <div className="mb-6">
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>I am a…</p>
          <ToggleButtonGroup
            value={role}
            exclusive
            onChange={(_, val) => val && setRole(val)}
            fullWidth
            sx={{
              gap: 1,
              '& .MuiToggleButton-root': {
                flex: 1, border: '1px solid var(--border) !important', borderRadius: '10px !important',
                color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
                textTransform: 'none', py: 1.5,
                '&.Mui-selected': { background: 'var(--accent-glow)', color: 'var(--accent)', borderColor: 'var(--accent) !important' },
              },
            }}
          >
            <ToggleButton value="student">
              <PersonIcon sx={{ mr: 1, fontSize: 18 }} /> Student
            </ToggleButton>
            <ToggleButton value="instructor">
              <SchoolIcon sx={{ mr: 1, fontSize: 18 }} /> Instructor
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {error && <Alert severity="error" sx={{ mb: 2, background: '#2d1b1b' }}>{error}</Alert>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField label="Full name"  value={name}     onChange={(e) => setName(e.target.value)}     fullWidth sx={inputSx} />
          <TextField label="Email"      type="email"  value={email}    onChange={(e) => setEmail(e.target.value)}    fullWidth autoComplete="email" sx={inputSx} />
          <TextField label="Password"   type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth autoComplete="new-password" sx={inputSx} />

          <Button
            type="submit" variant="contained" fullWidth disabled={loading}
            sx={{
              mt: 1, py: 1.5, borderRadius: '12px', textTransform: 'none',
              background: 'var(--accent)', fontWeight: 600, fontSize: '1rem',
              '&:hover': { background: 'var(--accent-dark)' },
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

const inputSx = {
  '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--accent)' },
  '& .MuiOutlinedInput-root': {
    color: 'var(--text-primary)', background: 'var(--bg-elevated)', borderRadius: '10px',
    '& fieldset': { borderColor: 'var(--border)' },
    '&:hover fieldset': { borderColor: 'var(--accent)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
  },
};

export default Register;
