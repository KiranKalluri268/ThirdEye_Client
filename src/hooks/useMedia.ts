/**
 * @file useMedia.ts
 * @description Custom React hook that manages the local camera and microphone stream.
 *              Handles: getUserMedia, screen share, audio mute/unmute, video toggle.
 *              The stream is used both by the video grid (local tile) and by
 *              useWebRTC (for adding tracks to peer connections).
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMediaReturn {
  localStream:       MediaStream | null;
  screenStream:      MediaStream | null;
  isMuted:           boolean;
  isCamOff:          boolean;
  isSharingScreen:   boolean;
  startMedia:        () => Promise<void>;
  stopMedia:         () => void;
  toggleAudio:       () => void;
  toggleVideo:       () => void;
  forceMuteAudio:    () => void;
  forceMuteVideo:    () => void;
  forceUnmuteAudio:  () => void;
  forceUnmuteVideo:  () => void;
  startScreenShare:  () => Promise<void>;
  stopScreenShare:   () => void;
}

/**
 * @description Provides local media stream management for the classroom.
 *              Call startMedia() when the user joins a room.
 *              Pass localStream to peer connections via useWebRTC.
 * @returns {UseMediaReturn} Local stream state and control functions
 */
const useMedia = (): UseMediaReturn => {
  const [localStream,     setLocalStream]     = useState<MediaStream | null>(null);
  const [screenStream,    setScreenStream]    = useState<MediaStream | null>(null);
  const [isMuted,         setIsMuted]         = useState(false);
  const [isCamOff,        setIsCamOff]        = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);

  /**
   * @description Requests camera and microphone permissions and starts the local stream.
   * @throws {Error} If permissions are denied
   */
  const startMedia = useCallback(async (): Promise<void> => {
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }, // Removed facingMode
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (firstErr) {
        console.warn('[Media] Preferred constraints failed, falling back to basic:', firstErr);
        // Fallback to completely basic request if specific constraints fail
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      streamRef.current = stream;
      setLocalStream(stream);
    } catch (err) {
      console.error('[Media] Could not get user media:', err);
      // Start with a blank stream so the user can still join without camera
      const blank = new MediaStream();
      streamRef.current = blank;
      setLocalStream(blank);
      setIsCamOff(true);
      setIsMuted(true);
    }
  }, []);

  /**
   * @description Stops all tracks in the local stream and cleans up.
   */
  const stopMedia = useCallback((): void => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
  }, []);

  /**
   * @description Toggles the audio track on/off. Updates isMuted state.
   */
  const toggleAudio = useCallback((): void => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  /**
   * @description Toggles the video track on/off. Updates isCamOff state.
   */
  const toggleVideo = useCallback((): void => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCamOff(!track.enabled);
  }, []);

  /**
   * @description Force-disables the audio track (instructor-initiated).
   *              Unlike toggleAudio, this always mutes and never unmutes.
   */
  const forceMuteAudio = useCallback((): void => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = false;
    setIsMuted(true);
  }, []);

  /**
   * @description Force-disables the video track (instructor-initiated).
   *              Unlike toggleVideo, this always turns camera off and never on.
   */
  const forceMuteVideo = useCallback((): void => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = false;
    setIsCamOff(true);
  }, []);

  /**
   * @description Force-enables the audio track (instructor-initiated).
   */
  const forceUnmuteAudio = useCallback((): void => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = true;
    setIsMuted(false);
  }, []);

  /**
   * @description Force-enables the video track (instructor-initiated).
   */
  const forceUnmuteVideo = useCallback((): void => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = true;
    setIsCamOff(false);
  }, []);

  /**
   * @description Starts a screen share by requesting display media.
   *              On stream end (user stops sharing), resets state automatically.
   * @throws {Error} If screen share permission is denied
   */
  const startScreenShare = useCallback(async (): Promise<void> => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screen.getVideoTracks()[0].addEventListener('ended', () => {
        setScreenStream(null);
        setIsSharingScreen(false);
      });
      setScreenStream(screen);
      setIsSharingScreen(true);
    } catch (err) {
      console.error('[Media] Screen share denied:', err);
    }
  }, []);

  /**
   * @description Stops the active screen share stream.
   */
  const stopScreenShare = useCallback((): void => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setIsSharingScreen(false);
  }, [screenStream]);

  /** Clean up on unmount */
  useEffect(() => () => stopMedia(), [stopMedia]);

  return {
    localStream, screenStream,
    isMuted, isCamOff, isSharingScreen,
    startMedia, stopMedia,
    toggleAudio, toggleVideo,
    forceMuteAudio, forceMuteVideo,
    forceUnmuteAudio, forceUnmuteVideo,
    startScreenShare, stopScreenShare,
  };
};

export default useMedia;
