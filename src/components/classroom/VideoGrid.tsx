/**
 * @file VideoGrid.tsx
 * @description Responsive CSS Grid that renders VideoTile for every participant.
 *              Dynamically adjusts column count based on total participant count.
 *              Includes the local user's tile as the first entry.
 *
 *              Phase 2 additions:
 *              - localEngagementLabel: badge shown on the local (student) tile
 *              - peerEngagementMap: map of socket IDs to labels for instructor view
 *              - localVideoRef: forwarded to the local VideoTile for MediaPipe
 */

import React, { useMemo } from 'react';
import VideoTile from './VideoTile';
import type { IPeer, IUser, EngagementLabel } from '../../types';

interface VideoGridProps {
  localStream:  MediaStream | null;
  screenStream: MediaStream | null;
  localUser:    IUser;
  isMuted:      boolean;
  isCamOff:     boolean;
  peers:        Map<string, IPeer>;
  /** Phase 2: engagement label for the local tile badge (student only) */
  localEngagementLabel?: EngagementLabel | null;
  /** Phase 2: map of peer socketId → engagement label (shown on instructor view) */
  peerEngagementMap?:    Map<string, EngagementLabel>;
  /** Phase 2: local hand raised state */
  localHandRaised:       boolean;
  /** Phase 2: forwarded to the local VideoTile so MediaPipe can access the <video> element */
  localVideoRef?:        React.RefObject<HTMLVideoElement | null>;
}

/**
 * @description Computes the CSS grid column count based on total tile count.
 * @param count - Total number of participants (including local)
 * @returns {number} Number of columns for the CSS Grid
 */
const getColumnCount = (count: number): number => {
  if (count === 1)  return 1;
  if (count === 2)  return 2;
  if (count <= 4)   return 2;
  if (count <= 6)   return 3;
  if (count <= 9)   return 3;
  if (count <= 16)  return 4;
  return 4;
};

/**
 * @description Renders the full video grid for all session participants.
 *              Local tile is always first. Remote peers follow in join order.
 *              Passes engagement labels to tiles when available.
 * @param localStream          - Camera stream of the local user
 * @param localUser            - Authenticated user data (name, avatarColor)
 * @param isMuted              - Whether the local user's mic is muted
 * @param isCamOff             - Whether the local user's camera is off
 * @param peers                - Map of remote peer socket IDs to IPeer objects
 * @param localEngagementLabel - Optional engagement badge for the local tile
 * @param peerEngagementMap    - Optional map of peer engagement labels (instructor)
 * @param localVideoRef        - Optional ref forwarded to the local video element
 */
const VideoGrid: React.FC<VideoGridProps> = ({
  localStream, screenStream, localUser, isMuted, isCamOff, peers,
  localEngagementLabel, peerEngagementMap, localHandRaised, localVideoRef,
}) => {
  const [pinnedId, setPinnedId] = React.useState<string | null>(null);

  // Flatten all streams (camera + screen)
  const tiles = useMemo(() => {
    const arr: any[] = [];
    
    // 1. Local Camera
    arr.push({
      id: localStream?.id || 'local-cam',
      stream: localStream,
      displayName: localUser.name,
      avatarColor: localUser.avatarColor,
      isMuted, isCamOff, isSpeaking: false, isLocal: true,
      engagementLabel: localEngagementLabel ?? null,
      isHandRaised: localHandRaised,
      externalVideoRef: localVideoRef
    });

    // 2. Local Screen
    if (screenStream) {
      arr.push({
        id: screenStream.id || 'local-screen',
        stream: screenStream,
        displayName: `${localUser.name}'s Screen`,
        avatarColor: localUser.avatarColor,
        isMuted: true, isCamOff: false, isSpeaking: false, isLocal: true, isScreen: true
      });
    }

    // 3. Remote Peers
    peers.forEach((peer) => {
      arr.push({
        id: peer.stream?.id || `${peer.socketId}-cam`,
        stream: peer.stream,
        displayName: peer.displayName,
        avatarColor: '#6c63ff',
        isMuted: peer.isMuted, isCamOff: peer.isCamOff, isSpeaking: peer.isSpeaking, isLocal: false,
        engagementLabel: peerEngagementMap?.get(peer.socketId) ?? null,
        isHandRaised: peer.isHandRaised,
      });

      if (peer.screenStream) {
        arr.push({
          id: peer.screenStream.id || `${peer.socketId}-screen`,
          stream: peer.screenStream,
          displayName: `${peer.displayName}'s Screen`,
          avatarColor: '#6c63ff',
          isMuted: true, isCamOff: false, isSpeaking: false, isLocal: false, isScreen: true
        });
      }
    });

    return arr;
  }, [localStream, screenStream, localUser, isMuted, isCamOff, localEngagementLabel, localHandRaised, localVideoRef, peers, peerEngagementMap]);

  // Auto-pin newest screen if nothing is pinned
  React.useEffect(() => {
    const screens = tiles.filter(t => t.isScreen);
    if (screens.length > 0 && !pinnedId) {
      // Auto pin the last connected screen
      setPinnedId(screens[screens.length - 1].id);
    }
    // Clear pin if the pinned stream no longer exists
    if (pinnedId && !tiles.find(t => t.id === pinnedId)) {
      setPinnedId(null);
    }
  }, [tiles, pinnedId]);

  const columns = useMemo(() => getColumnCount(tiles.length), [tiles.length]);

  if (pinnedId) {
    const pinnedTile = tiles.find(t => t.id === pinnedId);
    const unpinnedTiles = tiles.filter(t => t.id !== pinnedId);

    return (
      <div className="w-full h-full p-3 flex gap-3 overflow-hidden">
        {/* Main Pinned View (75%) */}
        {pinnedTile && (
          <div style={{ flex: 3, maxWidth: '75%', height: '100%', minHeight: 0 }}>
             <VideoTile 
                key={pinnedTile.id} {...pinnedTile} 
                isPinned={true} 
                onPinToggle={() => setPinnedId(null)} 
             />
          </div>
        )}
        
        {/* Side Strip (25%) */}
        <div style={{ flex: 1, minWidth: '20%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
           {unpinnedTiles.map(t => (
               <div key={t.id} style={{ flexShrink: 0, minHeight: '22%' }}>
                  <VideoTile {...t} isPinned={false} onPinToggle={() => setPinnedId(t.id)} />
               </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full p-3"
      style={{
        display:             'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap:                 '8px',
        alignContent:        'start',
      }}
    >
      {tiles.map((t) => (
        <VideoTile 
          key={t.id} 
          {...t} 
          isPinned={false} 
          onPinToggle={() => setPinnedId(t.id)} 
        />
      ))}
    </div>
  );
};

export default VideoGrid;
