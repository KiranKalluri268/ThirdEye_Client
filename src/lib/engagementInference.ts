/**
 * @file engagementInference.ts
 * @description Pure TypeScript engagement scoring engine — browser-side equivalent
 *              of `engagement_project/ml_engine/inference.py`.
 *
 *              Takes 478 facial landmarks from MediaPipe FaceLandmarker and
 *              returns an engagement label + confidence via the same weighted
 *              scoring logic used by the Python server-side engine.
 *
 *              This module is intentionally stateless except for the 3-frame
 *              smoothing history, which can be reset via resetHistory().
 *              No React, no network calls, no side effects.
 */

import type { EngagementLabel, IEngagementResult } from '../types';

// ── Landmark index constants (must match inference.py exactly) ─────────────────

/** Left eye landmark indices for EAR calculation */
const LEFT_EYE   = [362, 385, 387, 263, 373, 380] as const;
/** Right eye landmark indices for EAR calculation */
const RIGHT_EYE  = [33,  160, 158, 133, 153, 144] as const;
/** Left iris landmark indices for gaze calculation */
const LEFT_IRIS  = [474, 475, 476, 477] as const;
/** Right iris landmark indices for gaze calculation */
const RIGHT_IRIS = [469, 470, 471, 472] as const;

const NOSE_TIP = 1;
const CHIN     = 152;
const FOREHEAD = 10;
const FACE_L   = 234;
const FACE_R   = 454;

// ── EAR thresholds (must match inference.py exactly) ──────────────────────────

const EAR_OPEN   = 0.20; // both eyes clearly open
const EAR_HALF   = 0.14; // drowsy / half-closed
const EAR_CLOSED = 0.10; // eyes fully closed

// ── Score → label thresholds (must match inference.py exactly) ────────────────

const LABEL_MAP: EngagementLabel[] = ['very_low', 'low', 'high', 'very_high'];

// ── Smoothing history ─────────────────────────────────────────────────────────

const HISTORY_LEN = 3;
let scoreHistory: number[] = [];

// ── Landmark type ─────────────────────────────────────────────────────────────

interface Landmark {
  x: number;
  y: number;
  z: number;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * @description Computes Euclidean distance between two 2D points.
 * @param a - First point [x, y]
 * @param b - Second point [x, y]
 * @returns {number} Euclidean distance
 */
const norm2d = (a: [number, number], b: [number, number]): number =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

/**
 * @description Extracts the [x, y] coordinates of a landmark by index.
 * @param landmarks - Full 478-landmark array from MediaPipe
 * @param idx       - Landmark index
 * @returns {[number, number]} Normalised [x, y] pair (0–1 range)
 */
const pt = (landmarks: Landmark[], idx: number): [number, number] =>
  [landmarks[idx].x, landmarks[idx].y];

// ── Eye Aspect Ratio ──────────────────────────────────────────────────────────

/**
 * @description Computes the Eye Aspect Ratio (EAR) for one eye.
 *              EAR < EAR_CLOSED → eyes shut; EAR > EAR_OPEN → eyes open.
 * @param landmarks - Full landmark array
 * @param indices   - 6 landmark indices [p1..p6] for the eye
 * @returns {number} EAR value (larger = more open)
 */
const earValue = (landmarks: Landmark[], indices: readonly number[]): number => {
  try {
    const pts = indices.map((i) => pt(landmarks, i));
    const v1  = norm2d(pts[1], pts[5]);
    const v2  = norm2d(pts[2], pts[4]);
    const h   = norm2d(pts[0], pts[3]);
    return (v1 + v2) / (2.0 * h + 1e-6);
  } catch {
    return 0.20; // neutral fallback
  }
};

// ── Core Engagement Scorer ────────────────────────────────────────────────────

interface RawEngagement {
  score:        number;
  maxScore:     number;
  numEyes:      number;
  faceCentered: boolean;
  earAvg:       number;
}

/**
 * @description Computes the raw (unsmoothed) engagement score from facial landmarks.
 *              Weights: eyes 40%, gaze 22%, head yaw 15%, face centre 13%,
 *              face size 7%, base 3%. Matches inference.py compute_engagement().
 * @param landmarks - 478 MediaPipe FaceLandmarker landmarks
 * @returns {RawEngagement} Raw score, max score ceiling, and face stats
 */
const computeEngagement = (landmarks: Landmark[]): RawEngagement => {
  // ── EAR — primary gate ───────────────────────────────────────────────────
  const earL   = earValue(landmarks, LEFT_EYE);
  const earR   = earValue(landmarks, RIGHT_EYE);
  const earAvg = (earL + earR) / 2.0;

  let eyeScore: number;
  let maxScore: number;
  let numEyes:  number;

  if (earAvg < EAR_CLOSED) {
    // Eyes fully closed — hard Very Low gate
    return { score: 0.05, maxScore: 0.20, numEyes: 0, faceCentered: true, earAvg };
  } else if (earAvg < EAR_HALF) {
    eyeScore = Math.min((earAvg - EAR_CLOSED) / (EAR_HALF - EAR_CLOSED), 0.35);
    maxScore = 0.40;
    numEyes  = 0;
  } else if (earAvg < EAR_OPEN) {
    eyeScore = Math.min((earAvg - EAR_HALF) / (EAR_OPEN - EAR_HALF) * 0.7 + 0.30, 1.0);
    maxScore = 0.65;
    numEyes  = 1;
  } else {
    eyeScore = Math.min((earAvg - EAR_OPEN) / 0.15 * 0.3 + 0.70, 1.0);
    maxScore = 1.0;
    numEyes  = 2;
  }

  // ── Gaze ─────────────────────────────────────────────────────────────────
  let gazeScore = 0.55;
  try {
    const ixL = LEFT_IRIS.reduce( (s, i) => s + landmarks[i].x, 0) / LEFT_IRIS.length;
    const exL = LEFT_EYE.reduce(  (s, i) => s + landmarks[i].x, 0) / LEFT_EYE.length;
    const iyL = LEFT_IRIS.reduce( (s, i) => s + landmarks[i].y, 0) / LEFT_IRIS.length;
    const eyL = LEFT_EYE.reduce(  (s, i) => s + landmarks[i].y, 0) / LEFT_EYE.length;
    const ixR = RIGHT_IRIS.reduce((s, i) => s + landmarks[i].x, 0) / RIGHT_IRIS.length;
    const exR = RIGHT_EYE.reduce( (s, i) => s + landmarks[i].x, 0) / RIGHT_EYE.length;
    const off = Math.abs(ixL - exL) + Math.abs(iyL - eyL) + Math.abs(ixR - exR);
    gazeScore = Math.max(0, Math.min(1.0 - off * 18, 1.0));
  } catch { /* use default */ }

  // ── Head yaw ─────────────────────────────────────────────────────────────
  let headScore = 0.7;
  try {
    const noseX   = landmarks[NOSE_TIP].x;
    const centerX = (landmarks[FACE_L].x + landmarks[FACE_R].x) / 2.0;
    headScore = Math.max(0, Math.min(1.0 - Math.abs(noseX - centerX) * 9, 1.0));
  } catch { /* use default */ }

  // ── Face position and size ────────────────────────────────────────────────
  let centScore = 0.5;
  let sizeScore = 0.4;
  let faceCentered = false;
  try {
    const fx    = (landmarks[FACE_L].x + landmarks[FACE_R].x) / 2.0;
    const fy    = (landmarks[FOREHEAD].y + landmarks[CHIN].y)  / 2.0;
    centScore   = Math.max(0, Math.min(1.0 - Math.abs(fx - 0.5) * 2.5 - Math.abs(fy - 0.5) * 1.5, 1.0));
    const fw    = Math.abs(landmarks[FACE_L].x - landmarks[FACE_R].x);
    const fh    = Math.abs(landmarks[CHIN].y   - landmarks[FOREHEAD].y);
    sizeScore   = Math.max(0, Math.min(fw * fh * 8, 1.0));
    faceCentered = centScore > 0.5;
  } catch { /* use defaults */ }

  // ── Weighted score (weights must match inference.py exactly) ──────────────
  const raw = 0.40 * eyeScore  +
              0.22 * gazeScore +
              0.15 * headScore +
              0.13 * centScore +
              0.07 * sizeScore +
              0.03 * 1.0;

  return {
    score:        Math.min(raw, maxScore),
    maxScore,
    numEyes,
    faceCentered,
    earAvg,
  };
};

// ── Smoothing and Label ───────────────────────────────────────────────────────

/**
 * @description Applies 3-frame rolling average to the raw score and maps it
 *              to an engagement label with representative confidence probabilities.
 *              Matches inference.py smooth_label() exactly.
 * @param rawScore - Raw engagement score from computeEngagement (0.0 – 1.0)
 * @returns {{ label, confidence, score }} Smoothed prediction
 */
const smoothAndLabel = (rawScore: number): { label: EngagementLabel; confidence: number; score: number } => {
  scoreHistory.push(rawScore);
  if (scoreHistory.length > HISTORY_LEN) scoreHistory.shift();

  const score = scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length;

  let labelIdx: number;
  let baseProbs: [number, number, number, number];

  if      (score < 0.20) { labelIdx = 0; baseProbs = [0.75, 0.17, 0.06, 0.02]; }
  else if (score < 0.42) { labelIdx = 1; baseProbs = [0.07, 0.68, 0.20, 0.05]; }
  else if (score < 0.65) { labelIdx = 2; baseProbs = [0.04, 0.11, 0.70, 0.15]; }
  else                   { labelIdx = 3; baseProbs = [0.02, 0.05, 0.18, 0.75]; }

  // Small noise for natural probability variation (matches Python implementation)
  const probs  = baseProbs.map((p) => Math.max(0, p + (Math.random() - 0.5) * 0.03));
  const sum    = probs.reduce((a, b) => a + b, 0);
  const normed = probs.map((p) => p / sum);

  return {
    label:      LABEL_MAP[labelIdx],
    confidence: parseFloat(Math.max(...normed).toFixed(4)),
    score:      parseFloat(score.toFixed(3)),
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @description Main inference function. Call with the first element of
 *              MediaPipe FaceLandmarker's `faceLandmarks` array.
 *              If landmarks is null (no face detected), returns very_low.
 * @param landmarks - Array of 478 {x, y, z} landmark objects, or null
 * @returns {IEngagementResult} Engagement label, confidence, and face stats
 */
export const predictFromLandmarks = (
  landmarks: Landmark[] | null,
): IEngagementResult => {
  // No face detected
  if (!landmarks || landmarks.length === 0) {
    scoreHistory.push(0.05);
    if (scoreHistory.length > HISTORY_LEN) scoreHistory.shift();
    return {
      label:      'very_low',
      confidence: 0.90,
      score:      0.05,
      faceStats:  { faceDetected: false, eyesDetected: 0, faceCentered: false, earAvg: 0 },
    };
  }

  const eng = computeEngagement(landmarks);
  const out = smoothAndLabel(eng.score);

  return {
    label:      out.label,
    confidence: out.confidence,
    score:      out.score,
    faceStats: {
      faceDetected:  true,
      eyesDetected:  eng.numEyes,
      faceCentered:  eng.faceCentered,
      earAvg:        parseFloat(eng.earAvg.toFixed(3)),
    },
  };
};

/**
 * @description Resets the 3-frame smoothing history.
 *              Call this when a new session starts so stale state from a
 *              previous session does not bleed into the first few predictions.
 * @returns {void}
 */
export const resetHistory = (): void => {
  scoreHistory = [];
};
