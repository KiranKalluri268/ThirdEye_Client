/**
 * @file ControlBar.tsx
 * @description Bottom control bar for the classroom. Contains icon buttons
 *              for mic, camera, screen share, chat toggle, participants toggle,
 *              and leave/end session. Instructors get an additional "End Session" button.
 */

import React from 'react';
import { Tooltip, IconButton } from '@mui/material';
import MicIcon            from '@mui/icons-material/Mic';
import MicOffIcon         from '@mui/icons-material/MicOff';
import VideocamIcon       from '@mui/icons-material/Videocam';
import VideocamOffIcon    from '@mui/icons-material/VideocamOff';
import ScreenShareIcon    from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon           from '@mui/icons-material/Chat';
import PeopleIcon         from '@mui/icons-material/People';
import CallEndIcon        from '@mui/icons-material/CallEnd';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';

interface ControlBarProps {
  isMuted:          boolean;
  isCamOff:         boolean;
  isSharingScreen:  boolean;
  isChatOpen:       boolean;
  isPeopleOpen:     boolean;
  isInstructor:     boolean;
  onToggleAudio:    () => void;
  onToggleVideo:    () => void;
  onToggleScreen:   () => void;
  onToggleChat:     () => void;
  onTogglePeople:   () => void;
  onLeave:          () => void;
  onEndSession:     () => void;
}

/** Styled icon button used for all control bar actions */
const ControlButton: React.FC<{
  tooltip: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ tooltip, onClick, active = false, danger = false, children }) => (
  <Tooltip title={tooltip} placement="top">
    <IconButton
      onClick={onClick}
      sx={{
        width:        52,
        height:       52,
        borderRadius: '50%',
        background:   danger ? 'var(--danger)' : active ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
        border:       `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color:        danger ? '#fff' : active ? 'var(--accent)' : 'var(--text-secondary)',
        transition:   'all 0.2s',
        '&:hover': {
          background: danger ? '#e05050' : 'var(--bg-tile)',
          transform:  'scale(1.08)',
        },
      }}
    >
      {children}
    </IconButton>
  </Tooltip>
);

/**
 * @description Renders the classroom control bar with all media and UI toggle buttons.
 *              Instructors see an additional "End Session" button (red).
 */
const ControlBar: React.FC<ControlBarProps> = ({
  isMuted, isCamOff, isSharingScreen,
  isChatOpen, isPeopleOpen, isInstructor,
  onToggleAudio, onToggleVideo, onToggleScreen,
  onToggleChat, onTogglePeople, onLeave, onEndSession,
}) => (
  <div
    className="flex items-center justify-center gap-3 px-6 py-3"
    style={{
      background:  'var(--bg-surface)',
      borderTop:   '1px solid var(--border)',
      flexShrink:  0,
    }}
  >
    <ControlButton tooltip={isMuted ? 'Unmute' : 'Mute'} onClick={onToggleAudio} active={isMuted}>
      {isMuted ? <MicOffIcon /> : <MicIcon />}
    </ControlButton>

    <ControlButton tooltip={isCamOff ? 'Turn on camera' : 'Turn off camera'} onClick={onToggleVideo} active={isCamOff}>
      {isCamOff ? <VideocamOffIcon /> : <VideocamIcon />}
    </ControlButton>

    <ControlButton tooltip={isSharingScreen ? 'Stop sharing' : 'Share screen'} onClick={onToggleScreen} active={isSharingScreen}>
      {isSharingScreen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
    </ControlButton>

    <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 4px' }} />

    <ControlButton tooltip="Chat" onClick={onToggleChat} active={isChatOpen}>
      <ChatIcon />
    </ControlButton>

    <ControlButton tooltip="Participants" onClick={onTogglePeople} active={isPeopleOpen}>
      <PeopleIcon />
    </ControlButton>

    <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 4px' }} />

    <ControlButton tooltip="Leave call" onClick={onLeave} danger>
      <CallEndIcon />
    </ControlButton>

    {isInstructor && (
      <ControlButton tooltip="End session for everyone" onClick={onEndSession} danger>
        <CancelPresentationIcon />
      </ControlButton>
    )}
  </div>
);

export default ControlBar;
