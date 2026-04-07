/**
 * @file VideoTile.tsx
 * @description Renders a single participant's video tile in the classroom grid.
 *              Shows video when camera is on, or an avatar with initials when off.
 *              Displays a speaking glow border, name tag, and mute/cam status icons.
 *
 *              Phase 2 additions:
 *              - engagementLabel: optional colored badge in top-right corner
 *              - externalVideoRef: forwards the <video> element ref to useEngagement
 */

import React, { useRef, useEffect, useState } from 'react';
import MicOffIcon       from '@mui/icons-material/MicOff';
import VideocamOffIcon  from '@mui/icons-material/VideocamOff';
import PushPinIcon      from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import PanToolIcon      from '@mui/icons-material/PanTool';
import type { EngagementLabel } from '../../types';

// ── Engagement badge colours ───────────────────────────────────────────────────
const ENGAGEMENT_COLORS: Record<EngagementLabel, string> = {
  very_high: '#2ed573',
  high:      '#7bed9f',
  low:       '#ffa502',
  very_low:  '#ff4757',
};

const ENGAGEMENT_LABELS: Record<EngagementLabel, string> = {
  very_high: 'Very High',
  high:      'High',
  low:       'Low',
  very_low:  'Very Low',
};

interface VideoTileProps {
  stream:             MediaStream | null;
  displayName:        string;
  avatarColor:        string;
  isMuted:            boolean;
  isCamOff:           boolean;
  isSpeaking:         boolean;
  isLocal?:           boolean;
  /** Phase 2: engagement label for the colored badge overlay in the tile top-right */
  engagementLabel?:   EngagementLabel | null;
  externalVideoRef?:  React.RefObject<HTMLVideoElement | null>;
  isPinned?:          boolean;
  isScreen?:          boolean;
  isHandRaised?:      boolean;
  onPinToggle?:       () => void;
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
 *              When engagementLabel is provided, shows a colored badge overlay.
 * @param stream            - The participant's MediaStream (null if cam off)
 * @param displayName       - Name shown in the bottom-left label
 * @param avatarColor       - Background color for initials avatar
 * @param isMuted           - Whether the participant's mic is muted
 * @param isCamOff          - Whether the participant's camera is off
 * @param isSpeaking        - Whether the participant is currently speaking
 * @param isLocal           - True for the local user's tile (mirrors video)
 * @param engagementLabel   - Optional Phase 2 engagement level for badge display
 * @param externalVideoRef  - Optional ref forwarded to the <video> element
 */
const VideoTile: React.FC<VideoTileProps> = ({
  stream, displayName, avatarColor, isMuted, isCamOff, isSpeaking,
  isLocal = false, engagementLabel, externalVideoRef,
  isPinned = false, isScreen = false, isHandRaised = false, onPinToggle
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  /**
   * @description Attaches the MediaStream to the video element and optionally
   *              forwards the ref to externalVideoRef for MediaPipe inference.
   */
  useEffect(() => {
    if (videoRef.current && stream && !isCamOff) {
      videoRef.current.srcObject = stream;
    }
    // Forward the video element to externalVideoRef if provided (local tile only)
    if (externalVideoRef && videoRef.current && !isCamOff) {
      (externalVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current =
        videoRef.current;
    }
  }, [stream, externalVideoRef, isCamOff]);

  return (
    <div
      className="relative rounded-xl overflow-hidden flex items-center justify-center fade-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background:  'var(--bg-tile)',
        height:      '100%',
        width:       '100%',
        aspectRatio: isPinned ? 'unset' : '16 / 9',
        border:      isSpeaking ? '2px solid var(--accent)' : '2px solid var(--border)',
        boxShadow:   isSpeaking ? 'var(--shadow-glow)' : 'none',
        transition:  'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Pin Toggle Button */}
      {(isHovered || isPinned) && onPinToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 15,
            background: isPinned ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s',
          }}
        >
          {isPinned ? <PushPinIcon sx={{ fontSize: 18 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 18 }} />}
        </button>
      )}
      {/* Phase 2: Engagement badge — top-right corner */}
      {engagementLabel && (
        <div
          style={{
            position:       'absolute',
            top:            8,
            right:          8,
            zIndex:         10,
            display:        'flex',
            alignItems:     'center',
            gap:            4,
            background:     'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            borderRadius:   20,
            padding:        '3px 8px',
          }}
        >
          <span
            style={{
              width:        7,
              height:       7,
              borderRadius: '50%',
              background:   ENGAGEMENT_COLORS[engagementLabel],
              display:      'inline-block',
              flexShrink:   0,
            }}
          />
          <span
            style={{
              fontSize:   10,
              fontWeight: 600,
              color:      ENGAGEMENT_COLORS[engagementLabel],
              letterSpacing: '0.02em',
            }}
          >
            {ENGAGEMENT_LABELS[engagementLabel]}
          </span>
        </div>
      )}
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
            transform: isLocal && !isScreen ? 'scaleX(-1)' : 'none',
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
        <div className="flex gap-1" style={{ alignItems: 'center' }}>
          {isHandRaised && <PanToolIcon sx={{ fontSize: 14, color: 'var(--accent)', marginRight: '4px' }} />}
          {isMuted   && <MicOffIcon    sx={{ fontSize: 14, color: 'var(--danger)' }} />}
          {isCamOff  && <VideocamOffIcon sx={{ fontSize: 14, color: 'var(--danger)' }} />}
        </div>
      </div>
    </div>
  );
};

export default VideoTile;
