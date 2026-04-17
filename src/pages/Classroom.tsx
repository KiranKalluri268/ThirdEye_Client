/**
 * @file Classroom.tsx
 * @description Main classroom page — orchestrates all Phase 1 and Phase 2 features.
 *
 *              Phase 1: local media, WebRTC signaling, video grid, chat panel,
 *                       participants panel, control bar, session timer.
 *
 *              Phase 2: client-side engagement inference (students only),
 *                       per-peer engagement badges (instructor view),
 *                       class aggregate dashboard with sparkline (instructor),
 *                       privacy banner toast (students, shown once per session),
 *                       screenshare track replacement fix.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Snackbar, Alert } from '@mui/material';

import api    from '../api/api';
import useAuth from '../hooks/useAuth';
import useMedia from '../hooks/useMedia';
import useWebRTC from '../hooks/useWebRTC';
import useEngagement from '../hooks/useEngagement';
import socket from '../socket/socket';

import VideoGrid           from '../components/classroom/VideoGrid';
import ControlBar          from '../components/classroom/ControlBar';
import ChatPanel           from '../components/classroom/ChatPanel';
import PeoplePanel         from '../components/classroom/PeoplePanel';
import SessionTimer        from '../components/classroom/SessionTimer';
import EngagementDashboard from '../components/classroom/EngagementDashboard';
import DebugOverlay        from '../components/classroom/DebugOverlay';
import PreJoinScreen       from '../components/classroom/PreJoinScreen';

import type { IRoom, ISession, EngagementLabel, IPeerEngagementEvent } from '../types';

/**
 * @description Main classroom page component. Validates room access on mount,
 *              then starts local media and WebRTC / engagement monitoring.
 */
const Classroom: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate      = useNavigate();
  const { user }      = useAuth();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [session,        setSession]        = useState<ISession | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [hasJoined,      setHasJoined]      = useState(false); // controls pre-join lobby
  const [isChatOpen,     setIsChatOpen]     = useState(false);
  const [isPeopleOpen,   setIsPeopleOpen]   = useState(false);
  const [isHandRaised,   setIsHandRaised]   = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'info' | 'warning' }>(
    { open: false, msg: '', severity: 'info' }
  );

  // ── Instructor media-control permissions (instructor only) ──────────────────
  const [allowUnmute,    setAllowUnmute]    = useState(false);
  const [allowCamToggle, setAllowCamToggle] = useState(false);

  // ── Phase 2: instructor engagement map ─────────────────────────────────────
  const [peerEngagementMap, setPeerEngagementMap] =
    useState<Map<string, EngagementLabel>>(new Map());

  // ── Phase 2: local video ref for MediaPipe inference ───────────────────────
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // ── Privacy banner shown once per session ──────────────────────────────────
  const privacyBannerShownRef = useRef(false);

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const {
    localStream, screenStream, isMuted, isCamOff, isSharingScreen,
    startMedia, stopMedia,
    toggleAudio, toggleVideo, forceMuteAudio, forceMuteVideo,
    forceUnmuteAudio, forceUnmuteVideo,
    startScreenShare, stopScreenShare,
  } = useMedia();

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  const { peers } = useWebRTC({
    roomCode:    roomCode || '',
    userId:      user?._id || '',
    displayName: user?.name || 'Anonymous',
    localStream,
    screenStream,
    ready:       isInstructor ? true : hasJoined, // students wait for lobby confirm
    onForceMute: (kind) => {
      if (kind === 'audio') {
        forceMuteAudio();
        socket.emit('mute', { roomCode, kind: 'audio' });
        setToast({ open: true, msg: '🔇 The instructor has muted your microphone', severity: 'info' });
      } else {
        forceMuteVideo();
        socket.emit('mute', { roomCode, kind: 'video' });
        setToast({ open: true, msg: '📷 The instructor has turned off your camera', severity: 'info' });
      }
    },
    onForceUnmute: (kind) => {
      if (kind === 'audio') {
        forceUnmuteAudio();
        socket.emit('unmute', { roomCode, kind: 'audio' });
        setToast({ open: true, msg: '🎙️ The instructor has enabled your microphone', severity: 'info' });
      } else {
        forceUnmuteVideo();
        socket.emit('unmute', { roomCode, kind: 'video' });
        setToast({ open: true, msg: '📷 The instructor has turned on your camera', severity: 'info' });
      }
    },
  });

  // Phase 2: engagement inference — students only, after lobby confirmed
  const { engagementResult, isInferring, inferenceError } = useEngagement({
    localVideoRef: localVideoRef as React.RefObject<HTMLVideoElement>,
    roomCode:  roomCode || '',
    sessionId: session?._id || '',
    enabled:   !!localStream && !isInstructor && hasJoined,
  });

  // ── Effects ─────────────────────────────────────────────────────────────────

  /** Load room + session metadata, validate access, start local media */
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
   * @description After joining the room, emit the student's initial mute state so
   *              existing peers display the correct mic/cam status icons immediately.
   */
  useEffect(() => {
    if (!hasJoined || isInstructor) return;
    const timer = setTimeout(() => {
      if (isMuted)  socket.emit('mute', { roomCode, kind: 'audio' });
      if (isCamOff) socket.emit('mute', { roomCode, kind: 'video' });
    }, 600); // slight delay to ensure the join handshake finishes first
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasJoined]); // only run once on join

  /**
   * @description Listens for instructor permission changes broadcast by the server.
   *              Updates local allowUnmute / allowCamToggle state for ALL clients
   *              (instructor receives their own emit echoed back; students receive it too).
   */
  useEffect(() => {
    const handlePermissions = ({ allowUnmute, allowCamToggle }: {
      allowUnmute: boolean; allowCamToggle: boolean;
    }) => {
      setAllowUnmute(allowUnmute);
      setAllowCamToggle(allowCamToggle);
    };
    socket.on('permissions-updated', handlePermissions);
    return () => { socket.off('permissions-updated', handlePermissions); };
  }, []);

  /**
   * @description Phase 2: instructor listens for peer-engagement events
   *              and maintains a live map of peer engagement labels.
   *              Students do not receive these events (server uses socket.to()).
   */
  useEffect(() => {
    if (!isInstructor) return;

    const handler = ({ socketId, engagementLevel }: IPeerEngagementEvent) => {
      setPeerEngagementMap((prev) =>
        new Map(prev).set(socketId, engagementLevel)
      );
    };

    /**
     * @description When a peer leaves, remove them from the engagement map.
     *              Without this, the dashboard shows stale counts for departed peers.
     */
    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      setPeerEngagementMap((prev) => {
        const updated = new Map(prev);
        updated.delete(socketId);
        return updated;
      });
    };

    socket.on('peer-engagement', handler);
    socket.on('peer-left',       handlePeerLeft);
    return () => {
      socket.off('peer-engagement', handler);
      socket.off('peer-left',       handlePeerLeft);
    };
  }, [isInstructor]);

  /**
   * @description Phase 2: show the privacy banner once when MediaPipe
   *              successfully starts inferring. Students only.
   */
  useEffect(() => {
    if (isInferring && !isInstructor && !privacyBannerShownRef.current) {
      privacyBannerShownRef.current = true;
      showToast('🔍 Engagement monitoring is active. Your video never leaves your device.');
    }
  }, [isInferring, isInstructor]);

  /**
   * @description Phase 2: surfaces inferenceError as a visible warning toast.
   *              Covers two scenarios:
   *               1. MediaPipe CDN/WASM failed to load
   *               2. save-record failed 3 consecutive times (network issue)
   *              The toast uses 'warning' severity so it is visually distinct
   *              from the 'info' privacy banner.
   */
  useEffect(() => {
    if (inferenceError) {
      console.warn('[Classroom] Engagement inference error:', inferenceError);
      setToast({ open: true, msg: `⚠️ ${inferenceError}`, severity: 'warning' });
    }
  }, [inferenceError]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /**
   * @description Shows a brief toast notification to the local user.
   * @param msg      - Message string to display
   * @param severity - 'info' (default) for normal notices, 'warning' for errors
   */
  const showToast = (msg: string, severity: 'info' | 'warning' = 'info'): void =>
    setToast({ open: true, msg, severity });

  /**
   * @description Handles instructor ending the session for all participants.
   *              PATCHes session status to completed and emits end-session event.
   * @throws Shows toast on failure
   * @returns {Promise<void>}
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
   * @description Handles the local user voluntarily leaving the call.
   *              Emits leave event and navigates back to dashboard.
   * @returns {void}
   */
  const handleLeave = useCallback((): void => {
    socket.emit('leave', { roomCode });
    stopMedia();
    navigate('/dashboard');
  }, [roomCode, stopMedia, navigate]);

  const handleToggleHandRaise = useCallback((): void => {
    setIsHandRaised((prev) => {
      const nextState = !prev;
      socket.emit(nextState ? 'hand-raised' : 'hand-lowered', { roomCode });
      return nextState;
    });
  }, [roomCode]);

  /**
   * @description Toggles the chat panel. On mobile, ensures participants panel is closed.
   */
  const handleToggleChat = useCallback(() => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next && window.innerWidth < 768) setIsPeopleOpen(false);
      return next;
    });
  }, []);

  /**
   * @description Toggles the participants panel. On mobile, ensures chat panel is closed.
   */
  const handleTogglePeople = useCallback(() => {
    setIsPeopleOpen((prev) => {
      const next = !prev;
      if (next && window.innerWidth < 768) setIsChatOpen(false);
      return next;
    });
  }, []);

  /**
   * @description Instructor: toggles the "Allow Unmute" permission.
   *              When turned OFF, force-mutes all students' microphones.
   */
  const handleToggleAllowUnmute = useCallback(() => {
    setAllowUnmute((prev) => {
      const next = !prev;
      if (!next) socket.emit('force-mute-all', { roomCode, kind: 'audio' });
      // Broadcast new permissions state to all students
      socket.emit('set-permissions', { roomCode, allowUnmute: next, allowCamToggle });
      return next;
    });
  }, [roomCode, allowCamToggle]);

  /**
   * @description Instructor: toggles the "Allow students to stop camera" permission.
   *              When OFF → students cannot turn their camera off (camera stays ON).
   *              No forced video-mute is emitted; we simply restrict the button.
   */
  const handleToggleAllowCam = useCallback(() => {
    setAllowCamToggle((prev) => {
      const next = !prev;
      // Broadcast new permissions state to all students
      socket.emit('set-permissions', { roomCode, allowUnmute, allowCamToggle: next });
      // When instructor disables stopping camera, force turn ON everyone's camera
      if (!next) socket.emit('force-unmute-all', { roomCode, kind: 'video' });
      return next;
    });
  }, [roomCode, allowUnmute]);

  /**
   * @description Instructor: toggles a specific peer's audio or video state.
   */
  const handleTogglePeerMedia = useCallback((targetSocketId: string, kind: 'audio' | 'video', isCurrentlyMuted: boolean) => {
    if (isCurrentlyMuted) {
      socket.emit('force-unmute-peer', { roomCode, targetSocketId, kind });
    } else {
      socket.emit('force-mute-peer', { roomCode, targetSocketId, kind });
    }
  }, [roomCode]);

  /**
   * @description Student: attempts to toggle audio. Shows toast if instructor has locked mute.
   */
  const handleStudentToggleAudio = useCallback(() => {
    if (!allowUnmute && isMuted) {
      setToast({ open: true, msg: '🔇 The instructor has muted all participants', severity: 'info' });
      return;
    }
    toggleAudio();
    socket.emit(isMuted ? 'unmute' : 'mute', { roomCode, kind: 'audio' });
  }, [allowUnmute, isMuted, toggleAudio, roomCode]);

  /**
   * @description Student: attempts to toggle camera.
   *              Blocked with toast only when allowCamToggle = false AND the student is
   *              trying to turn the camera OFF (i.e. it is currently ON).
   */
  const handleStudentToggleVideo = useCallback(() => {
    if (!allowCamToggle && !isCamOff) {
      setToast({ open: true, msg: '📷 The instructor has disabled camera control', severity: 'info' });
      return;
    }
    toggleVideo();
    socket.emit(isCamOff ? 'unmute' : 'mute', { roomCode, kind: 'video' });
  }, [allowCamToggle, isCamOff, toggleVideo, roomCode]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading || !user || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Joining session…</p>
        </div>
      </div>
    );
  }

  // ── Pre-join lobby (students only) ──────────────────────────────────────────
  if (!isInstructor && !hasJoined) {
    return (
      <PreJoinScreen
        session={session}
        user={user}
        localStream={localStream}
        isMuted={isMuted}
        isCamOff={isCamOff}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onForceMuteAudio={forceMuteAudio}
        onJoin={() => setHasJoined(true)}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between py-2 shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', paddingLeft: 12, paddingRight: 12 }}
      >
        <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
          <span
            className="font-semibold text-sm truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {session.title}
          </span>
          <div
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'var(--bg-elevated)', color: 'var(--success)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Live
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
          <SessionTimer startTime={session.startTime} />
          <div
            className="hidden sm:block text-xs px-2 py-0.5 rounded-md"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            {peers.size + 1} participant{peers.size !== 0 ? 's' : ''}
          </div>
          <div
            className="text-xs px-2 py-0.5 rounded-md font-mono"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {roomCode}
          </div>
        </div>
      </div>

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video grid — fills all remaining height between top bar and control bar */}
        <div className="flex-1 overflow-hidden min-h-0">
          <VideoGrid
            localStream={localStream}
            screenStream={screenStream}
            localUser={user}
            isMuted={isMuted}
            isCamOff={isCamOff}
            peers={peers}
            localEngagementLabel={!isInstructor ? (engagementResult?.label ?? null) : null}
            localHandRaised={isHandRaised}
            peerEngagementMap={isInstructor ? peerEngagementMap : new Map()}
            localVideoRef={localVideoRef as React.RefObject<HTMLVideoElement | null>}
            instructorId={session.instructor._id}
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

        {/* Participants sidebar */}
        {isPeopleOpen && (
          <PeoplePanel
            peers={peers}
            localUser={user}
            onClose={() => setIsPeopleOpen(false)}
            isInstructor={isInstructor}
            allowUnmute={allowUnmute}
            allowCamToggle={allowCamToggle}
            onToggleAllowUnmute={handleToggleAllowUnmute}
            onToggleAllowCam={handleToggleAllowCam}
            onTogglePeerMedia={handleTogglePeerMedia}
          />
        )}
      </div>

      {/* ── Phase 2: Instructor engagement dashboard strip ───────────────────── */}
      {isInstructor && (
        <EngagementDashboard
          peerEngagementMap={peerEngagementMap}
          totalPeers={peers.size}
        />
      )}

      {/* ── Control bar ──────────────────────────────────────────────────────── */}
      <ControlBar
        isMuted={isMuted}
        isCamOff={isCamOff}
        isSharingScreen={isSharingScreen}
        isChatOpen={isChatOpen}
        isPeopleOpen={isPeopleOpen}
        isHandRaised={isHandRaised}
        isInstructor={isInstructor}
        audioLocked={!isInstructor && !allowUnmute && isMuted}
        videoLocked={!isInstructor && !allowCamToggle && !isCamOff}
        onToggleAudio={isInstructor ? toggleAudio : handleStudentToggleAudio}
        onToggleVideo={isInstructor ? toggleVideo : handleStudentToggleVideo}
        onToggleScreen={isSharingScreen ? stopScreenShare : startScreenShare}
        onToggleChat={handleToggleChat}
        onTogglePeople={handleTogglePeople}
        onToggleHandRaise={handleToggleHandRaise}
        onLeave={handleLeave}
        onEndSession={handleEndSession}
      />

      {/* ── Phase 2.5: Student debug overlay (` key to toggle) ────────────── */}
      {!isInstructor && (
        <DebugOverlay
          engagementResult={engagementResult}
          isInferring={isInferring}
        />
      )}

      {/* ── Toast notification ────────────────────────────────────────────────── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={toast.severity === 'warning' ? 8000 : 5000}
        onClose={() => setToast({ open: false, msg: '', severity: 'info' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          sx={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Classroom;
