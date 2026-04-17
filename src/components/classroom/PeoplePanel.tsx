/**
 * @file PeoplePanel.tsx
 * @description Sidebar panel showing all current participants in the session.
 *              Fixes the Phase 1 known issue where the Participants button was inactive.
 *              Lists the local user first, then all remote peers with their mute/cam status.
 */

import React from 'react';
import { IconButton } from '@mui/material';
import CloseIcon      from '@mui/icons-material/Close';
import MicOffIcon     from '@mui/icons-material/MicOff';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import type { IPeer, IUser } from '../../types';

interface PeoplePanelProps {
  /** Map of all connected remote peers */
  peers:     Map<string, IPeer>;
  /** The local authenticated user */
  localUser: IUser;
  /** Callback to close the panel */
  onClose:   () => void;
}

/**
 * @description Returns up to 2 uppercase initials from a display name.
 * @param name - Full display name e.g. "Kiran Rao"
 * @returns {string} Initials e.g. "KR"
 */
const getInitials = (name: string): string =>
  name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('');

/**
 * @description A single participant row showing avatar, name, and status icons.
 * @param name       - Participant display name
 * @param color      - Avatar background color
 * @param isMuted    - Whether their mic is muted
 * @param isCamOff   - Whether their camera is off
 * @param badgeLabel - Optional badge text shown next to the name (e.g. "You", "Instructor")
 */
const ParticipantRow: React.FC<{
  name:       string;
  color:      string;
  isMuted?:   boolean;
  isCamOff?:  boolean;
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
      className="flex items-center justify-center rounded-full text-white font-semibold text-sm shrink-0"
      style={{ width: 36, height: 36, background: color, fontSize: '0.8rem' }}
    >
      {getInitials(name)}
    </div>

    {/* Name + badge */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {name}
        </span>
        {badgeLabel && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--bg-elevated)',
              color:      'var(--text-muted)',
              fontSize:   '0.65rem',
            }}
          >
            {badgeLabel}
          </span>
        )}
      </div>
    </div>

    {/* Status icons */}
    <div className="flex items-center gap-1">
      {isMuted  && <MicOffIcon    sx={{ fontSize: 16, color: 'var(--danger)' }} />}
      {isCamOff && <VideocamOffIcon sx={{ fontSize: 16, color: 'var(--danger)' }} />}
    </div>
  </div>
);

/**
 * @description Sidebar panel listing all participants in the current session.
 *              Local user is pinned first. Updates live as peers join/leave.
 * @param peers     - Map of connected remote peers
 * @param localUser - The authenticated local user
 * @param onClose   - Handler to close this panel
 */
const PeoplePanel: React.FC<PeoplePanelProps> = ({ peers, localUser, onClose }) => {
  const totalCount = peers.size + 1;

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width:       320,
        background:  'var(--bg-surface)',
        borderLeft:  '1px solid var(--border)',
        overflowY:   'hidden',
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

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
        {/* Local user — always first */}
        <ParticipantRow
          name={localUser.name}
          color={localUser.avatarColor}
          badgeLabel={localUser.role === 'instructor' || localUser.role === 'admin' ? 'Instructor' : 'You'}
        />

        {/* Remote peers */}
        {[...peers.values()].map((peer) => (
          <ParticipantRow
            key={peer.socketId}
            name={peer.displayName}
            color="#6c63ff"
            isMuted={peer.isMuted}
            isCamOff={peer.isCamOff}
          />
        ))}
      </div>
    </div>
  );
};

export default PeoplePanel;
