/**
 * @file useEngagement.ts
 * @description React hook that orchestrates client-side engagement inference.
 *
 *              Lifecycle:
 *               1. Initialises MediaPipe FaceLandmarker via CDN WASM on mount
 *               2. Runs detectForVideo() on every animation frame (~30fps)
 *               3. Every 3 seconds: POSTs the latest result to save-record
 *                  and emits 'engagement-update' via Socket.IO for the instructor
 *               4. On unmount: cancels the rAF loop, clears the interval,
 *                  closes the FaceLandmarker, and resets smoothing history
 *
 *              Privacy guarantee: raw video frames never leave this hook.
 *              Only a ~200-byte JSON result is sent over the network.
 *
 *              Graceful fallback: if MediaPipe fails to load (CDN blocked,
 *              low-end device), inferenceError is set and the classroom
 *              continues to function normally with monitoring disabled.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import api    from '../api/api';
import socket from '../socket/socket';
import { predictFromLandmarks, resetHistory } from '../lib/engagementInference';
import type { IEngagementResult } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * WASM base URL used by FilesetResolver.forVisionTasks().
 * This is fetched via fetch() internally — NOT executed as a <script> —
 * so browser MIME-type script blocking does not apply.
 * We use unpkg which reliably serves npm package files with correct Content-Type.
 */
const MEDIAPIPE_WASM_URL =
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/wasm';

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Interval between periodic saves and socket emits (milliseconds) */
const SAVE_INTERVAL_MS = 2000;  // reduced from 3000 — halves worst-case instructor badge lag


interface UseEngagementParams {
  /** Ref to the local <video> element — used by FaceLandmarker.detectForVideo() */
  localVideoRef: React.RefObject<HTMLVideoElement>;
  /** Room code — included in the save-record POST URL */
  roomCode:      string;
  /** Session MongoDB ID — for context only (server resolves via roomCode) */
  sessionId:     string;
  /**
   * Set to false to skip inference entirely (instructors, or before stream ready).
   * The hook is a no-op when disabled.
   */
  enabled:       boolean;
}

interface UseEngagementReturn {
  /** Latest inference result — updates on every animation frame */
  engagementResult: IEngagementResult | null;
  /** True once MediaPipe has loaded and inference loop is running */
  isInferring:      boolean;
  /**
   * Non-null when a blocking error occurred:
   *  - MediaPipe failed to load (CDN blocked, WASM error)
   *  - save-record failed 3 consecutive times (server unreachable)
   * Classroom.tsx surfaces this as a visible toast.
   */
  inferenceError:   string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @description Manages the full client-side engagement monitoring pipeline:
 *              MediaPipe init → per-frame inference → periodic DB save → socket emit.
 * @param localVideoRef - Ref to the student's local <video> element
 * @param roomCode      - Current room identifier
 * @param sessionId     - Current session MongoDB ID
 * @param enabled       - Whether inference should run (false for instructors)
 * @returns {UseEngagementReturn} Latest result, inference status, and error state
 */
const useEngagement = ({
  localVideoRef,
  roomCode,
  sessionId,
  enabled,
}: UseEngagementParams): UseEngagementReturn => {
  const [engagementResult, setEngagementResult] = useState<IEngagementResult | null>(null);
  const [isInferring,      setIsInferring]      = useState(false);
  const [inferenceError,   setInferenceError]   = useState<string | null>(null);

  // Refs for loop and interval handles
  const rafIdRef        = useRef<number>(0);
  const intervalIdRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to the last result — used inside the interval without stale closure
  const latestResultRef = useRef<IEngagementResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef   = useRef<any>(null);
  /**
   * Tracks consecutive save-record failures.
   * After MAX_SAVE_FAILURES in a row, inferencError is set so the UI can warn the user.
   */
  const saveFailCountRef = useRef<number>(0);
  const MAX_SAVE_FAILURES = 3;

  /**
   * @description Dynamically imports @mediapipe/tasks-vision (npm package),
   *              resolves the WASM runtime via FilesetResolver, then creates
   *              a FaceLandmarker configured for VIDEO mode.
   *
   *              Why dynamic import?
   *              - Vite code-splits it into a separate chunk (loaded on demand)
   *              - Avoids the MIME-type issue caused by CDN <script> injection
   *              - WASM binary is fetched from unpkg via fetch() inside
   *                FilesetResolver — not executed as a script — so strict
   *                MIME checking does not block it.
   *
   * @throws Sets inferenceError state if loading or initialisation fails
   * @returns {Promise<void>}
   */
  const loadMediaPipe = useCallback(async (): Promise<void> => {
    try {
      // Dynamic import — Vite splits this into its own chunk.
      // The package is excluded from esbuild pre-bundling in vite.config.ts.
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_URL,
          delegate:       'GPU', // auto-falls back to CPU on unsupported devices
        },
        runningMode:                        'VIDEO',
        numFaces:                           1,
        minFaceDetectionConfidence:         0.5,
        minTrackingConfidence:              0.5,
        outputFaceBlendshapes:              false,
        outputFacialTransformationMatrixes: false,
      });

      setIsInferring(true);
      console.log('[Engagement] MediaPipe FaceLandmarker ready.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Engagement] MediaPipe failed to load:', msg);
      setInferenceError(
        'Engagement monitoring unavailable — MediaPipe could not be loaded. ' +
        'The video call is unaffected.'
      );
    }
  }, []);

  /**
   * @description Saves the latest engagement result to the DB and emits the
   *              ephemeral socket event for the instructor's live view.
   *              Tracks consecutive failures — after MAX_SAVE_FAILURES in a row,
   *              sets inferenceError so Classroom.tsx can surface a visible warning.
   * @returns {Promise<void>}
   */
  const saveAndEmit = useCallback(async (): Promise<void> => {
    const result = latestResultRef.current;
    if (!result || !roomCode) return;

    // Always emit via socket so the instructor's live view stays current.
    if (socket.connected) {
      socket.emit('engagement-update', {
        roomCode,
        engagementLevel: result.label,
      });
    }

    // Skip DB write when fully engaged — saves ~60-70% of storage.
    // The socket emit above ensures the instructor still sees very_high in real time.
    // Analytics queries handle gaps with Last Observation Carried Forward (LOCF).
    if (result.label === 'very_high') return;

    // For all other labels POST to save-record
    try {
      await api.post(`/rooms/${roomCode}/save-record`, {
        engagementLevel: result.label,
        confidenceScore: result.score,
        modelUsed:       'client_mediapipe',
        faceStats:       result.faceStats,
      });
      saveFailCountRef.current = 0;
    } catch (err) {
      saveFailCountRef.current++;
      const count = saveFailCountRef.current;
      console.warn(`[Engagement] save-record failed (attempt ${count}):`, err);
      if (count >= MAX_SAVE_FAILURES) {
        const detail = err instanceof Error ? err.message : 'Network error';
        setInferenceError(
          `Engagement data is not being saved (${detail}). ` +
          `Check your connection — the video call is unaffected.`
        );
      }
    }
  }, [roomCode]);

  /**
   * @description The main animation-frame loop. Calls FaceLandmarker.detectForVideo()
   *              on every frame and updates engagement state.
   * @returns {void}
   */
  const runLoop = useCallback((): void => {
    const loop = () => {
      const videoEl = localVideoRef.current;

      if (
        videoEl &&
        videoEl.readyState >= 2 && // HAVE_CURRENT_DATA — video has data to display
        landmarkerRef.current
      ) {
        try {
          const result = landmarkerRef.current.detectForVideo(videoEl, performance.now());
          const landmarks =
            result.faceLandmarks && result.faceLandmarks.length > 0
              ? result.faceLandmarks[0]
              : null;

          // Pass actual pixel dimensions — EAR must be computed in pixel space
          // (matching inference.py which multiplies by image width/height).
          // videoWidth/videoHeight are always available when readyState >= 2.
          const prediction = predictFromLandmarks(
            landmarks,
            videoEl.videoWidth  || 640,
            videoEl.videoHeight || 480,
          );

          // Only update React state when the label changes.
          // Without this guard, setEngagementResult fires ~30/s (every rAF),
          // triggering full re-renders of Classroom→VideoGrid→all tiles at 30fps.
          // The badge is a 4-value enum, so state updates are now ~1-4/min.
          const prevLabel = latestResultRef.current?.label;
          latestResultRef.current = prediction;
          if (prediction.label !== prevLabel) {
            setEngagementResult(prediction);
          }
        } catch (err) {
          // Transient errors (page not visible etc.) — log and continue
          console.warn('[Engagement] detectForVideo error:', err);
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [localVideoRef]);

  // ── Main effect — init and start ────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    let cleanedUp = false;

    const start = async () => {
      await loadMediaPipe();
      if (cleanedUp || !landmarkerRef.current) return;

      // Start animation frame loop
      runLoop();

      // Start 3-second periodic save + emit
      intervalIdRef.current = setInterval(() => {
        saveAndEmit();
      }, SAVE_INTERVAL_MS);
    };

    start();

    return () => {
      cleanedUp = true;

      // Cancel animation frame loop
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      // Clear periodic save interval
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);

      // Close the MediaPipe landmarker to free WASM memory
      try { landmarkerRef.current?.close(); } catch { /* ignore */ }
      landmarkerRef.current = null;

      // Reset smoothing history so next session starts fresh
      resetHistory();

      setIsInferring(false);
    };
  }, [enabled, loadMediaPipe, runLoop, saveAndEmit]);

  // Trigger an immediate save when sessionId changes (not used in typical flow)
  useEffect(() => {
    if (sessionId) {
      // sessionId is available — no action needed, included for future use
    }
  }, [sessionId]);

  return { engagementResult, isInferring, inferenceError };
};

export default useEngagement;
