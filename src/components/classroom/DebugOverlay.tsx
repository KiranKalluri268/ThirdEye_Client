/**
 * @file DebugOverlay.tsx
 * @description Hands-free live debug panel for the engagement inference engine.
 *
 *              Toggles with the backtick key (`) — no mouse needed.
 *              Shows all raw variable values from MediaPipe + engagementInference.ts
 *              updating in real-time as the model runs.
 *
 *              Displayed only to students (parent guards with !isInstructor).
 *              Intended for development / model accuracy verification.
 *
 *              Layout:
 *               ┌── Top bar: label badge + composite score + confidence ──┐
 *               │── Component scores (weighted bars) ──────────────────── │
 *               │   Eye    ████████░░░░ 0.72  (×0.40 → 0.288)            │
 *               │   Gaze   ██████░░░░░░ 0.61  (×0.22 → 0.134)            │
 *               │   Head   █████████░░░ 0.83  (×0.15 → 0.125)            │
 *               │   Center ████░░░░░░░░ 0.44  (×0.13 → 0.057)            │
 *               │   Size   ███░░░░░░░░░ 0.31  (×0.07 → 0.022)            │
 *               │── Face stats ─────────────────────────────────────────  │
 *               │   Face detected · Eyes: 2 · Centered · EAR: 0.224      │
 *               └── Footer: ` to close ──────────────────────────────────┘
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { IEngagementResult, EngagementLabel } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DebugOverlayProps {
  /** Latest result from useEngagement — updates on every label change */
  engagementResult: IEngagementResult | null;
  /** Whether MediaPipe has loaded and is running */
  isInferring: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LABEL_COLOR: Record<EngagementLabel, string> = {
  very_high: '#2ed573',
  high:      '#7bed9f',
  low:       '#ffa502',
  very_low:  '#ff4757',
};

const LABEL_TEXT: Record<EngagementLabel, string> = {
  very_high: 'Very High',
  high:      'High',
  low:       'Low',
  very_low:  'Very Low',
};

/**
 * AND-gate thresholds per label level for each component.
 * Mirrors ruleBasedLabel() in engagementInference.ts exactly.
 */
const THRESHOLDS = {
  very_high: { eyeScore: 0.80, gazeScore: 0.70, headScore: 0.50, centScore: 0.70, sizeScore: 0.30 },
  high:      { eyeScore: 0.50, gazeScore: null,  headScore: 0.30, centScore: 0.30, sizeScore: null  },
  low:       { eyeScore: 0.05, gazeScore: null,  headScore: 0.10, centScore: 0.05, sizeScore: null  },
} as const;

/** Component score definitions — weight and display name */
const COMPONENTS = [
  { key: 'eyeScore'  as const, label: 'Eye (EAR)',   color: '#7c6fff' },
  { key: 'gazeScore' as const, label: 'Gaze (Iris)', color: '#1e90ff' },
  { key: 'headScore' as const, label: 'Head (Yaw)',  color: '#2ed573' },
  { key: 'centScore' as const, label: 'Face Center', color: '#ffa502' },
  { key: 'sizeScore' as const, label: 'Face Size',   color: '#ff6b81' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * @description Renders a single labeled score bar.
 * @param label      - Row label text
 * @param score      - Raw component score (0.0–1.0)
 * @param weight     - Weight of this component in the final score
 * @param color      - Bar fill color
 */
const ScoreBar: React.FC<{
  label:    string;
  score:    number;
  color:    string;
  scoreKey: keyof typeof THRESHOLDS.very_high;
}> = ({ label, score, color, scoreKey }) => {
  const pct = Math.round(score * 100);

  // Determine which tiers this component is required for and whether it passes
  const vhThresh = THRESHOLDS.very_high[scoreKey];
  const hiThresh = THRESHOLDS.high[scoreKey];
  const loThresh = THRESHOLDS.low[scoreKey];

  const passes = (t: number | null) => t !== null && score > t;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Label + pass/fail chips */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Threshold pills — VH / HI / LO */}
          {(
            [
              { tag: 'VH', thresh: vhThresh, pass: passes(vhThresh) },
              { tag: 'HI', thresh: hiThresh, pass: passes(hiThresh) },
              { tag: 'LO', thresh: loThresh, pass: passes(loThresh) },
            ] as { tag: string; thresh: number | null; pass: boolean }[]
          ).filter(t => t.thresh !== null).map(({ tag, thresh, pass }) => (
            <span
              key={tag}
              title={`Need > ${Math.round((thresh ?? 0) * 100)}%`}
              style={{
                fontSize:     9,
                fontWeight:   700,
                padding:      '1px 5px',
                borderRadius: 4,
                background:   pass ? 'rgba(46,213,115,0.18)' : 'rgba(255,71,87,0.15)',
                color:        pass ? '#2ed573'               : '#ff4757',
                border:       `1px solid ${pass ? '#2ed57344' : '#ff475744'}`,
                fontFamily:   'monospace',
              }}
            >
              {tag} {pass ? '✓' : `>${Math.round((thresh ?? 0) * 100)}%`}
            </span>
          ))}
          {/* Score value */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace', marginLeft: 2 }}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Track + fill */}
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
        {/* Threshold tick marks */}
        {[vhThresh, hiThresh, loThresh].filter((t): t is NonNullable<typeof t> => t !== null).map((t, i) => (
          <div
            key={i}
            style={{
              position:   'absolute',
              left:       `${t * 100}%`,
              top:        0,
              height:     '100%',
              width:      1,
              background: 'rgba(255,255,255,0.30)',
            }}
          />
        ))}
        <div
          style={{
            height:       '100%',
            width:        `${pct}%`,
            background:   color,
            borderRadius: 3,
            transition:   'width 0.15s ease',
            boxShadow:    `0 0 4px ${color}88`,
          }}
        />
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @description Live engagement model debug overlay.
 *              Toggle visibility with backtick (`) key — no mouse required.
 * @param engagementResult - Latest IEngagementResult from useEngagement
 * @param isInferring      - Whether MediaPipe is loaded and running
 */
const DebugOverlay: React.FC<DebugOverlayProps> = ({ engagementResult, isInferring }) => {
  const [visible, setVisible] = useState(false);

  /**
   * @description Listens for backtick keydown to toggle the overlay.
   *              Ignored when a text input/textarea has focus (don't interfere with chat).
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== '`') return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    setVisible((v) => !v);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!visible) return null;

  const r  = engagementResult;
  const fs = r?.faceStats;

  return (
    <div
      id="engagement-debug-overlay"
      style={{
        position:     'fixed',
        bottom:       80,   // above the control bar
        left:         16,
        width:        320,
        background:   'rgba(10, 10, 20, 0.92)',
        backdropFilter: 'blur(12px)',
        border:       '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        padding:      '14px 16px',
        zIndex:       9999,
        fontFamily:   'monospace',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
        userSelect:   'none',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   12,
          paddingBottom:  10,
          borderBottom:   '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
            ENGAGEMENT DEBUG
          </span>
          {isInferring ? (
            <span
              style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   '#2ed573',
                display:      'inline-block',
                boxShadow:    '0 0 6px #2ed573',
                animation:    'pulse 1.5s infinite',
              }}
            />
          ) : (
            <span style={{ fontSize: 10, color: '#ff4757' }}>OFFLINE</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>` to close</span>
      </div>

      {!r ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          Waiting for inference…
        </div>
      ) : (
        <>
          {/* ── Composite Score ─────────────────────────────────────────────── */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              marginBottom:   14,
            }}
          >
            {/* Label badge */}
            <div
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          8,
              }}
            >
              <span
                style={{
                  background:   `${LABEL_COLOR[r.label]}22`,
                  color:        LABEL_COLOR[r.label],
                  border:       `1px solid ${LABEL_COLOR[r.label]}55`,
                  borderRadius: 8,
                  padding:      '4px 12px',
                  fontSize:     13,
                  fontWeight:   700,
                }}
              >
                {LABEL_TEXT[r.label]}
              </span>
            </div>

            {/* Score + confidence */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: LABEL_COLOR[r.label], lineHeight: 1 }}>
                {(r.score * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                conf {(r.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* ── Composite bar ──────────────────────────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                height:       10,
                borderRadius: 6,
                background:   'rgba(255,255,255,0.08)',
                overflow:     'hidden',
              }}
            >
              <div
                style={{
                  height:     '100%',
                  width:      `${r.score * 100}%`,
                  background: `linear-gradient(90deg, ${LABEL_COLOR[r.label]}99, ${LABEL_COLOR[r.label]})`,
                  borderRadius: 6,
                  transition:  'width 0.2s ease',
                  boxShadow:   `0 0 8px ${LABEL_COLOR[r.label]}66`,
                }}
              />
            </div>
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                marginTop:      3,
                fontSize:       9,
                color:          'rgba(255,255,255,0.25)',
              }}
            >
              <span>0</span>
              <span>very_low</span>
              <span>low</span>
              <span>high</span>
              <span>very_high</span>
            </div>
          </div>

          {/* ── Divider ────────────────────────────────────────────────────── */}
          <div
            style={{
              fontSize:     10,
              color:        'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em',
              marginBottom:  8,
            }}
          >
            COMPONENT SCORES
          </div>

          {/* ── Component bars ─────────────────────────────────────────────── */}
          {COMPONENTS.map((c) => (
            <ScoreBar
              key={c.key}
              label={c.label}
              score={fs?.[c.key] ?? 0}
              color={c.color}
              scoreKey={c.key}
            />
          ))}

          {/* ── Divider ────────────────────────────────────────────────────── */}
          <div
            style={{
              borderTop:     '1px solid rgba(255,255,255,0.08)',
              marginTop:     10,
              paddingTop:    10,
              fontSize:      10,
              color:        'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em',
              marginBottom:  8,
            }}
          >
            FACE STATS
          </div>

          {/* ── Face stats grid ─────────────────────────────────────────────── */}
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: '1fr 1fr',
              gap:                 '5px 12px',
            }}
          >
            {[
              { label: 'Face',       value: fs?.faceDetected ? '✅ Detected' : '❌ Missing' },
              { label: 'Eyes open',  value: `${fs?.eyesDetected ?? 0} / 2` },
              { label: 'Centered',   value: fs?.faceCentered ? '✅ Yes'      : '❌ No' },
              { label: 'EAR avg',    value: fs?.earAvg?.toFixed(3) ?? '—' },
              {
                label: 'isDistracted',
                value: fs?.headScore !== undefined
                  ? (fs.headScore < 0.50 ? '⚠️ Yes' : '✅ No')
                  : '—',
                color: fs?.headScore !== undefined
                  ? (fs.headScore < 0.50 ? '#ff4757' : '#2ed573')
                  : undefined,
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{label}</div>
                <div style={{ fontSize: 12, color: color ?? 'rgba(255,255,255,0.75)', marginTop: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── Rule legend ────────────────────────────────────────────────── */}
          <div
            style={{
              marginTop:    10,
              padding:      '8px 10px',
              background:   'rgba(255,255,255,0.04)',
              borderRadius: 8,
              fontSize:     10,
              color:        'rgba(255,255,255,0.35)',
              lineHeight:   1.8,
              fontFamily:   'monospace',
            }}
          >
            <div style={{ color: '#2ed573', marginBottom: 2 }}>VH: Eye&gt;70 Gaze&gt;70 Head&gt;50 Cent&gt;70 Size&gt;30</div>
            <div style={{ color: '#7bed9f', marginBottom: 2 }}>HI: Eye&gt;40 Head&gt;30 Cent&gt;30</div>
            <div style={{ color: '#ffa502', marginBottom: 2 }}>LO: Eye&gt;5  Head&gt;10 Cent&gt;5</div>
            <div style={{ color: '#ff4757' }}>VL: else (face missing / eyes closed)</div>
          </div>
        </>
      )}
    </div>
  );
};

export default DebugOverlay;
