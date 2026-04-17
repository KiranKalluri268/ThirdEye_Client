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


// ── Smoothing history ─────────────────────────────────────────────────────────

const HISTORY_LEN = 3;

/**
 * @description Per-component rolling buffers (3 frames each).
 *              Smoothing is applied to each component independently before
 *              the AND-gate rules are evaluated, avoiding label jitter from
 *              single noisy frames. Composite score is kept for display only.
 */
const eyeBuf:  number[] = [];
const gazeBuf: number[] = [];
const headBuf: number[] = [];
const centBuf: number[] = [];
const sizeBuf: number[] = [];

/** Pushes a value into a rolling buffer of length HISTORY_LEN. */
const pushBuf = (buf: number[], val: number): number => {
  buf.push(val);
  if (buf.length > HISTORY_LEN) buf.shift();
  return buf.reduce((a, b) => a + b, 0) / buf.length;
};

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



// ── Eye Aspect Ratio ──────────────────────────────────────────────────────────

/**
 * @description Computes the Eye Aspect Ratio (EAR) for one eye.
 *              EAR < EAR_CLOSED → eyes shut; EAR > EAR_OPEN → eyes open.
 *
 *              IMPORTANT: landmarks must be converted to PIXEL coordinates
 *              before computing distances. MediaPipe returns normalized [0,1]
 *              values where x uses image width and y uses image height as scale.
 *              For a 16:9 image, 1 unit of x ≠ 1 unit of y, so computing
 *              Euclidean distance in normalized space gives wrong EAR values
 *              (they'd be ~1.78× too high for 1280×720). This matches exactly
 *              how inference.py does it: pts = [lm[i].x * iw, lm[i].y * ih].
 *
 * @param landmarks  - Full landmark array (normalized 0–1)
 * @param indices    - 6 landmark indices [p1..p6] for the eye
 * @param videoWidth - Actual pixel width of the video element
 * @param videoHeight - Actual pixel height of the video element
 * @returns {number} EAR value (larger = more open; calibrated thresholds are in pixel space)
 */
const earValue = (
  landmarks:   Landmark[],
  indices:     readonly number[],
  videoWidth:  number,
  videoHeight: number,
): number => {
  try {
    // Convert to pixel coordinates — matches inference.py exactly
    const pts = indices.map((i) => [
      landmarks[i].x * videoWidth,
      landmarks[i].y * videoHeight,
    ] as [number, number]);
    const v1 = norm2d(pts[1], pts[5]);
    const v2 = norm2d(pts[2], pts[4]);
    const h  = norm2d(pts[0], pts[3]);
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
  // Individual component scores for debug overlay
  eyeScore:  number;
  gazeScore: number;
  headScore: number;
  centScore: number;
  sizeScore: number;
}

/**
 * @description Core engagement scorer. Computes raw (unsmoothed) engagement
 *              from pixel-space facial geometry.
 *              Weights: eyes 40%, gaze 22%, head yaw 15%, face centre 13%,
 *              face size 7%, base 3%. Matches inference.py compute_engagement().
 * @param landmarks   - 478 MediaPipe FaceLandmarker landmarks (normalized 0–1)
 * @param videoWidth  - Pixel width of the video element (for EAR)
 * @param videoHeight - Pixel height of the video element (for EAR)
 * @returns {RawEngagement} Raw score, ceiling, and face stats
 */
const computeEngagement = (
  landmarks:   Landmark[],
  videoWidth:  number,
  videoHeight: number,
): RawEngagement => {
  // ── EAR — primary gate (computed in pixel space) ─────────────────────────
  const earL   = earValue(landmarks, LEFT_EYE,  videoWidth, videoHeight);
  const earR   = earValue(landmarks, RIGHT_EYE, videoWidth, videoHeight);
  const earAvg = (earL + earR) / 2.0;

  let eyeScore: number;
  let maxScore: number;
  let numEyes:  number;

  if (earAvg < EAR_CLOSED) {
    // Eyes fully closed — hard Very Low gate
    return { score: 0.05, maxScore: 0.20, numEyes: 0, faceCentered: true, earAvg,
             eyeScore: 0, gazeScore: 0.55, headScore: 0.7, centScore: 0.5, sizeScore: 0.4 };
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
    eyeScore:  parseFloat(eyeScore.toFixed(3)),
    gazeScore: parseFloat(gazeScore.toFixed(3)),
    headScore: parseFloat(headScore.toFixed(3)),
    centScore: parseFloat(centScore.toFixed(3)),
    sizeScore: parseFloat(sizeScore.toFixed(3)),
  };
};

// ── AND-gate Rule Engine ─────────────────────────────────────────────────────

/**
 * @description Classifies engagement using top-down AND-gate rules applied to
 *              3-frame rolling averages of each component score.
 *
 *              Rules (evaluated in order — first match wins):
 *
 *              Very High : eye > 0.70 && gaze > 0.70 && head > 0.50
 *                          && cent > 0.70 && size > 0.30
 *              High      : eye > 0.40 && head > 0.30 && cent > 0.30
 *              Low       : eye > 0.05 && head > 0.10 && cent > 0.05
 *              Very Low  : catch-all (face missing, eyes closed, looking away)
 *
 *              The composite score is still computed from the weighted formula
 *              and returned for display in the debug overlay bar — it does NOT
 *              determine the label anymore.
 *
 * @param eye  - Rolled eyeScore  (0–1)
 * @param gaze - Rolled gazeScore (0–1)
 * @param head - Rolled headScore (0–1)
 * @param cent - Rolled centScore (0–1)
 * @param size - Rolled sizeScore (0–1)
 * @param compositeScore - Weighted composite (for debug bar display only)
 * @returns {{ label, confidence, score }}
 */
const ruleBasedLabel = (
  eye:  number,
  gaze: number,
  head: number,
  cent: number,
  size: number,
  compositeScore: number,
): { label: EngagementLabel; confidence: number; score: number } => {
  let label:      EngagementLabel;
  let confidence: number;

  if (eye > 0.80 && gaze > 0.70 && head > 0.50 && cent > 0.70 && size > 0.30) {
    label      = 'very_high';
    // Confidence = how far all conditions exceed their thresholds (min margin)
    confidence = parseFloat(Math.min(
      (eye  - 0.80) / 0.30,
      (gaze - 0.70) / 0.30,
      (head - 0.50) / 0.50,
      (cent - 0.70) / 0.30,
      (size - 0.30) / 0.70,
    ).toFixed(4));
    confidence = Math.min(0.95, 0.70 + confidence * 0.25);

  } else if (eye > 0.50 && head > 0.30 && cent > 0.30) {
    label      = 'high';
    confidence = parseFloat(Math.min(
      (eye  - 0.50) / 0.30,
      (head - 0.30) / 0.20,
      (cent - 0.30) / 0.40,
    ).toFixed(4));
    confidence = Math.min(0.85, 0.60 + confidence * 0.25);

  } else if (eye > 0.05 && head > 0.10 && cent > 0.05) {
    label      = 'low';
    confidence = parseFloat(Math.min(
      (eye  - 0.05) / 0.35,
      (head - 0.10) / 0.20,
      (cent - 0.05) / 0.25,
    ).toFixed(4));
    confidence = Math.min(0.80, 0.55 + confidence * 0.25);

  } else {
    label      = 'very_low';
    confidence = 0.90;
  }

  return {
    label,
    confidence,
    score: parseFloat(compositeScore.toFixed(3)),
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @description Main inference function. Call with the first element of
 *              MediaPipe FaceLandmarker's `faceLandmarks` array and the actual
 *              pixel dimensions of the video element.
 *
 *              Video dimensions are required to compute EAR in pixel space,
 *              matching the Python inference.py implementation exactly.
 *              If no face is detected (landmarks is null), returns very_low.
 *
 * @param landmarks   - Array of 478 {x, y, z} landmark objects, or null
 * @param videoWidth  - Pixel width  of the video element (from videoEl.videoWidth)
 * @param videoHeight - Pixel height of the video element (from videoEl.videoHeight)
 * @returns {IEngagementResult} Engagement label, confidence, and face stats
 */
export const predictFromLandmarks = (
  landmarks:   Landmark[] | null,
  videoWidth:  number = 640,
  videoHeight: number = 480,
): IEngagementResult => {
  // ── No face detected ──────────────────────────────────────────────────────
  if (!landmarks || landmarks.length === 0) {
    // Push zeros into all buffers so they drain toward 0 across frames
    pushBuf(eyeBuf,  0);
    pushBuf(gazeBuf, 0);
    pushBuf(headBuf, 0);
    pushBuf(centBuf, 0);
    pushBuf(sizeBuf, 0);
    return {
      label:      'very_low',
      confidence: 0.90,
      score:      0.05,
      faceStats:  { faceDetected: false, eyesDetected: 0, faceCentered: false, earAvg: 0 },
    };
  }

  // ── Compute component scores ───────────────────────────────────────────────
  const eng = computeEngagement(landmarks, videoWidth, videoHeight);

  // Roll each component score independently
  const rEye  = pushBuf(eyeBuf,  eng.eyeScore);
  const rGaze = pushBuf(gazeBuf, eng.gazeScore);
  const rHead = pushBuf(headBuf, eng.headScore);
  const rCent = pushBuf(centBuf, eng.centScore);
  const rSize = pushBuf(sizeBuf, eng.sizeScore);

  // Composite score (weighted formula) — used for debug bar display only
  const composite = Math.min(
    eng.maxScore,
    0.40 * rEye + 0.22 * rGaze + 0.15 * rHead + 0.13 * rCent + 0.07 * rSize + 0.03,
  );

  // Apply AND-gate rules to rolled averages
  const out = ruleBasedLabel(rEye, rGaze, rHead, rCent, rSize, composite);

  return {
    label:      out.label,
    confidence: out.confidence,
    score:      out.score,
    faceStats: {
      faceDetected:  true,
      eyesDetected:  eng.numEyes,
      faceCentered:  eng.faceCentered,
      earAvg:        parseFloat(eng.earAvg.toFixed(3)),
      eyeScore:      eng.eyeScore,
      gazeScore:     eng.gazeScore,
      headScore:     eng.headScore,
      centScore:     eng.centScore,
      sizeScore:     eng.sizeScore,
    },
  };
};

/**
 * @description Resets all 5 per-component smoothing buffers.
 *              Call this when a new session starts so stale state from a
 *              previous session does not bleed into the first few predictions.
 * @returns {void}
 */
export const resetHistory = (): void => {
  eyeBuf.length  = 0;
  gazeBuf.length = 0;
  headBuf.length = 0;
  centBuf.length = 0;
  sizeBuf.length = 0;
};
