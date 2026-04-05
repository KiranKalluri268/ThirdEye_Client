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
  localUser:    IUser;
  isMuted:      boolean;
  isCamOff:     boolean;
  peers:        Map<string, IPeer>;
  /** Phase 2: engagement label for the local tile badge (student only) */
  localEngagementLabel?: EngagementLabel | null;
  /** Phase 2: map of peer socketId → engagement label (shown on instructor view) */
  peerEngagementMap?:    Map<string, EngagementLabel>;
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
  localStream, localUser, isMuted, isCamOff, peers,
  localEngagementLabel, peerEngagementMap, localVideoRef,
}) => {
  const totalCount = peers.size + 1; // +1 for local
  const columns = useMemo(() => getColumnCount(totalCount), [totalCount]);

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
      {/* Local tile — always first */}
      <VideoTile
        stream={localStream}
        displayName={localUser.name}
        avatarColor={localUser.avatarColor}
        isMuted={isMuted}
        isCamOff={isCamOff}
        isSpeaking={false}
        isLocal={true}
        engagementLabel={localEngagementLabel ?? null}
        externalVideoRef={localVideoRef}
      />

      {/* Remote peer tiles */}
      {[...peers.values()].map((peer) => (
        <VideoTile
          key={peer.socketId}
          stream={peer.stream}
          displayName={peer.displayName}
          avatarColor="#6c63ff"
          isMuted={peer.isMuted}
          isCamOff={peer.isCamOff}
          isSpeaking={peer.isSpeaking}
          isLocal={false}
          engagementLabel={peerEngagementMap?.get(peer.socketId) ?? null}
        />
      ))}
    </div>
  );
};

export default VideoGrid;
