/**
 * @file Sessions.tsx
 * @description Session listing page. Shows all sessions filtered by role.
 *              Instructors can create new sessions via a modal.
 *              Students can enroll and join active sessions.
 *              Uses AppShell, skeleton loaders, status pills, and toast notifications.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import AddIcon         from '@mui/icons-material/Add';
import VideoCallIcon   from '@mui/icons-material/VideoCall';
import HowToRegIcon    from '@mui/icons-material/HowToReg';
import PlayArrowIcon   from '@mui/icons-material/PlayArrow';
import BarChartIcon    from '@mui/icons-material/BarChart';

import api           from '../api/api';
import useAuth       from '../hooks/useAuth';
import { useToast }  from '../context/ToastContext';
import AppShell      from '../components/layout/AppShell';
import { SkeletonList } from '../components/layout/SkeletonCard';
import type { ISession } from '../types';

/* ── Status pill ──────────────────────────────────────────────────────── */

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const label = status === 'active' ? 'Live' : status;
  return (
    <span className={`status-pill ${status}`}>
      <span className="dot" />
      {label}
    </span>
  );
};

/* ── Helpers ──────────────────────────────────────────────────────────── */

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/* ── Component ────────────────────────────────────────────────────────── */

/**
 * @description Displays all sessions with role-appropriate actions.
 *              Instructor: create + start buttons.
 *              Student: enroll + join buttons.
 */
const Sessions: React.FC = () => {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { push }   = useToast();

  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(false);

  const [newTitle,    setNewTitle]    = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [newDate,     setNewDate]     = useState('');
  const [newDuration, setNewDuration] = useState(60);
  const [creating,    setCreating]    = useState(false);

  /** Fetches sessions from the server (role-filtered by backend). */
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; sessions: ISession[] }>('/sessions');
      setSessions(res.data.sessions);
    } catch {
      push('Failed to load sessions.', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  /** Submits the create session form. */
  const handleCreate = async (): Promise<void> => {
    if (!newTitle || !newDate) {
      push('Please fill in title and start time.', 'warning');
      return;
    }
    setCreating(true);
    try {
      await api.post('/sessions', {
        title: newTitle, description: newDesc,
        startTime: newDate, durationMinutes: newDuration,
      });
      setOpen(false);
      setNewTitle(''); setNewDesc(''); setNewDate(''); setNewDuration(60);
      push('Session created successfully!', 'success');
      fetchSessions();
    } catch {
      push('Failed to create session.', 'error');
    } finally {
      setCreating(false);
    }
  };

  /** Starts a session then navigates instructor to the classroom. */
  const handleStart = async (sessionId: string): Promise<void> => {
    try {
      const res = await api.patch<{ success: boolean; roomCode: string }>(`/sessions/${sessionId}/start`);
      navigate(`/classroom/${res.data.roomCode}`);
    } catch {
      push('Could not start session.', 'error');
    }
  };

  /** Enrolls the student in a session and refreshes. */
  const handleEnroll = async (sessionId: string): Promise<void> => {
    try {
      await api.post(`/sessions/${sessionId}/enroll`);
      push('Enrolled successfully!', 'success');
      fetchSessions();
    } catch {
      push('Enrollment failed.', 'error');
    }
  };

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                   marginBottom: 32, gap: 16, flexWrap: 'wrap' }}
          className="fade-in"
        >
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {isInstructor ? 'My Sessions' : 'Available Sessions'}
            </h1>
            <p style={{ fontSize: '0.875rem', marginTop: 6, color: 'var(--text-secondary)' }}>
              {isInstructor
                ? 'Create and manage your live classes'
                : 'Join a session or enroll for upcoming ones'}
            </p>
          </div>
          {isInstructor && (
            <Button
              id="new-session-btn"
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => setOpen(true)}
              sx={{
                background: 'var(--accent)', borderRadius: '10px', fontWeight: 700,
                '&:hover': { background: 'var(--accent-dark)' },
              }}
            >
              New Session
            </Button>
          )}
        </div>

        {/* Session cards or skeleton */}
        {loading ? (
          <SkeletonList count={5} height={90} />
        ) : sessions.length === 0 ? (
          <div
            className="glass"
            style={{
              borderRadius: 'var(--radius-lg)',
              padding: '48px 24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <VideoCallIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
            <p style={{ fontSize: '0.9rem' }}>No sessions yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map((session) => {
              const isEnrolled = session.enrolledStudents?.some((s) =>
                typeof s === 'string' ? s === user?._id : s._id === user?._id
              );

              return (
                <div
                  key={session._id}
                  className="glass card-hover fade-in"
                  onClick={session.status === 'completed'
                    ? () => navigate(`/sessions/${session._id}/analytics`)
                    : undefined}
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    border: session.status === 'active'
                      ? '1px solid var(--border-accent)'
                      : '1px solid var(--border)',
                    cursor: session.status === 'completed' ? 'pointer' : 'default',
                  }}
                >
                  {/* Session info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <StatusPill status={session.status} />
                      {session.status === 'active' && (
                        <span
                          style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: 'var(--success)',
                            display: 'inline-block',
                            animation: 'pulse-glow 1.5s ease-in-out infinite',
                          }}
                        />
                      )}
                    </div>
                    <h3 style={{
                      fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {session.title}
                    </h3>
                    <p style={{ fontSize: '0.78rem', marginTop: 3, color: 'var(--text-secondary)' }}>
                      {session.instructor?.name} · {formatDate(session.startTime)} · {session.durationMinutes} min
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {session.status === 'completed' && (
                      <Tooltip title="View Engagement Analytics">
                        <IconButton
                          id={`analytics-btn-${session._id}`}
                          onClick={(e) => { e.stopPropagation(); navigate(`/sessions/${session._id}/analytics`); }}
                          sx={{
                            background: 'var(--bg-elevated)', color: 'var(--accent)',
                            border: '1px solid var(--border)',
                            '&:hover': { background: 'var(--accent-glow)', borderColor: 'var(--accent)' },
                          }}
                        >
                          <BarChartIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isInstructor && session.status === 'scheduled' && (
                      <Tooltip title="Start session">
                        <IconButton
                          id={`start-btn-${session._id}`}
                          onClick={() => handleStart(session._id)}
                          sx={{ background: 'var(--accent)', color: '#fff', '&:hover': { background: 'var(--accent-dark)' } }}
                        >
                          <PlayArrowIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isInstructor && session.status === 'active' && (
                      <Button
                        size="small"
                        startIcon={<VideoCallIcon />}
                        onClick={() => navigate(`/classroom/${session.roomCode}`)}
                        sx={{
                          background: 'var(--accent)', color: '#fff', borderRadius: '8px',
                          '&:hover': { background: 'var(--accent-dark)' },
                        }}
                      >
                        Rejoin
                      </Button>
                    )}
                    {!isInstructor && session.status === 'scheduled' && !isEnrolled && (
                      <Button
                        size="small"
                        startIcon={<HowToRegIcon />}
                        onClick={() => handleEnroll(session._id)}
                        sx={{
                          border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '8px',
                          '&:hover': { background: 'var(--accent-glow)' },
                        }}
                      >
                        Enroll
                      </Button>
                    )}
                    {!isInstructor && session.status === 'active' && isEnrolled && (
                      <Button
                        size="small"
                        startIcon={<VideoCallIcon />}
                        onClick={() => navigate(`/classroom/${session.roomCode}`)}
                        sx={{
                          background: 'var(--accent)', color: '#fff', borderRadius: '8px',
                          '&:hover': { background: 'var(--accent-dark)' },
                        }}
                      >
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
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
        <DialogTitle
          sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', fontWeight: 700 }}
        >
          New Session
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title"       value={newTitle}    onChange={(e) => setNewTitle(e.target.value)}    fullWidth sx={inputSx} />
          <TextField label="Description" value={newDesc}     onChange={(e) => setNewDesc(e.target.value)}     fullWidth multiline rows={2} sx={inputSx} />
          <TextField label="Start Time"  type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)}
            InputLabelProps={{ shrink: true }} fullWidth sx={inputSx} />
          <TextField label="Duration (minutes)" type="number" value={newDuration}
            onChange={(e) => setNewDuration(Number(e.target.value))} fullWidth sx={inputSx} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setOpen(false)}
            sx={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </Button>
          <Button
            id="create-session-submit-btn"
            onClick={handleCreate}
            variant="contained"
            disabled={creating}
            sx={{
              background: 'var(--accent)', borderRadius: '10px', fontWeight: 700,
              '&:hover': { background: 'var(--accent-dark)' },
            }}
          >
            {creating ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
};

const inputSx = {
  '& .MuiInputLabel-root': { color: 'var(--text-secondary)', fontFamily: 'Tektur' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--accent)' },
  '& .MuiOutlinedInput-root': {
    color: 'var(--text-primary)', background: 'var(--bg-elevated)', borderRadius: '10px',
    '& fieldset': { borderColor: 'var(--border)' },
    '&:hover fieldset': { borderColor: 'var(--accent)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
  },
};

export default Sessions;
