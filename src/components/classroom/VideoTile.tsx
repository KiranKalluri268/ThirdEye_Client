/**
 * @file VideoTile.tsx
 * @description Renders a single participant's video tile in the classroom grid.
 *              Shows video when camera is on, or an avatar with initials when off.
 *              Displays a speaking glow border, name tag, and mute/cam status icons.
 */

import React, { useRef, useEffect } from 'react';
import MicOffIcon       from '@mui/icons-material/MicOff';
import VideocamOffIcon  from '@mui/icons-material/VideocamOff';

interface VideoTileProps {
  stream:      MediaStream | null;
  displayName: string;
  avatarColor: string;
  isMuted:     boolean;
  isCamOff:    boolean;
  isSpeaking:  boolean;
  isLocal?:    boolean;
}

/**
 * @description Returns up to 2 uppercase initials from a display name.
 * @param name - The full display name
 * @returns {string} e.g. "KR" for "Kiran Rao"
 */
const getInitials = (name: string): string =>
  name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('');

/**
 * @description A video tile for one participant. Attaches the MediaStream to
 *              a <video> element via ref. Mirrors local video horizontally.
 * @param stream      - The participant's MediaStream (null if cam off)
 * @param displayName - Name shown in the bottom-left label
 * @param avatarColor - Background color for initials avatar
 * @param isMuted     - Whether the participant's mic is muted
 * @param isCamOff    - Whether the participant's camera is off
 * @param isSpeaking  - Whether the participant is currently speaking (glow border)
 * @param isLocal     - True for the local user's tile (mirrors video)
 */
const VideoTile: React.FC<VideoTileProps> = ({
  stream, displayName, avatarColor, isMuted, isCamOff, isSpeaking, isLocal = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * @description Attaches or detaches the MediaStream to the video element
   *              whenever the stream prop changes.
   */
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className="relative rounded-xl overflow-hidden flex items-center justify-center fade-in"
      style={{
        background:  'var(--bg-tile)',
        aspectRatio: '16 / 9',
        border:      isSpeaking ? '2px solid var(--accent)' : '2px solid var(--border)',
        boxShadow:   isSpeaking ? 'var(--shadow-glow)' : 'none',
        transition:  'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Video element — hidden when camera is off */}
      {!isCamOff && stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width:     '100%',
            height:    '100%',
            objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1)' : 'none',
          }}
        />
      )}

      {/* Avatar shown when camera is off */}
      {(isCamOff || !stream) && (
        <div
          className="flex items-center justify-center rounded-full text-white font-semibold text-xl select-none"
          style={{
            width:      72,
            height:     72,
            background: avatarColor,
            fontSize:   '1.5rem',
          }}
        >
          {getInitials(displayName)}
        </div>
      )}

      {/* Bottom name tag */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1"
        style={{ background: 'var(--bg-overlay)' }}
      >
        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)', maxWidth: '70%' }}>
          {displayName}{isLocal ? ' (You)' : ''}
        </span>

        {/* Status icons */}
        <div className="flex gap-1">
          {isMuted   && <MicOffIcon    sx={{ fontSize: 14, color: 'var(--danger)' }} />}
          {isCamOff  && <VideocamOffIcon sx={{ fontSize: 14, color: 'var(--danger)' }} />}
        </div>
      </div>
    </div>
  );
};

export default VideoTile;
