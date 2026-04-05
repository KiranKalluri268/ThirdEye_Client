/**
 * @file useWebRTC.ts
 * @description The core WebRTC hook. Manages all RTCPeerConnection instances,
 *              listens to Socket.IO signaling events, and maintains the map of
 *              connected remote peers with their streams and state.
 *
 *              Flow:
 *               1. Socket sends 'join' → server replies with 'peers' (existing)
 *               2. This hook creates an RTCPeerConnection + sends offer to each
 *               3. New peers trigger 'peer-joined' → send them an offer
 *               4. 'offer' / 'answer' / 'ice-candidate' are relayed and applied
 *               5. 'peer-left' → close and remove the RTCPeerConnection
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import socket from '../socket/socket';
import type { IPeer } from '../types';

/** Google STUN server — no TURN needed for LAN/localhost */
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface UseWebRTCParams {
  roomCode:     string;
  userId:       string;
  displayName:  string;
  localStream:  MediaStream | null;
  /** When set, replaces the video track on all peer connections with the screen track */
  screenStream: MediaStream | null;
}

interface UseWebRTCReturn {
  peers: Map<string, IPeer>;
}

/**
 * @description Manages all peer-to-peer WebRTC connections for a room session.
 *              Automatically creates connections when peers join/leave.
 * @param roomCode    - The identifier of the current room
 * @param userId      - MongoDB ID of the authenticated user
 * @param displayName - Name shown in the video tile
 * @param localStream - Local camera/mic stream to send to peers
 * @returns {Map<string, IPeer>} Live map of connected peers
 */
const useWebRTC = ({ roomCode, userId, displayName, localStream, screenStream }: UseWebRTCParams): UseWebRTCReturn => {
  const [peers, setPeers] = useState<Map<string, IPeer>>(new Map());
  const pcsRef            = useRef<Map<string, RTCPeerConnection>>(new Map());

  /**
   * @description Creates a new RTCPeerConnection for a given peer, adds
   *              local stream tracks, and wires ICE + track event handlers.
   * @param peerId      - The socket ID of the remote peer
   * @param displayName - The remote peer's display name
   * @returns {RTCPeerConnection}
   */
  const createPC = useCallback((peerId: string, peerDisplayName: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add all local tracks to the connection
    localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    /**
     * @description Relays ICE candidates to the remote peer via the signaling server.
     */
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { to: peerId, candidate: event.candidate });
      }
    };

    /**
     * @description When a remote track arrives, attach it to the peer's stream entry
     *              and update the peers state so the VideoGrid re-renders.
     */
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(peerId);
        updated.set(peerId, {
          socketId:    peerId,
          userId:      existing?.userId || '',
          displayName: peerDisplayName,
          stream:      remoteStream,
          isMuted:     existing?.isMuted  || false,
          isCamOff:    existing?.isCamOff || false,
          isSpeaking:  false,
        });
        return updated;
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Connection failed with ${peerId}`);
      }
    };

    pcsRef.current.set(peerId, pc);
    return pc;
  }, [localStream]);

  /**
   * @description Closes and removes a peer connection, cleaning up both
   *              the pcsRef map and the peers state.
   * @param peerId - Socket ID of the peer to remove
   */
  const removePC = useCallback((peerId: string): void => {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    setPeers((prev) => {
      const updated = new Map(prev);
      updated.delete(peerId);
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!localStream) return;

    /**
     * @description Received on join: list of peers already in the room.
     *              We create a connection and send an offer to each.
     */
    const handlePeers = async (data: { peers: Array<{ socketId: string; userId: string; displayName: string }> }) => {
      for (const peer of data.peers) {
        const pc = createPC(peer.socketId, peer.displayName);
        setPeers((prev) => new Map(prev).set(peer.socketId, {
          socketId: peer.socketId, userId: peer.userId,
          displayName: peer.displayName, stream: null,
          isMuted: false, isCamOff: false, isSpeaking: false,
        }));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { to: peer.socketId, sdp: offer });
      }
    };

    /**
     * @description A new peer has joined the room. They will send us an offer.
     *              We just add them to state; the offer handler creates the PC.
     */
    const handlePeerJoined = (peer: { socketId: string; userId: string; displayName: string }) => {
      setPeers((prev) => new Map(prev).set(peer.socketId, {
        socketId: peer.socketId, userId: peer.userId,
        displayName: peer.displayName, stream: null,
        isMuted: false, isCamOff: false, isSpeaking: false,
      }));
    };

    /**
     * @description Incoming SDP offer from a peer. Create a PC, set remote desc,
     *              create answer, set local desc, and send the answer back.
     */
    const handleOffer = async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const existingPeer = [...peers.values()].find((p) => p.socketId === data.from);
      const pc = createPC(data.from, existingPeer?.displayName || 'Peer');
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: data.from, sdp: answer });
    };

    /**
     * @description Incoming SDP answer from a peer. Set as remote description.
     */
    const handleAnswer = async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = pcsRef.current.get(data.from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    };

    /**
     * @description Incoming ICE candidate from a peer. Add to the connection.
     */
    const handleIce = async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcsRef.current.get(data.from);
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); }
        catch (e) { console.warn('[WebRTC] ICE error:', e); }
      }
    };

    /**
     * @description A peer has muted/unmuted. Update their state in the map.
     */
    const handlePeerMuted = ({ socketId, kind }: { socketId: string; kind: 'audio' | 'video' }) => {
      setPeers((prev) => {
        const updated = new Map(prev);
        const peer = updated.get(socketId);
        if (peer) updated.set(socketId, { ...peer, isMuted: kind === 'audio' ? true : peer.isMuted, isCamOff: kind === 'video' ? true : peer.isCamOff });
        return updated;
      });
    };

    const handlePeerUnmuted = ({ socketId, kind }: { socketId: string; kind: 'audio' | 'video' }) => {
      setPeers((prev) => {
        const updated = new Map(prev);
        const peer = updated.get(socketId);
        if (peer) updated.set(socketId, { ...peer, isMuted: kind === 'audio' ? false : peer.isMuted, isCamOff: kind === 'video' ? false : peer.isCamOff });
        return updated;
      });
    };

    /**
     * @description A peer has left. Close and remove their connection.
     */
    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      removePC(socketId);
    };

    socket.on('peers',         handlePeers);
    socket.on('peer-joined',   handlePeerJoined);
    socket.on('offer',         handleOffer);
    socket.on('answer',        handleAnswer);
    socket.on('ice-candidate', handleIce);
    socket.on('peer-muted',    handlePeerMuted);
    socket.on('peer-unmuted',  handlePeerUnmuted);
    socket.on('peer-left',     handlePeerLeft);

    // Join the room
    socket.connect();
    socket.emit('join', { roomCode, userId, displayName });

    return () => {
      socket.off('peers');
      socket.off('peer-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('peer-muted');
      socket.off('peer-unmuted');
      socket.off('peer-left');
      socket.emit('leave', { roomCode });
      socket.disconnect();
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
    };
  }, [localStream, roomCode, userId, displayName, createPC, removePC]);

  /**
   * @description Replaces the video track on all active peer connections when
   *              screen share starts or stops. Uses RTCRtpSender.replaceTrack()
   *              so no new SDP negotiation is required.
   * @param screenStream - Active screen share stream, or null when stopped
   * @param localStream  - Original camera/mic stream to restore on stop
   */
  useEffect(() => {
    pcsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (!sender) return;
      if (screenStream) {
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) sender.replaceTrack(screenTrack);
      } else if (localStream) {
        const camTrack = localStream.getVideoTracks()[0];
        if (camTrack) sender.replaceTrack(camTrack);
      }
    });
  }, [screenStream, localStream]);

  return { peers };
};

export default useWebRTC;
