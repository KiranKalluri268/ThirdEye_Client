/**
 * @file Dashboard.tsx
 * @description Role-aware dashboard home page. Shows recent sessions,
 *              quick stats, and a call-to-action card for the user's primary action.
 *              Uses AppShell (sidebar layout) and skeleton loaders.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import AddIcon       from '@mui/icons-material/Add';
import VideoCallIcon from '@mui/icons-material/VideoCall';

import api                   from '../api/api';
import useAuth               from '../hooks/useAuth';
import AppShell              from '../components/layout/AppShell';
import { SkeletonStatRow, SkeletonList } from '../components/layout/SkeletonCard';
import type { ISession }     from '../types';

/* ── Status pill helper ──────────────────────────────────────────────── */

const STATUS_COLOR: Record<string, string> = {
  active:    'active',
  scheduled: 'scheduled',
  completed: 'completed',
  expired:   'expired',
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`status-pill ${STATUS_COLOR[status] ?? 'completed'}`}>
    <span className="dot" />
    {status === 'active' ? 'Live' : status}
  </span>
);

/* ── Component ───────────────────────────────────────────────────────── */

/**
 * @description Renders the user's home dashboard with recent sessions and
 *              stat cards. Content differs based on role (instructor/student).
 */
const Dashboard: React.FC = () => {
  const { user }                = useAuth();
  const navigate                = useNavigate();
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [activePrompt, setActivePrompt] = useState<ISession | null>(null);

  useEffect(() => {
    api.get<{ success: boolean; sessions: ISession[] }>('/sessions')
      .then((r) => {
        const allSessions = r.data.sessions;
        setSessions(allSessions.slice(0, 5));
        
        // Find if there's any ongoing session the user belongs to
        const ongoing = allSessions.find((s) => {
          if (s.status !== 'active') return false;
          if (user?.role === 'instructor' || user?.role === 'admin') {
            return s.instructor?._id === user._id;
          }
          return s.enrolledStudents?.some((st) => st._id === user?._id);
        });

        if (ongoing && !sessionStorage.getItem(`dismissRejoin_${ongoing._id}`)) {
          setActivePrompt(ongoing);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleDismissPrompt = () => {
    if (activePrompt) {
      sessionStorage.setItem(`dismissRejoin_${activePrompt._id}`, 'true');
      setActivePrompt(null);
    }
  };

  const isInstructor   = user?.role === 'instructor' || user?.role === 'admin';
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const totalSessions  = sessions.length;

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 32 }} className="fade-in">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            Welcome back, {user?.name.split(' ')[0]} 👋
          </h1>
          <p style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
            {user?.role} account
          </p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div style={{ marginBottom: 32 }}>
            <SkeletonStatRow count={3} />
          </div>
        ) : (
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}
            className="fade-in"
          >
            {[
              { label: 'Total Sessions', value: totalSessions },
              { label: 'Live Now',       value: activeSessions.length },
              { label: 'Role',           value: user?.role || '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="glass card-hover"
                style={{ borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}
              >
                <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
                             textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  {label}
                </p>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, textTransform: 'capitalize',
                             color: 'var(--text-primary)', lineHeight: 1 }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div
          className="glass card-hover fade-in"
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '24px 28px',
            marginBottom: 36,
            border: '1px solid var(--border-accent)',
            background: 'rgba(37,99,235,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {isInstructor ? 'Ready to teach?' : 'Ready to learn?'}
            </h2>
            <p style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--text-secondary)' }}>
              {isInstructor
                ? 'Create a new session and invite your students.'
                : 'Browse upcoming sessions and join a live class.'}
            </p>
          </div>
          <Button
            variant="contained"
            startIcon={isInstructor ? <AddIcon /> : <VideoCallIcon />}
            onClick={() => navigate('/sessions')}
            id="dashboard-cta-btn"
            sx={{
              background: 'var(--accent)', borderRadius: '10px', fontWeight: 700,
              px: 3, whiteSpace: 'nowrap',
              '&:hover': { background: 'var(--accent-dark)' },
            }}
          >
            {isInstructor ? 'New Session' : 'Browse Sessions'}
          </Button>
        </div>

        {/* Recent sessions */}
        <div>
          <h2 style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.04em',
                        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Recent Sessions
          </h2>

          {loading ? (
            <SkeletonList count={4} height={68} />
          ) : sessions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No sessions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((s) => (
                <div
                  key={s._id}
                  className="glass card-hover fade-in"
                  onClick={s.status === 'completed' ? () => navigate(`/sessions/${s._id}/analytics`) : undefined}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: s.status === 'completed' ? 'pointer' : 'default',
                    border: s.status === 'active' ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {s.title}
                    </p>
                    <p style={{ fontSize: '0.75rem', marginTop: 2, color: 'var(--text-muted)' }}>
                      {new Date(s.startTime).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusPill status={s.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Session Rejoin Prompt */}
      <Dialog
        open={!!activePrompt}
        onClose={handleDismissPrompt}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          },
        }}
      >
        <DialogTitle sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
          Ongoing Session Detected
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            You have an ongoing session: <strong style={{ color: 'var(--text-primary)' }}>{activePrompt?.title}</strong>. 
            Would you like to rejoin the classroom now?
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleDismissPrompt} sx={{ color: 'var(--text-secondary)' }}>
            Dismiss
          </Button>
          <Button
            onClick={() => activePrompt?.roomCode && navigate(`/classroom/${activePrompt.roomCode}`)}
            variant="contained"
            startIcon={<VideoCallIcon />}
            sx={{
              background: 'var(--accent)', borderRadius: '10px', fontWeight: 700,
              '&:hover': { background: 'var(--accent-dark)' },
            }}
          >
            Join Again
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
};

export default Dashboard;
