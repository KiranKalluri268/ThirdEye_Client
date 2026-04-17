/**
 * @file EngagementHeatmap.tsx
 * @description Student × minute engagement heatmap for the SessionAnalytics page.
 *              Instructor-only view.
 *
 *              Fetches GET /api/sessions/:sessionId/analytics/heatmap on mount.
 *              Renders a CSS grid where:
 *               - Each row = one student
 *               - Each column = one 1-minute bucket from the session
 *               - Each cell = colored by the dominant engagement label for that bucket
 *               - Null cells (no data) = dark neutral with dashed border
 *
 *              Hover tooltip shows: "Student Name — +Nm: Label (Score%)"
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeatmapCell {
  /** ISO minute string, e.g. "2026-04-06T09:03:00.000Z" */
  minute: string;
  /** Weighted average confidence score for this student×minute bucket */
  score:  number;
  /** Dominant engagement label for this bucket */
  label:  'very_low' | 'low' | 'high' | 'very_high';
}

interface HeatmapRow {
  userId: string;
  name:   string;
  /** Only minutes where this student has records — sparse */
  cells:  HeatmapCell[];
}

interface HeatmapData {
  /** All minute keys that appear across all students (sorted ascending) */
  minutes: string[];
  /** One row per student */
  rows:    HeatmapRow[];
}

interface TooltipState {
  visible:  boolean;
  text:     string;
  x:        number;
  y:        number;
}

export interface EngagementHeatmapProps {
  /** MongoDB ObjectId of the session */
  sessionId: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cell colors — match VideoTile badge and EngagementDashboard */
const CELL_COLOR: Record<string, string> = {
  very_high: '#2ed573',
  high:      '#7bed9f',
  low:       '#ffa502',
  very_low:  '#ff4757',
};

const LABEL_TEXT: Record<string, string> = {
  very_high: 'Very High',
  high:      'High',
  low:       'Low',
  very_low:  'Very Low',
};

/** Width of each minute cell in pixels */
const CELL_W = 20;
/** Height of each cell row in pixels */
const CELL_H = 28;
/** Width of the student name column */
const NAME_W = 130;
/** Show a column label every N minutes to avoid crowding */
const LABEL_EVERY = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * @description Converts an ISO minute string to a session-relative minute offset.
 * @param minuteStr - ISO string, e.g. "2026-04-06T09:03:00.000Z"
 * @param firstMin  - ISO string of the first minute in the session
 * @returns {number} Minutes since session start (0-indexed)
 */
const toOffset = (minuteStr: string, firstMin: string): number =>
  Math.round((new Date(minuteStr).getTime() - new Date(firstMin).getTime()) / 60000);

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @description Fetches and renders the student × minute engagement heatmap.
 *              Shown only in the instructor view (parent guards with isInstructor).
 * @param sessionId - MongoDB ObjectId of the session
 */
const EngagementHeatmap: React.FC<EngagementHeatmapProps> = ({ sessionId }) => {
  const [data,    setData]    = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, text: '', x: 0, y: 0 });
  const containerRef          = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get<{ success: boolean } & HeatmapData>(
          `/sessions/${sessionId}/analytics/heatmap`
        );
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) {
          console.error('[EngagementHeatmap] fetch error:', err);
          setError('Failed to load heatmap data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ── Tooltip handlers ───────────────────────────────────────────────────────

  /**
   * @description Shows the hover tooltip for a cell.
   * @param e          - Mouse event
   * @param studentName - Name of the student for this row
   * @param cell        - Cell data (minute, score, label)
   * @param offset      - Minute offset from session start
   */
  const showTooltip = useCallback((
    e:           React.MouseEvent,
    studentName: string,
    cell:        HeatmapCell,
    offset:      number,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      visible: true,
      text:    `${studentName} — +${offset}m: ${LABEL_TEXT[cell.label]} (${(cell.score * 100).toFixed(0)}%)`,
      x:       e.clientX - rect.left + 10,
      y:       e.clientY - rect.top  - 36,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          height:         120,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        {/* Skeleton shimmer */}
        <div
          style={{
            width:        '100%',
            height:       80,
            borderRadius: 10,
            background:   'linear-gradient(90deg, var(--bg-elevated) 25%, rgba(255,255,255,0.05) 50%, var(--bg-elevated) 75%)',
            backgroundSize: '200% 100%',
            animation:    'shimmer 1.4s infinite',
          }}
        />
      </div>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div
        style={{
          textAlign:  'center',
          padding:    '24px 0',
          color:      'var(--text-muted)',
          fontSize:   13,
        }}
      >
        {error ?? 'No heatmap data available.'}
      </div>
    );
  }

  // ── Render: empty ──────────────────────────────────────────────────────────

  if (data.rows.length === 0 || data.minutes.length === 0) {
    return (
      <div
        style={{
          textAlign:  'center',
          padding:    '24px 0',
          color:      'var(--text-muted)',
          fontSize:   13,
        }}
      >
        No engagement data recorded for this session.
      </div>
    );
  }

  const firstMin = data.minutes[0];

  // Build a fast lookup: studentId → { minute → cell }
  const cellMap = new Map<string, Map<string, HeatmapCell>>();
  data.rows.forEach((row) => {
    const m = new Map<string, HeatmapCell>();
    row.cells.forEach((cell) => m.set(cell.minute, cell));
    cellMap.set(row.userId, m);
  });

  // ── Render: heatmap ────────────────────────────────────────────────────────

  const totalW = NAME_W + data.minutes.length * CELL_W;

  return (
    <div ref={containerRef} style={{ position: 'relative', overflowX: 'auto', overflowY: 'visible' }}>

      {/* ── Tooltip ──────────────────────────────────────────────────────────── */}
      {tooltip.visible && (
        <div
          style={{
            position:     'absolute',
            left:         tooltip.x,
            top:          tooltip.y,
            background:   'var(--bg-elevated)',
            border:       '1px solid var(--border)',
            borderRadius: 8,
            padding:      '6px 12px',
            fontSize:     12,
            color:        'var(--text-primary)',
            whiteSpace:   'nowrap',
            pointerEvents: 'none',
            zIndex:       50,
            boxShadow:    '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {tooltip.text}
        </div>
      )}

      <div style={{ minWidth: totalW }}>

        {/* ── Column header: minute offsets ──────────────────────────────────── */}
        <div
          style={{
            display:  'flex',
            marginLeft: NAME_W,
            marginBottom: 4,
          }}
        >
          {data.minutes.map((min) => {
            const offset = toOffset(min, firstMin);
            const show   = offset % LABEL_EVERY === 0;
            return (
              <div
                key={min}
                style={{
                  width:      CELL_W,
                  flexShrink: 0,
                  fontSize:   9,
                  color:      show ? 'var(--text-muted)' : 'transparent',
                  textAlign:  'center',
                  userSelect: 'none',
                }}
              >
                {show ? `+${offset}m` : '·'}
              </div>
            );
          })}
        </div>

        {/* ── Rows ──────────────────────────────────────────────────────────── */}
        {data.rows.map((row) => {
          const rowMap = cellMap.get(row.userId)!;
          return (
            <div key={row.userId} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>

              {/* Student name */}
              <div
                style={{
                  width:        NAME_W,
                  flexShrink:   0,
                  fontSize:     12,
                  fontWeight:   500,
                  color:        'var(--text-secondary)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  paddingRight: 10,
                  textAlign:    'right',
                }}
                title={row.name}
              >
                {row.name}
              </div>

              {/* Cells */}
              {data.minutes.map((min) => {
                const cell   = rowMap.get(min);
                const offset = toOffset(min, firstMin);

                return (
                  <div
                    key={min}
                    onMouseEnter={cell
                      ? (e) => showTooltip(e, row.name, cell, offset)
                      : undefined
                    }
                    onMouseLeave={cell ? hideTooltip : undefined}
                    style={{
                      width:        CELL_W - 2,
                      height:       CELL_H - 4,
                      flexShrink:   0,
                      marginRight:  2,
                      borderRadius: 4,
                      background:   cell
                        ? `${CELL_COLOR[cell.label]}CC`
                        : 'rgba(255,255,255,0.04)',
                      border:       cell
                        ? `1px solid ${CELL_COLOR[cell.label]}55`
                        : '1px dashed rgba(255,255,255,0.08)',
                      cursor:       cell ? 'default' : 'default',
                      transition:   'opacity 0.1s',
                    }}
                    onMouseOver={(e) => {
                      if (cell) (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLDivElement).style.opacity = '1';
                    }}
                  />
                );
              })}
            </div>
          );
        })}

        {/* ── Legend ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        16,
            marginTop:  12,
            marginLeft: NAME_W,
            flexWrap:   'wrap',
          }}
        >
          {(['very_high', 'high', 'low', 'very_low'] as const).map((label) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width:        14,
                  height:       14,
                  borderRadius: 3,
                  background:   `${CELL_COLOR[label]}CC`,
                  border:       `1px solid ${CELL_COLOR[label]}55`,
                  flexShrink:   0,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {LABEL_TEXT[label]}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div
              style={{
                width:        14,
                height:       14,
                borderRadius: 3,
                background:   'rgba(255,255,255,0.04)',
                border:       '1px dashed rgba(255,255,255,0.08)',
                flexShrink:   0,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngagementHeatmap;
