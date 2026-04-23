/**
 * @file JoinSession.tsx
 * @description Join Session page for guest users with an invite link.
 *              Route: /join/:roomCode
 *              Allows users to enter name and email to quickly join.
 *              Behind the scenes, it silently registers/logs them in.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TextField, Button, Alert, CircularProgress } from '@mui/material';
import useAuth from '../hooks/useAuth';
import Logo    from '../components/layout/Logo';

const JoinSession: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, loading: authLoading, login, register } = useAuth();
  const navigate = useNavigate();

  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect straight to the classroom
  useEffect(() => {
    if (!authLoading && user) {
      navigate(`/classroom/${roomCode}`, { replace: true });
    }
  }, [user, authLoading, navigate, roomCode]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name || !email) { setError('Please fill in all fields'); return; }
    setError('');
    setLoading(true);

    try {
      // 1. Try to register silently using the email as the password
      await register(name, email, email, 'student');
      navigate(`/classroom/${roomCode}`, { replace: true });
    } catch (err: unknown) {
      // 2. If registration failed (usually meaning the email already exists), try to log in
      try {
        await login(email, email);
        navigate(`/classroom/${roomCode}`, { replace: true });
      } catch (loginErr) {
        // If login also fails, they are a real user who set a real password.
        setError('This email is already registered with a different password. Please sign in normally first.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <CircularProgress sx={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen relative overflow-hidden items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)' }}>
      {/* Background decoration */}
      <div className="absolute top-10 -left-10 w-96 h-96 rounded-full opacity-30 pointer-events-none"
           style={{ background: 'var(--accent)', filter: 'blur(100px)' }} />
      <div className="absolute bottom-10 right-10 w-[30rem] h-[30rem] rounded-full opacity-20 pointer-events-none"
           style={{ background: 'var(--info)', filter: 'blur(120px)' }} />

      <div className="glass w-full max-w-md rounded-2xl fade-in shadow-xl relative z-10"
           style={{ border: '1px solid var(--border)', padding: '2.5rem', margin: '1rem' }}>
        
        <div className="flex flex-col items-center mb-6">
          <Logo size={40} />
          <h2 className="text-2xl font-bold mt-4 mb-1" style={{ color: 'var(--text-primary)' }}>Join Classroom</h2>
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            Enter your details to join the session
          </p>
        </div>

        {error && <Alert severity="error" sx={{ mb: 3, background: '#2d1b1b' }}>{error}</Alert>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextField
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            sx={{ ...inputSx, mb: 1 }}
          />
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            sx={{ ...inputSx, mb: 1 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{
              mt: 2, py: 1.5, borderRadius: '12px', textTransform: 'none',
              background: 'var(--accent)', fontWeight: 600, fontSize: '1rem',
              '&:hover': { background: 'var(--accent-dark)' },
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Join Session'}
          </Button>
        </form>
      </div>
    </div>
  );
};

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

export default JoinSession;
