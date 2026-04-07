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
import Logo    from '../components/layout/Logo';

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
    <div className="flex min-h-screen items-center justify-center px-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)' }}>
      {/* Background decoration */}
      <div className="absolute top-10 -left-10 w-96 h-96 rounded-full opacity-30 pointer-events-none"
           style={{ background: 'var(--accent)', filter: 'blur(100px)' }} />
      <div className="absolute bottom-10 right-10 w-[30rem] h-[30rem] rounded-full opacity-20 pointer-events-none"
           style={{ background: 'var(--info)', filter: 'blur(120px)' }} />

      <div className="glass w-full max-w-md rounded-2xl shadow-xl fade-in relative z-10" style={{ padding: '2.5rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
          <Logo size={30} />
        </div>

        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Create account</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Join ThirdEye to get started</p>

        {/* Role selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>I am a…</p>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <TextField label="Full name"  value={name}     onChange={(e) => setName(e.target.value)}     fullWidth sx={{ ...inputSx, mb: 2 }} />
          <TextField label="Email"      type="email"  value={email}    onChange={(e) => setEmail(e.target.value)}    fullWidth autoComplete="email" sx={{ ...inputSx, mb: 2 }} />
          <TextField label="Password"   type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth autoComplete="new-password" sx={{ ...inputSx, mb: 1 }} />

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
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
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
