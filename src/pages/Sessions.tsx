/**
 * @file Sessions.tsx
 * @description Session listing page. Shows all sessions filtered by role.
 *              Instructors can create new sessions via a modal.
 *              Students can enroll and join active sessions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import AddIcon         from '@mui/icons-material/Add';
import VideoCallIcon   from '@mui/icons-material/VideoCall';
import HowToRegIcon    from '@mui/icons-material/HowToReg';
import PlayArrowIcon   from '@mui/icons-material/PlayArrow';
import BarChartIcon    from '@mui/icons-material/BarChart';

import api      from '../api/api';
import useAuth  from '../hooks/useAuth';
import type { ISession } from '../types';

/** Maps session status to MUI Chip color */
const STATUS_CHIP: Record<string, { label: string; color: 'success' | 'warning' | 'default' | 'error' }> = {
  active:    { label: 'Live',      color: 'success' },
  scheduled: { label: 'Scheduled', color: 'warning' },
  completed: { label: 'Completed', color: 'default' },
  expired:   { label: 'Expired',   color: 'error'   },
};

/**
 * @description Formats a date string to a readable locale string.
 * @param dateStr - ISO date string
 * @returns {string} e.g. "Apr 5, 2026, 12:00 PM"
 */
const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/**
 * @description Displays all sessions with role-appropriate actions.
 *              Instructor: create + start buttons.
 *              Student: enroll + join buttons.
 */
const Sessions: React.FC = () => {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(false); // Create session modal

  const [newTitle,    setNewTitle]    = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [newDate,     setNewDate]     = useState('');
  const [newDuration, setNewDuration] = useState(60);
  const [creating,    setCreating]    = useState(false);

  /**
   * @description Fetches sessions from the server (role-filtered by backend).
   */
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; sessions: ISession[] }>('/sessions');
      setSessions(res.data.sessions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  /**
   * @description Submits the create session form.
   */
  const handleCreate = async (): Promise<void> => {
    if (!newTitle || !newDate) return;
    setCreating(true);
    try {
      await api.post('/sessions', {
        title: newTitle, description: newDesc,
        startTime: newDate, durationMinutes: newDuration,
      });
      setOpen(false);
      setNewTitle(''); setNewDesc(''); setNewDate(''); setNewDuration(60);
      fetchSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  /**
   * @description Starts a session, then navigates instructor to the classroom.
   * @param sessionId - MongoDB session ID
   */
  const handleStart = async (sessionId: string): Promise<void> => {
    try {
      const res = await api.patch<{ success: boolean; roomCode: string }>(`/sessions/${sessionId}/start`);
      navigate(`/classroom/${res.data.roomCode}`);
    } catch (err) { console.error(err); }
  };

  /**
   * @description Enrolls the student in a session and refreshes.
   * @param sessionId - MongoDB session ID
   */
  const handleEnroll = async (sessionId: string): Promise<void> => {
    try {
      await api.post(`/sessions/${sessionId}/enroll`);
      fetchSessions();
    } catch (err) { console.error(err); }
  };

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {isInstructor ? 'My Sessions' : 'Available Sessions'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isInstructor ? 'Create and manage your live classes' : 'Join a session or enroll for upcoming ones'}
            </p>
          </div>
          {isInstructor && (
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => setOpen(true)}
              sx={{ background: 'var(--accent)', borderRadius: '10px', textTransform: 'none', fontWeight: 600,
                   '&:hover': { background: 'var(--accent-dark)' } }}
            >
              New Session
            </Button>
          )}
        </div>

        {/* Session cards */}
        {loading ? (
          <div className="flex justify-center mt-20"><CircularProgress sx={{ color: 'var(--accent)' }} /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center mt-20" style={{ color: 'var(--text-muted)' }}>
            No sessions yet.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.map((session) => {
              const statusCfg = STATUS_CHIP[session.status] || STATUS_CHIP.scheduled;
              const isEnrolled = session.enrolledStudents?.some((s) =>
                typeof s === 'string' ? s === user?._id : s._id === user?._id
              );

              return (
                <div
                  key={session._id}
                  className="glass rounded-2xl p-5 flex items-center justify-between fade-in"
                  onClick={session.status === 'completed'
                    ? () => navigate(`/sessions/${session._id}/analytics`)
                    : undefined}
                  style={{
                    border:  session.status === 'active'
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    cursor:  session.status === 'completed' ? 'pointer' : 'default',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (session.status === 'completed')
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    if (session.status === 'completed')
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                  }}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Chip label={statusCfg.label} color={statusCfg.color} size="small"
                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
                      {session.status === 'active' && (
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                      )}
                    </div>
                    <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {session.title}
                    </h3>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {session.instructor?.name} · {formatDate(session.startTime)} · {session.durationMinutes} min
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Completed: analytics button */}
                    {session.status === 'completed' && (
                      <Tooltip title="View Engagement Analytics">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/sessions/${session._id}/analytics`);
                          }}
                          sx={{
                            background: 'var(--bg-elevated)',
                            color:      'var(--accent)',
                            border:     '1px solid var(--border)',
                            '&:hover':  { background: 'var(--accent-glow)' },
                          }}
                        >
                          <BarChartIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isInstructor && session.status === 'scheduled' && (
                      <Tooltip title="Start session">
                        <IconButton onClick={() => handleStart(session._id)}
                          sx={{ background: 'var(--accent)', color: '#fff', '&:hover': { background: 'var(--accent-dark)' } }}>
                          <PlayArrowIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isInstructor && session.status === 'active' && (
                      <Button size="small" startIcon={<VideoCallIcon />}
                        onClick={() => navigate(`/classroom/${session.roomCode}`)}
                        sx={{ background: 'var(--accent)', color: '#fff', borderRadius: '8px',
                              textTransform: 'none', '&:hover': { background: 'var(--accent-dark)' } }}>
                        Rejoin
                      </Button>
                    )}
                    {!isInstructor && session.status === 'scheduled' && !isEnrolled && (
                      <Button size="small" startIcon={<HowToRegIcon />}
                        onClick={() => handleEnroll(session._id)}
                        sx={{ border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '8px',
                              textTransform: 'none', '&:hover': { background: 'var(--accent-glow)' } }}>
                        Enroll
                      </Button>
                    )}
                    {!isInstructor && session.status === 'active' && isEnrolled && (
                      <Button size="small" startIcon={<VideoCallIcon />}
                        onClick={() => navigate(`/classroom/${session.roomCode}`)}
                        sx={{ background: 'var(--accent)', color: '#fff', borderRadius: '8px',
                              textTransform: 'none', '&:hover': { background: 'var(--accent-dark)' } }}>
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
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
          New Session
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title"        value={newTitle}    onChange={(e) => setNewTitle(e.target.value)}    fullWidth sx={inputSx} />
          <TextField label="Description"  value={newDesc}     onChange={(e) => setNewDesc(e.target.value)}     fullWidth multiline rows={2} sx={inputSx} />
          <TextField label="Start Time"   type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)}
            InputLabelProps={{ shrink: true }} fullWidth sx={inputSx} />
          <TextField label="Duration (minutes)" type="number" value={newDuration}
            onChange={(e) => setNewDuration(Number(e.target.value))} fullWidth sx={inputSx} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: 'var(--text-secondary)', textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={creating}
            sx={{ background: 'var(--accent)', borderRadius: '8px', textTransform: 'none',
                  '&:hover': { background: 'var(--accent-dark)' } }}>
            {creating ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
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

export default Sessions;
