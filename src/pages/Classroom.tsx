/**
 * @file Classroom.tsx
 * @description Main classroom page — the core of Phase 1.
 *              Orchestrates: local media, WebRTC peer connections,
 *              Socket.IO signaling, video grid, chat panel, and control bar.
 *              Fetches room/session data on mount to validate access.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Snackbar, Alert } from '@mui/material';

import api              from '../api/api';
import useAuth          from '../hooks/useAuth';
import useMedia         from '../hooks/useMedia';
import useWebRTC        from '../hooks/useWebRTC';
import socket           from '../socket/socket';

import VideoGrid        from '../components/classroom/VideoGrid';
import ControlBar       from '../components/classroom/ControlBar';
import ChatPanel        from '../components/classroom/ChatPanel';
import SessionTimer     from '../components/classroom/SessionTimer';

import type { IRoom, ISession } from '../types';

/**
 * @description Fetches room + session data for the current room code.
 *              Validates that the session is active before allowing entry.
 */
const Classroom: React.FC = () => {
  const { roomCode }   = useParams<{ roomCode: string }>();
  const navigate       = useNavigate();
  const { user }       = useAuth();

  const [session,    setSession]    = useState<ISession | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [toast,      setToast]      = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });

  const {
    localStream, isMuted, isCamOff, isSharingScreen,
    startMedia, stopMedia,
    toggleAudio, toggleVideo, startScreenShare, stopScreenShare,
  } = useMedia();

  const { peers } = useWebRTC({
    roomCode:    roomCode || '',
    userId:      user?._id || '',
    displayName: user?.name || 'Anonymous',
    localStream,
  });

  /** Load room + session metadata, start local media */
  useEffect(() => {
    if (!roomCode) { navigate('/dashboard'); return; }

    const init = async () => {
      try {
        const res = await api.get<{ success: boolean; room: IRoom; session: ISession }>(
          `/rooms/${roomCode}`
        );
        if (res.data.session.status !== 'active') {
          navigate('/dashboard');
          return;
        }
        setSession(res.data.session);
        await startMedia();
      } catch {
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => { stopMedia(); };
  }, [roomCode, navigate, startMedia, stopMedia]);

  /** Listen for session-ended event from instructor */
  useEffect(() => {
    const handleSessionEnded = () => {
      showToast('Session ended by instructor');
      setTimeout(() => navigate('/dashboard'), 2000);
    };
    socket.on('session-ended', handleSessionEnded);
    return () => { socket.off('session-ended', handleSessionEnded); };
  }, [navigate]);

  /**
   * @description Shows a brief toast notification.
   * @param msg - Message to display
   */
  const showToast = (msg: string): void => setToast({ open: true, msg });

  /**
   * @description Handles instructor ending the session for all participants.
   */
  const handleEndSession = useCallback(async (): Promise<void> => {
    if (!session) return;
    try {
      await api.patch(`/sessions/${session._id}/end`);
      socket.emit('end-session', { roomCode });
      navigate('/dashboard');
    } catch {
      showToast('Failed to end session');
    }
  }, [session, roomCode, navigate]);

  /**
   * @description Handles the local user leaving the call.
   */
  const handleLeave = useCallback((): void => {
    socket.emit('leave', { roomCode });
    stopMedia();
    navigate('/dashboard');
  }, [roomCode, stopMedia, navigate]);

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  if (loading || !user || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Joining session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-2 shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          {/* ThirdEye logo mark */}
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
               style={{ background: 'var(--accent)', color: '#fff' }}>
            TE
          </div>
          <span className="font-semibold text-sm truncate max-w-xs" style={{ color: 'var(--text-primary)' }}>
            {session.title}
          </span>
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
               style={{ background: 'var(--bg-elevated)', color: 'var(--success)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Live
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SessionTimer startTime={session.startTime} />
          <div className="hidden sm:block text-xs px-2 py-0.5 rounded-md"
               style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            {peers.size + 1} participant{peers.size !== 0 ? 's' : ''}
          </div>
          <div className="text-xs px-2 py-0.5 rounded-md font-mono"
               style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            {roomCode}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 overflow-auto">
          <VideoGrid
            localStream={localStream}
            localUser={user}
            isMuted={isMuted}
            isCamOff={isCamOff}
            peers={peers}
          />
        </div>

        {/* Chat sidebar */}
        {isChatOpen && (
          <ChatPanel
            roomCode={roomCode!}
            userId={user._id}
            userName={user.name}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* Control bar */}
      <ControlBar
        isMuted={isMuted}
        isCamOff={isCamOff}
        isSharingScreen={isSharingScreen}
        isChatOpen={isChatOpen}
        isPeopleOpen={false}
        isInstructor={isInstructor}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreen={isSharingScreen ? stopScreenShare : startScreenShare}
        onToggleChat={() => setIsChatOpen((v) => !v)}
        onTogglePeople={() => {}}
        onLeave={handleLeave}
        onEndSession={handleEndSession}
      />

      {/* Toast notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ open: false, msg: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="info" sx={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Classroom;
