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
  // Tracks exactly which remote stream ID represents the screen share
  const screenStreamIdsRef = useRef<Map<string, string>>(new Map());
  // Tracks dynamically added senders
  const screenSendersRef  = useRef<Map<string, RTCRtpSender>>(new Map());

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
     * @description Triggered when a new track is added locally. Creates offer.
     */
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { to: peerId, sdp: pc.localDescription });
      } catch (err) {
        console.warn(`[WebRTC] Negotiation failed with ${peerId}`, err);
      }
    };

    /**
     * @description When a remote track arrives, evaluate if it is the known screen stream.
     */
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(peerId);
        
        const knownScreenId = screenStreamIdsRef.current.get(peerId);
        // If we know the exact screen ID, check it. Otherwise assume the 2nd stream is a screen fallback
        const isLikelyScreen = (knownScreenId && remoteStream.id === knownScreenId) || 
                               (existing?.stream && existing.stream.id !== remoteStream.id);
        
        updated.set(peerId, {
          socketId:    peerId,
          userId:      existing?.userId || '',
          displayName: peerDisplayName,
          stream:      isLikelyScreen ? (existing?.stream || null) : remoteStream,
          screenStream: isLikelyScreen ? remoteStream : (existing?.screenStream || null),
          isMuted:     existing?.isMuted  || false,
          isCamOff:    existing?.isCamOff || false,
          isSpeaking:  false,
          isHandRaised: existing?.isHandRaised || false,
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
    const handlePeers = async (data: { peers: Array<{ socketId: string; userId: string; displayName: string; isHandRaised?: boolean }> }) => {
      for (const peer of data.peers) {
        const pc = createPC(peer.socketId, peer.displayName);
        // If we are already sharing screen when we join, add it immediately
        if (screenStream) {
          const track = screenStream.getVideoTracks()[0];
          screenSendersRef.current.set(peer.socketId, pc.addTrack(track, screenStream));
          socket.emit('set-screen-stream', { roomCode, screenStreamId: screenStream.id });
        }
        setPeers((prev) => new Map(prev).set(peer.socketId, {
          socketId: peer.socketId, userId: peer.userId,
          displayName: peer.displayName, stream: null, screenStream: null,
          isMuted: false, isCamOff: false, isSpeaking: false, isHandRaised: peer.isHandRaised || false,
        }));
        // Note: onnegotiationneeded handles the offer creation now!
      }
    };

    /**
     * @description A new peer has joined the room. They will send us an offer.
     *              We just add them to state; the offer handler creates the PC.
     */
    const handlePeerJoined = (peer: { socketId: string; userId: string; displayName: string; isHandRaised?: boolean }) => {
      setPeers((prev) => new Map(prev).set(peer.socketId, {
        socketId: peer.socketId, userId: peer.userId,
        displayName: peer.displayName, stream: null, screenStream: null,
        isMuted: false, isCamOff: false, isSpeaking: false, isHandRaised: peer.isHandRaised || false,
      }));
    };

    /**
     * @description Incoming SDP offer from a peer. Create a PC, set remote desc,
     *              create answer, set local desc, and send the answer back.
     */
    const handleOffer = async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const existingPeer = [...peers.values()].find((p) => p.socketId === data.from);
      let pc = pcsRef.current.get(data.from);
      if (!pc) {
        pc = createPC(data.from, existingPeer?.displayName || 'Peer');
        if (screenStream) {
          const track = screenStream.getVideoTracks()[0];
          screenSendersRef.current.set(data.from, pc.addTrack(track, screenStream));
          socket.emit('set-screen-stream', { roomCode, screenStreamId: screenStream.id });
        }
      }
      // If signaling state isn't stable, setting remote offer can clash. 
      if (pc.signalingState !== 'stable') {
         await Promise.all([pc.setLocalDescription({type: 'rollback'}), pc.setRemoteDescription(new RTCSessionDescription(data.sdp))]);
      } else {
         await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
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

    const handlePeerHandRaised = ({ socketId }: { socketId: string }) => {
      setPeers((prev) => {
        const updated = new Map(prev);
        const peer = updated.get(socketId);
        if (peer) updated.set(socketId, { ...peer, isHandRaised: true });
        return updated;
      });
    };

    const handlePeerHandLowered = ({ socketId }: { socketId: string }) => {
      setPeers((prev) => {
        const updated = new Map(prev);
        const peer = updated.get(socketId);
        if (peer) updated.set(socketId, { ...peer, isHandRaised: false });
        return updated;
      });
    };

    /**
     * @description A peer has left. Close and remove their connection.
     */
    const handleSetScreenStream = ({ socketId, screenStreamId }: { socketId: string, screenStreamId: string }) => {
      screenStreamIdsRef.current.set(socketId, screenStreamId);
      
      // Retroactively correct if tracks arrived before the socket event
      setPeers((prev) => {
        const updated = new Map(prev);
        const peer = updated.get(socketId);
        if (peer && peer.stream && peer.stream.id === screenStreamId) {
           updated.set(socketId, {
             ...peer,
             screenStream: peer.stream,
             stream: peer.screenStream // put the previous screen stream into camera if it exists
           });
        }
        return updated;
      });
    };

    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      removePC(socketId);
      screenSendersRef.current.delete(socketId);
    };

    socket.on('peers',         handlePeers);
    socket.on('peer-joined',   handlePeerJoined);
    socket.on('offer',         handleOffer);
    socket.on('answer',        handleAnswer);
    socket.on('ice-candidate', handleIce);
    socket.on('peer-muted',    handlePeerMuted);
    socket.on('peer-unmuted',  handlePeerUnmuted);
    socket.on('peer-hand-raised', handlePeerHandRaised);
    socket.on('peer-hand-lowered', handlePeerHandLowered);
    socket.on('peer-left',     handlePeerLeft);
    socket.on('set-screen-stream', handleSetScreenStream);

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
      socket.off('peer-hand-raised');
      socket.off('peer-hand-lowered');
      socket.off('peer-left');
      socket.off('set-screen-stream');
      socket.emit('leave', { roomCode });
      socket.disconnect();
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      screenSendersRef.current.clear();
    };
  }, [localStream, roomCode, userId, displayName, createPC, removePC, screenStream]);

  /**
   * @description Whenever the screenStream toggles, we add or remove the track
   *              from existing peer connections. This triggers onnegotiationneeded automatically.
   */
  useEffect(() => {
    pcsRef.current.forEach((pc, peerId) => {
      if (screenStream) {
        if (!screenSendersRef.current.has(peerId)) {
          const track = screenStream.getVideoTracks()[0];
          screenSendersRef.current.set(peerId, pc.addTrack(track, screenStream));
        }
      } else {
        const sender = screenSendersRef.current.get(peerId);
        if (sender) {
          pc.removeTrack(sender);
          screenSendersRef.current.delete(peerId);
        }
      }
    });

    if (screenStream) {
       socket.emit('set-screen-stream', { roomCode, screenStreamId: screenStream.id });
    }
  }, [screenStream, roomCode]);

  return { peers };
};

export default useWebRTC;
