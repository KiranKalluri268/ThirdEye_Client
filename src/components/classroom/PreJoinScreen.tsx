/**
 * @file PreJoinScreen.tsx
 * @description Pre-join lobby shown to students before entering the classroom.
 *              Displays the camera preview, allows mic/cam toggling, and
 *              enforces defaults (camera ON, mic OFF).
 *              - Changing from defaults shows an informational toast.
 *              - The Join button is disabled until the student is on default settings.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Tooltip, IconButton, Snackbar, Alert } from '@mui/material';
import MicIcon         from '@mui/icons-material/Mic';
import MicOffIcon      from '@mui/icons-material/MicOff';
import VideocamIcon    from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import type { ISession, IUser }   from '../../types';

interface PreJoinScreenProps {
  session:           ISession;
  user:              IUser;
  localStream:       MediaStream | null;
  isMuted:           boolean;
  isCamOff:          boolean;
  onToggleAudio:     () => void;
  onToggleVideo:     () => void;
  /** Forces mic muted (used to set the default OFF state on stream start) */
  onForceMuteAudio:  () => void;
  onJoin:            () => void;
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('');

/**
 * @description Pre-join lobby for students.
 *              Camera starts ON, mic starts OFF (defaults enforced on stream mount).
 */
const PreJoinScreen: React.FC<PreJoinScreenProps> = ({
  session, user, localStream, isMuted, isCamOff,
  onToggleAudio, onToggleVideo, onForceMuteAudio, onJoin,
}) => {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const [toast, setToast]           = useState<{ msg: string; severity: 'info' | 'warning' | 'success' } | null>(null);

  // ── Attach stream to video element ──────────────────────────────────────────
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isCamOff]); // re-attach when cam toggled back on

  // ── Default: mic OFF when stream first becomes ready ────────────────────────
  useEffect(() => {
    if (localStream && !isMuted) {
      onForceMuteAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]); // only on stream mount

  // ── Derived: is the student on non-default settings? ────────────────────────
  // Default: mic OFF (isMuted = true), camera ON (isCamOff = false)
  const isNonDefault = !isMuted || isCamOff;
  const joinDisabled = !localStream || isNonDefault;

  // ── Toggle handlers with toast ───────────────────────────────────────────────
  const handleToggleMic = () => {
    onToggleAudio();
    if (isMuted) {
      // was muted → turning ON (non-default)
      setToast({ msg: '🎙️ Mic is now ON. You must mute your mic to join.', severity: 'warning' });
    } else {
      // was on → turning OFF (back to default)
      setToast({ msg: '✅ Mic muted. Ready to join!', severity: 'success' });
    }
  };

  const handleToggleCam = () => {
    onToggleVideo();
    if (!isCamOff) {
      // was on → turning OFF (non-default)
      setToast({ msg: '📷 Camera is OFF. Please enable your camera to join.', severity: 'warning' });
    } else {
      // was off → turning ON (back to default)
      setToast({ msg: '✅ Camera enabled. Ready to join!', severity: 'success' });
    }
  };

  // ── Compute join button label ────────────────────────────────────────────────
  const joinLabel = () => {
    if (!localStream)  return 'Getting camera…';
    if (!isMuted && isCamOff) return 'Mute mic & enable camera';
    if (!isMuted)      return 'Mute your mic to join';
    if (isCamOff)      return 'Enable camera to join';
    return 'Join Session';
  };

  return (
    <div
      style={{
        minHeight:       '100vh',
        background:      'var(--bg-primary)',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '24px 16px',
        fontFamily:      'inherit',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>
          ThirdEye Classroom
        </p>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          {session.title}
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Review your camera and audio before joining
        </p>
      </div>

      {/* ── Camera preview card ───────────────────────────────────────────── */}
      <div
        style={{
          width:         '100%',
          maxWidth:      720,
          aspectRatio:   '16/9',
          borderRadius:  20,
          overflow:      'hidden',
          background:    'var(--bg-elevated)',
          border:        '1px solid var(--border)',
          position:      'relative',
          marginBottom:  24,
          boxShadow:     '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        {/* Live video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            display:    isCamOff ? 'none' : 'block',
            transform:  'scaleX(-1)', // mirror effect
          }}
        />

        {/* Camera-off avatar placeholder */}
        {isCamOff && (
          <div
            style={{
              position:       'absolute',
              inset:          0,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'var(--bg-elevated)',
            }}
          >
            <div
              style={{
                width:          80,
                height:         80,
                borderRadius:   '50%',
                background:     user.avatarColor,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '2rem',
                fontWeight:     700,
                color:          '#fff',
                marginBottom:   12,
                boxShadow:      '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              {getInitials(user.name)}
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Camera is off</span>
          </div>
        )}

        {/* Status badges */}
        <div
          style={{
            position:       'absolute',
            bottom:         12,
            left:           12,
            display:        'flex',
            gap:            8,
            alignItems:     'center',
          }}
        >
          <span
            style={{
              background:     'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              padding:        '3px 12px',
              borderRadius:   20,
              fontSize:       '0.78rem',
              color:          '#fff',
              fontWeight:     500,
            }}
          >
            {user.name}
          </span>
          {isMuted && (
            <span
              style={{
                background:     'rgba(220,38,38,0.75)',
                backdropFilter: 'blur(6px)',
                padding:        '3px 10px',
                borderRadius:   20,
                fontSize:       '0.72rem',
                color:          '#fff',
                display:        'flex',
                alignItems:     'center',
                gap:            4,
              }}
            >
              <MicOffIcon sx={{ fontSize: 12 }} /> Muted
            </span>
          )}
        </div>
      </div>

      {/* ── Controls row ─────────────────────────────────────────────────── */}
      <div
        style={{
          width:          '100%',
          maxWidth:       720,
          background:     'var(--bg-surface)',
          border:         '1px solid var(--border)',
          borderRadius:   16,
          padding:        '18px 24px',
          display:        'flex',
          alignItems:     'center',
          gap:            20,
          marginBottom:   20,
        }}
      >
        {/* Camera toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <Tooltip title={isCamOff ? 'Turn on camera' : 'Turn off camera'} placement="top">
            <IconButton
              onClick={handleToggleCam}
              sx={{
                width:  48,
                height: 48,
                background: isCamOff ? 'rgba(220,38,38,0.15)' : 'var(--bg-elevated)',
                border: `1px solid ${isCamOff ? 'var(--danger)' : 'var(--border)'}`,
                color:  isCamOff ? 'var(--danger)' : 'var(--text-primary)',
                transition: 'all 0.2s',
                '&:hover': { transform: 'scale(1.08)', background: isCamOff ? 'rgba(220,38,38,0.25)' : 'var(--bg-tile)' },
              }}
            >
              {isCamOff ? <VideocamOffIcon /> : <VideocamIcon />}
            </IconButton>
          </Tooltip>
          <span style={{ fontSize: '0.7rem', color: isCamOff ? 'var(--danger)' : 'var(--success, #2ed573)' }}>
            {isCamOff ? 'Cam off' : 'Cam on'}
          </span>
        </div>

        {/* Mic toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <Tooltip title={isMuted ? 'Unmute mic' : 'Mute mic'} placement="top">
            <IconButton
              onClick={handleToggleMic}
              sx={{
                width:  48,
                height: 48,
                background: !isMuted ? 'rgba(220,38,38,0.15)' : 'var(--bg-elevated)',
                border: `1px solid ${!isMuted ? 'var(--danger)' : 'var(--border)'}`,
                color:  !isMuted ? 'var(--danger)' : 'var(--text-primary)',
                transition: 'all 0.2s',
                '&:hover': { transform: 'scale(1.08)', background: !isMuted ? 'rgba(220,38,38,0.25)' : 'var(--bg-tile)' },
              }}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </IconButton>
          </Tooltip>
          <span style={{ fontSize: '0.7rem', color: !isMuted ? 'var(--danger)' : 'var(--text-muted)' }}>
            {isMuted ? 'Mic off' : 'Mic on'}
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Join button */}
        <button
          onClick={onJoin}
          disabled={joinDisabled}
          style={{
            padding:       '12px 28px',
            borderRadius:  12,
            background:    joinDisabled ? 'var(--bg-elevated)' : 'var(--accent)',
            color:         joinDisabled ? 'var(--text-muted)' : '#fff',
            border:        joinDisabled ? '1px solid var(--border)' : 'none',
            cursor:        joinDisabled ? 'not-allowed' : 'pointer',
            fontWeight:    600,
            fontSize:      '0.92rem',
            transition:    'all 0.2s',
            whiteSpace:    'nowrap',
            boxShadow:     joinDisabled ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
          }}
        >
          {joinLabel()}
        </button>
      </div>

      {/* ── Non-default hint ─────────────────────────────────────────────── */}
      {isNonDefault && localStream && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400 }}>
          {!isMuted && '🎙️ Mute your mic'}{!isMuted && isCamOff ? ' and ' : ''}{isCamOff && '📷 enable your camera'}{' '}to enable the join button.
        </p>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.severity ?? 'info'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast?.msg}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default PreJoinScreen;
