/**
 * @file Dashboard.tsx
 * @description Role-aware dashboard home page. Shows recent sessions,
 *              quick stats, and a call-to-action card for the user's primary action.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip } from '@mui/material';
import AddIcon       from '@mui/icons-material/Add';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import api           from '../api/api';
import useAuth       from '../hooks/useAuth';
import type { ISession }  from '../types';

/**
 * @description Renders the user's home dashboard with recent sessions and
 *              stat cards. Content differs based on role (instructor/student).
 */
const Dashboard: React.FC = () => {
  const { user, logout }     = useAuth();
  const navigate             = useNavigate();
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; sessions: ISession[] }>('/sessions')
      .then((r) => setSessions(r.data.sessions.slice(0, 5)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isInstructor   = user?.role === 'instructor' || user?.role === 'admin';
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const totalSessions  = sessions.length;

  /**
   * @description Logs out and redirects to /login.
   */
  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b"
           style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
               style={{ background: 'var(--accent)', color: '#fff' }}>TE</div>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>ThirdEye</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sessions')}
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Sessions
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                 style={{ background: user?.avatarColor || 'var(--accent)', color: '#fff' }}>
              {user?.name.slice(0, 2).toUpperCase()}
            </div>
            <button onClick={handleLogout}
                    className="text-sm hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome back, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
            {user?.role} account
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Sessions', value: totalSessions },
            { label: 'Live Now',       value: activeSessions.length },
            { label: 'Role',           value: user?.role || '' },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-2xl p-5">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
              <p className="text-2xl font-bold capitalize" style={{ color: 'var(--text-primary)' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="glass rounded-2xl p-6 mb-8 flex items-center justify-between"
             style={{ border: '1px solid var(--border-accent)', background: 'var(--accent-glow)' }}>
          <div>
            <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
              {isInstructor ? 'Ready to teach?' : 'Ready to learn?'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isInstructor ? 'Create a new session and invite your students.' : 'Browse upcoming sessions and join a live class.'}
            </p>
          </div>
          <Button
            variant="contained"
            startIcon={isInstructor ? <AddIcon /> : <VideoCallIcon />}
            onClick={() => navigate('/sessions')}
            sx={{ background: 'var(--accent)', borderRadius: '10px', textTransform: 'none', fontWeight: 600,
                  whiteSpace: 'nowrap', '&:hover': { background: 'var(--accent-dark)' } }}
          >
            {isInstructor ? 'New Session' : 'Browse Sessions'}
          </Button>
        </div>

        {/* Recent sessions */}
        <div>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Sessions</h2>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No sessions yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((s) => (
                <div key={s._id}
                     className="glass rounded-xl px-4 py-3 flex items-center justify-between fade-in">
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(s.startTime).toLocaleDateString()}
                    </p>
                  </div>
                  <Chip
                    label={s.status}
                    size="small"
                    color={s.status === 'active' ? 'success' : s.status === 'scheduled' ? 'warning' : 'default'}
                    sx={{ textTransform: 'capitalize', fontSize: '0.7rem', fontWeight: 700 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
