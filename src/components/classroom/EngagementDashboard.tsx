/**
 * @file EngagementDashboard.tsx
 * @description Instructor-only engagement monitoring panel shown between the
 *              video grid and the control bar.
 *
 *              Displays:
 *              1. Live count strip — how many students are at each level right now
 *              2. Class average label — computed from weighted peer scores
 *              3. Time-series sparkline — engagement score trend over the session
 *
 *              The sparkline stores up to 20 data points (one per ~3-second emission
 *              cycle, i.e. ~1 minute of history visible at any time).
 *              Data is stored in component state and never sent to the server.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { EngagementLabel, IEngagementDataPoint } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ENGAGEMENT_COLORS: Record<EngagementLabel, string> = {
  very_high: '#2ed573',
  high:      '#7bed9f',
  low:       '#ffa502',
  very_low:  '#ff4757',
};

/** Numeric weight for computing a continuous class average score */
const ENGAGEMENT_SCORE: Record<EngagementLabel, number> = {
  very_high: 0.85,
  high:      0.60,
  low:       0.35,
  very_low:  0.10,
};

/** Maximum number of time-series data points kept in memory */
const MAX_HISTORY = 20;

// ── Props ─────────────────────────────────────────────────────────────────────

interface EngagementDashboardProps {
  /** Live map of socket ID → engagement label, updated every ~3 seconds */
  peerEngagementMap: Map<string, EngagementLabel>;
  /** Total number of remote peers in the room */
  totalPeers:        number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * @description Counts how many peers are at each engagement level.
 * @param map - Map of socketId → EngagementLabel
 * @returns {Record<EngagementLabel, number>} Count per label
 */
const countPerLabel = (map: Map<string, EngagementLabel>) => {
  const counts: Record<EngagementLabel, number> = { very_high: 0, high: 0, low: 0, very_low: 0 };
  map.forEach((label) => { counts[label]++; });
  return counts;
};

/**
 * @description Computes the weighted average engagement score and maps it to a label.
 * @param map - Map of socketId → EngagementLabel
 * @returns {{ avgScore: number; avgLabel: EngagementLabel }} Weighted average
 */
const computeAverage = (map: Map<string, EngagementLabel>): { avgScore: number; avgLabel: EngagementLabel } => {
  if (map.size === 0) return { avgScore: 0, avgLabel: 'low' };
  let total = 0;
  map.forEach((label) => { total += ENGAGEMENT_SCORE[label]; });
  const avgScore = total / map.size;

  let avgLabel: EngagementLabel;
  if      (avgScore >= 0.72) avgLabel = 'very_high';
  else if (avgScore >= 0.47) avgLabel = 'high';
  else if (avgScore >= 0.22) avgLabel = 'low';
  else                       avgLabel = 'very_low';

  return { avgScore, avgLabel };
};

// ── Sparkline Canvas ──────────────────────────────────────────────────────────

interface SparklineProps {
  /** Array of data points to plot */
  data:   IEngagementDataPoint[];
  /** Canvas width in pixels */
  width:  number;
  /** Canvas height in pixels */
  height: number;
}

/**
 * @description Renders a smooth SVG sparkline of the class engagement score over time.
 *              Uses cubic bezier curves for a polished look.
 * @param data   - Array of IEngagementDataPoint objects
 * @param width  - Chart width in CSS pixels
 * @param height - Chart height in CSS pixels
 * @returns {JSX.Element} An SVG sparkline chart
 */
const Sparkline: React.FC<SparklineProps> = ({ data, width, height }) => {
  if (data.length < 2) {
    return (
      <div
        style={{
          width, height,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Collecting data…
        </span>
      </div>
    );
  }

  const pad    = 6;
  const w      = width  - pad * 2;
  const h      = height - pad * 2;
  const minY   = 0;
  const maxY   = 1;

  /**
   * @description Maps a data point to SVG coordinates.
   * @param idx   - Index in the data array
   * @param score - Engagement score (0.0 – 1.0)
   * @returns {{ x: number; y: number }} SVG coordinate pair
   */
  const toSVG = (idx: number, score: number) => ({
    x: pad + (idx / (data.length - 1)) * w,
    y: pad + h - ((score - minY) / (maxY - minY)) * h,
  });

  // Build smooth cubic bezier path
  const points = data.map((d, i) => toSVG(i, d.score));
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX  = (prev.x + curr.x) / 2;
    pathD += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }

  // Fill area under curve
  const first = points[0];
  const last  = points[points.length - 1];
  const fillD = `${pathD} L ${last.x} ${height} L ${first.x} ${height} Z`;

  // Color the line by the latest label
  const latestLabel = data[data.length - 1].label;
  const lineColor   = ENGAGEMENT_COLORS[latestLabel];

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
      aria-label="Class engagement trend sparkline"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Horizontal guide lines */}
      {[0.25, 0.5, 0.75].map((level) => {
        const y = pad + h - level * h;
        return (
          <line
            key={level}
            x1={pad} y1={y} x2={pad + w} y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        );
      })}

      {/* Area fill */}
      <path d={fillD} fill="url(#sparkGrad)" />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Latest value dot */}
      <circle
        cx={last.x}
        cy={last.y}
        r={4}
        fill={lineColor}
        stroke="var(--bg-surface)"
        strokeWidth={2}
      />
    </svg>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @description Instructor-only engagement monitoring panel.
 *              Shows live counts per label, class average, and a time-series sparkline.
 *              Appends a new data point to the history every time peerEngagementMap changes.
 * @param peerEngagementMap - Live map of peer engagement labels from socket events
 * @param totalPeers        - Total remote peers in the room (for "N of M" display)
 */
const EngagementDashboard: React.FC<EngagementDashboardProps> = ({
  peerEngagementMap,
  totalPeers,
}) => {
  const [history, setHistory] = useState<IEngagementDataPoint[]>([]);

  /**
   * @description Appends a new snapshot to the sparkline history whenever the
   *              peer engagement map changes (i.e. a new peer-engagement socket
   *              event was received). Capped at MAX_HISTORY points.
   */
  useEffect(() => {
    if (peerEngagementMap.size === 0) return;

    const counts = countPerLabel(peerEngagementMap);
    const { avgScore, avgLabel } = computeAverage(peerEngagementMap);

    const point: IEngagementDataPoint = {
      timestamp: Date.now(),
      label:     avgLabel,
      score:     parseFloat(avgScore.toFixed(3)),
      counts,
    };

    setHistory((prev) => {
      const updated = [...prev, point];
      return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
    });
  }, [peerEngagementMap]);

  if (peerEngagementMap.size === 0) return null;

  const counts              = countPerLabel(peerEngagementMap);
  const { avgScore, avgLabel } = computeAverage(peerEngagementMap);
  const trackingCount       = peerEngagementMap.size;

  return (
    <div
      className="scrollbar-hide"
      style={{
        background:      'var(--bg-surface)',
        borderTop:       '1px solid var(--border)',
        flexShrink:      0,
        overflowX:       'auto',
      }}
    >
      <div
        style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         '10px 20px',
          minWidth:        'max-content',
          width:           'fit-content',
          margin:          '0 auto',
          gap:             20,
        }}
      >
      {/* Left: label counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span
          style={{
            fontSize:   11,
            fontWeight: 600,
            color:      'var(--text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Class ({trackingCount}/{totalPeers})
        </span>

        {(
          [
            ['very_high', 'Very High'],
            ['high',      'High'],
            ['low',       'Low'],
            ['very_low',  'Very Low'],
          ] as [EngagementLabel, string][]
        ).map(([label, text]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width:        8,
                height:       8,
                borderRadius: '50%',
                background:   ENGAGEMENT_COLORS[label],
                display:      'inline-block',
                flexShrink:   0,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {text}:
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, minWidth: 16 }}>
              {counts[label]}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />

      {/* Average badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg</span>
        <span
          style={{
            fontSize:     12,
            fontWeight:   700,
            color:        ENGAGEMENT_COLORS[avgLabel],
            background:   'rgba(0,0,0,0.3)',
            padding:      '2px 10px',
            borderRadius: 20,
            border:       `1px solid ${ENGAGEMENT_COLORS[avgLabel]}44`,
          }}
        >
          {avgLabel.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          ({(avgScore * 100).toFixed(0)}%)
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />

      {/* Sparkline */}
      <div style={{ flex: 1, minWidth: 120, maxWidth: 320 }}>
        <SparklineWrapper history={history} />
      </div>

      {/* History label */}
      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
        Last {Math.round((history.length * 3) / 60 * 10) / 10}m
      </span>
      </div>
    </div>
  );
};

// ── Responsive Sparkline Wrapper ──────────────────────────────────────────────

/**
 * @description Measures the container width and renders Sparkline at the correct size.
 * @param history - Array of IEngagementDataPoint objects
 * @returns {JSX.Element}
 */
const SparklineWrapper: React.FC<{ history: IEngagementDataPoint[] }> = ({ history }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(180);

  const measure = useCallback(() => {
    if (containerRef.current) setWidth(containerRef.current.offsetWidth);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <Sparkline data={history} width={width} height={40} />
    </div>
  );
};

export default EngagementDashboard;
