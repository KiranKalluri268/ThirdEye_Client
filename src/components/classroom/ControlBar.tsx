/**
 * @file ControlBar.tsx
 * @description Bottom control bar for the classroom. Contains icon buttons
 *              for mic, camera, screen share, chat toggle, participants toggle,
 *              and leave/end session. Instructors get an additional "End Session" button.
 */

import React, { useState } from 'react';
import { Tooltip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import MicIcon            from '@mui/icons-material/Mic';
import MicOffIcon         from '@mui/icons-material/MicOff';
import MoreVertIcon       from '@mui/icons-material/MoreVert';
import VideocamIcon       from '@mui/icons-material/Videocam';
import VideocamOffIcon    from '@mui/icons-material/VideocamOff';
import ScreenShareIcon    from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon           from '@mui/icons-material/Chat';
import PeopleIcon         from '@mui/icons-material/People';
import CallEndIcon        from '@mui/icons-material/CallEnd';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';
import PanToolIcon        from '@mui/icons-material/PanTool';

interface ControlBarProps {
  isMuted:          boolean;
  isCamOff:         boolean;
  isSharingScreen:  boolean;
  isChatOpen:       boolean;
  isPeopleOpen:     boolean;
  isInstructor:     boolean;
  isHandRaised:     boolean;
  onToggleAudio:    () => void;
  onToggleVideo:    () => void;
  onToggleScreen:   () => void;
  onToggleChat:     () => void;
  onTogglePeople:   () => void;
  onToggleHandRaise:() => void;
  onLeave:          () => void;
  onEndSession:     () => void;
}

/** Styled icon button used for all control bar actions */
const ControlButton: React.FC<{
  tooltip: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ tooltip, onClick, active = false, danger = false, children }) => (
  <Tooltip title={tooltip} placement="top">
    <IconButton
      onClick={onClick}
      sx={{
        width:        40,
        height:       40,
        borderRadius: '50%',
        background:   danger ? 'var(--danger)' : active ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
        border:       `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color:        danger ? '#fff' : active ? 'var(--accent)' : 'var(--text-secondary)',
        transition:   'all 0.2s',
        margin:       '10px 4px',
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
  isChatOpen, isPeopleOpen, isInstructor, isHandRaised,
  onToggleAudio, onToggleVideo, onToggleScreen,
  onToggleChat, onTogglePeople, onToggleHandRaise, onLeave, onEndSession,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2"
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

      {/* Mobile-only: 3-Dots More Options Menu */}
      <div className="block md:hidden">
        <ControlButton tooltip="More options" onClick={handleMenuClick}>
          <MoreVertIcon />
        </ControlButton>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          PaperProps={{
            style: {
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }
          }}
        >
          <MenuItem onClick={() => { onToggleChat(); handleMenuClose(); }}>
            <ListItemIcon sx={{ color: isChatOpen ? 'var(--accent)' : 'inherit' }}>
              <ChatIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Chat</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={() => { onToggleHandRaise(); handleMenuClose(); }}>
            <ListItemIcon sx={{ color: isHandRaised ? 'var(--accent)' : 'inherit' }}>
              <PanToolIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{isHandRaised ? 'Lower hand' : 'Raise hand'}</ListItemText>
          </MenuItem>

          <MenuItem onClick={() => { onTogglePeople(); handleMenuClose(); }}>
            <ListItemIcon sx={{ color: isPeopleOpen ? 'var(--accent)' : 'inherit' }}>
              <PeopleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Participants</ListItemText>
          </MenuItem>

          {isInstructor && (
            <MenuItem onClick={() => { onEndSession(); handleMenuClose(); }} sx={{ color: 'var(--danger)' }}>
              <ListItemIcon sx={{ color: 'inherit' }}>
                <CancelPresentationIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>End class for all</ListItemText>
            </MenuItem>
          )}
        </Menu>
      </div>

      {/* Desktop-only: Expanded buttons */}
      <div className="hidden md:flex items-center">
        <ControlButton tooltip="Chat" onClick={onToggleChat} active={isChatOpen}>
          <ChatIcon />
        </ControlButton>

        <ControlButton tooltip={isHandRaised ? 'Lower hand' : 'Raise hand'} onClick={onToggleHandRaise} active={isHandRaised}>
          <PanToolIcon />
        </ControlButton>

        <ControlButton tooltip="Participants" onClick={onTogglePeople} active={isPeopleOpen}>
          <PeopleIcon />
        </ControlButton>

        {isInstructor && (
          <>
            <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 4px' }} />
            <ControlButton tooltip="End session for everyone" onClick={onEndSession} danger>
              <CancelPresentationIcon />
            </ControlButton>
          </>
        )}
      </div>

      <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 4px' }} />

      <ControlButton tooltip="Leave call" onClick={onLeave} danger>
        <CallEndIcon />
      </ControlButton>

    </div>
  );
};

export default ControlBar;
