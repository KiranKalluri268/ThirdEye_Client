/**
 * @file PeoplePanel.tsx
 * @description Sidebar panel showing all current participants in the session.
 *              For instructors, adds:
 *                - Class-wide permission toggles (allow unmute, allow camera)
 *                - Per-student mic status and mute control
 */

import React from 'react';
import { IconButton, Switch, FormControlLabel } from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import MicIcon          from '@mui/icons-material/Mic';
import MicOffIcon       from '@mui/icons-material/MicOff';
import VideocamIcon     from '@mui/icons-material/Videocam';
import VideocamOffIcon  from '@mui/icons-material/VideocamOff';
import type { IPeer, IUser } from '../../types';

interface PeoplePanelProps {
  /** Map of all connected remote peers */
  peers:                 Map<string, IPeer>;
  /** The local authenticated user */
  localUser:             IUser;
  /** Callback to close the panel */
  onClose:               () => void;

  // ── Instructor-only props ──────────────────────────────────────────────────
  isInstructor?:         boolean;
  allowUnmute?:          boolean;
  allowCamToggle?:       boolean;
  onToggleAllowUnmute?:  () => void;
  onToggleAllowCam?:     () => void;
  /** Toggle a specific peer's audio or video */
  onTogglePeerMedia?:    (socketId: string, kind: 'audio' | 'video', isCurrentlyMuted: boolean) => void;
}

/**
 * @description Returns up to 2 uppercase initials from a display name.
 */
const getInitials = (name: string): string =>
  name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('');

// ── Shared participant row (student view) ─────────────────────────────────────

const ParticipantRow: React.FC<{
  name:        string;
  color:       string;
  isMuted?:    boolean;
  isCamOff?:   boolean;
  badgeLabel?: string;
}> = ({ name, color, isMuted = false, isCamOff = false, badgeLabel }) => (
  <div
    className="flex items-center gap-3 rounded-lg"
    style={{ padding: '8px 16px', transition: 'background 0.15s' }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tile)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    {/* Avatar */}
    <div
      className="flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ width: 36, height: 36, background: color, fontSize: '0.8rem' }}
    >
      {getInitials(name)}
    </div>

    {/* Name + badge */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </span>
        {badgeLabel && (
          <span
            style={{
              background: 'var(--bg-elevated)',
              color:      'var(--text-muted)',
              fontSize:   '0.65rem',
              padding:    '1px 6px',
              borderRadius: 4,
            }}
          >
            {badgeLabel}
          </span>
        )}
      </div>
    </div>

    {/* Status icons */}
    <div className="flex items-center gap-1">
      {isMuted   && <MicOffIcon     sx={{ fontSize: 16, color: 'var(--danger)' }} />}
      {isCamOff  && <VideocamOffIcon sx={{ fontSize: 16, color: 'var(--danger)' }} />}
    </div>
  </div>
);

// ── Instructor participant row (with mic control) ──────────────────────────────

const InstructorPeerRow: React.FC<{
  peer:        IPeer;
  onToggleMic: () => void;
}> = ({ peer, onToggleMic }) => (
  <div
    className="flex items-center gap-3 rounded-lg"
    style={{ padding: '8px 16px', transition: 'background 0.15s' }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tile)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    {/* Avatar */}
    <div
      className="flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ width: 36, height: 36, background: '#6c63ff', fontSize: '0.8rem' }}
    >
      {getInitials(peer.displayName)}
    </div>

    {/* Name */}
    <div className="flex-1 min-w-0">
      <span className="text-sm font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
        {peer.displayName}
      </span>
    </div>

    {/* Status + controls */}
    <div className="flex items-center gap-1">
      {/* Camera status (display only) */}
      {peer.isCamOff
        ? <VideocamOffIcon sx={{ fontSize: 16, color: 'var(--danger)' }} />
        : <VideocamIcon    sx={{ fontSize: 16, color: 'var(--success, #2ed573)' }} />
      }

      {/* Mic toggle button */}
      <IconButton
        size="small"
        onClick={onToggleMic}
        title={peer.isMuted ? 'Unmute this student' : 'Mute this student'}
        sx={{
          color:  peer.isMuted ? 'var(--danger)' : 'var(--text-secondary)',
          '&:hover': {
            color: peer.isMuted ? 'var(--success)' : 'var(--danger)',
            background: peer.isMuted ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255,71,87,0.1)'
          },
        }}
      >
        {peer.isMuted
          ? <MicOffIcon sx={{ fontSize: 18 }} />
          : <MicIcon    sx={{ fontSize: 18 }} />
        }
      </IconButton>
    </div>
  </div>
);

// ── Main Panel ────────────────────────────────────────────────────────────────

const PeoplePanel: React.FC<PeoplePanelProps> = ({
  peers, localUser, onClose,
  isInstructor = false,
  allowUnmute = false,
  allowCamToggle = false,
  onToggleAllowUnmute,
  onToggleAllowCam,
  onTogglePeerMedia,
}) => {
  const totalCount = peers.size + 1;

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width:      320,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        overflowY:  'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          Participants ({totalCount})
        </span>
        <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-muted)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      {/* Instructor-only: Class Permission Toggles */}
      {isInstructor && (
        <div
          style={{
            padding:      '10px 16px',
            borderBottom: '1px solid var(--border)',
            background:   'var(--bg-elevated)',
          }}
        >
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Class Permissions
          </p>
          <FormControlLabel
            control={
              <Switch
                checked={allowUnmute}
                onChange={onToggleAllowUnmute}
                size="small"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--accent)' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--accent)' },
                }}
              />
            }
            label={
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Allow students to unmute
              </span>
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={allowCamToggle}
                onChange={onToggleAllowCam}
                size="small"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--accent)' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--accent)' },
                }}
              />
            }
            label={
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Allow students to stop camera
              </span>
            }
          />
        </div>
      )}

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {/* Local user — always first */}
        <ParticipantRow
          name={localUser.name}
          color={localUser.avatarColor}
          badgeLabel={isInstructor ? 'Instructor (You)' : 'You'}
        />

        {/* Remote peers */}
        {[...peers.values()].map((peer) =>
          isInstructor ? (
            <InstructorPeerRow
              key={peer.socketId}
              peer={peer}
              onToggleMic={() => onTogglePeerMedia?.(peer.socketId, 'audio', peer.isMuted)}
            />
          ) : (
            <ParticipantRow
              key={peer.socketId}
              name={peer.displayName}
              color="#6c63ff"
              isMuted={peer.isMuted}
              isCamOff={peer.isCamOff}
            />
          )
        )}
      </div>
    </div>
  );
};

export default PeoplePanel;
