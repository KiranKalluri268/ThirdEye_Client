/**
 * @file EngagementChart.tsx
 * @description Recharts LineChart showing class-average engagement over time.
 *              Instructor can toggle individual student lines by clicking table rows.
 *
 *              Chart anatomy:
 *               - X axis: minutes from session start (0 → session duration)
 *               - Y axis: engagement score 0.0 – 1.0
 *               - Reference lines: label boundaries (very_low/low/high/very_high)
 *               - Always-visible: class average line (thick, accent purple)
 *               - Toggled: per-student lines (thin, from STUDENT_COLORS palette)
 *               - Custom tooltip: shows minute offset + all visible values
 */

import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChartTimeSeries {
  minuteOffset:  number;
  classAvgScore: number;
  studentCount:  number;
}

export interface StudentSeries {
  minuteOffset: number;
  avgScore:     number;
  label:        string;
}

interface EngagementChartProps {
  /** 1-minute bucketed class average data */
  timeSeries:      ChartTimeSeries[];
  /** Map of studentId → their per-minute series (populated lazily on toggle) */
  studentSeries:   Map<string, StudentSeries[]>;
  /** Set of currently selected (visible) student IDs */
  selectedStudents: Set<string>;
  /** Map of studentId → display name (for the legend) */
  studentNames:    Map<string, string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Distinct colors for up to 10 student lines */
const STUDENT_COLORS = [
  '#ff6b6b', '#ffa502', '#2ed573', '#1e90ff',
  '#ff4757', '#eccc68', '#7bed9f', '#70a1ff',
  '#ff6348', '#a29bfe',
];

/** Y-axis reference lines mark the label boundaries */
const REFERENCE_LINES = [
  { y: 0.20, label: 'Low',       color: 'rgba(255,71,87,0.45)' },
  { y: 0.42, label: 'High',      color: 'rgba(255,165,2,0.45)' },
  { y: 0.65, label: 'Very High', color: 'rgba(46,213,115,0.45)' },
];

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

/**
 * @description Custom recharts tooltip component.
 *              Shows minute offset and all active line values at the hovered point.
 */
const CustomTooltip: React.FC<{
  active?:  boolean;
  payload?: { name: string; value: number; color: string }[];
  label?:   number;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background:   'var(--bg-elevated)',
        border:       '1px solid var(--border)',
        borderRadius: 10,
        padding:      '10px 14px',
        fontSize:     12,
        minWidth:     160,
      }}
    >
      <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
        {label} min into session
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: entry.color, flexShrink: 0,
            }}
          />
          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{entry.name}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {(entry.value * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @description Merges classAvgScore series and selected student series into a
 *              single array that recharts can render as multiple lines.
 *
 * @param timeSeries       - Class-level time series
 * @param studentSeries    - Per-student time series map (lazy-loaded)
 * @param selectedStudents - IDs of students whose lines should be shown
 * @param studentNames     - Display names for legend
 */
const EngagementChart: React.FC<EngagementChartProps> = ({
  timeSeries,
  studentSeries,
  selectedStudents,
  studentNames,
}) => {
  /**
   * @description Builds a merged dataset keyed by minuteOffset.
   *              Each row contains classAvgScore plus one key per selected student.
   *              Missing student minutes get a null value so recharts handles gaps.
   */
  const chartData = useMemo(() => {
    // Collect all minute offsets present in any visible series
    const offsetSet = new Set<number>(timeSeries.map((p) => p.minuteOffset));
    selectedStudents.forEach((sid) => {
      studentSeries.get(sid)?.forEach((p) => offsetSet.add(p.minuteOffset));
    });
    const offsets = Array.from(offsetSet).sort((a, b) => a - b);

    // Build index for each series
    const classIndex = new Map(timeSeries.map((p) => [p.minuteOffset, p.classAvgScore]));
    const studentIndexes = new Map<string, Map<number, number>>();
    selectedStudents.forEach((sid) => {
      const series = studentSeries.get(sid);
      if (series) {
        studentIndexes.set(sid, new Map(series.map((p) => [p.minuteOffset, p.avgScore])));
      }
    });

    return offsets.map((offset) => {
      const row: Record<string, number | null> = {
        minuteOffset:  offset,
        classAvgScore: classIndex.get(offset) ?? null,
      };
      selectedStudents.forEach((sid) => {
        row[`student_${sid}`] = studentIndexes.get(sid)?.get(offset) ?? null;
      });
      return row;
    });
  }, [timeSeries, studentSeries, selectedStudents]);

  const selectedArray = Array.from(selectedStudents);

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 24, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 4"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />

          <XAxis
            dataKey="minuteOffset"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(v) => `${v}m`}
            label={{
              value: 'Time into session',
              position: 'insideBottomRight',
              offset: -10,
              style: { fill: 'var(--text-muted)', fontSize: 10 },
            }}
          />

          <YAxis
            domain={[0, 1]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            width={44}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}
          />

          {/* Reference lines — label boundaries */}
          {REFERENCE_LINES.map((rl) => (
            <ReferenceLine
              key={rl.y}
              y={rl.y}
              stroke={rl.color}
              strokeDasharray="5 4"
              label={{
                value: rl.label,
                position: 'insideTopRight',
                style: { fill: rl.color, fontSize: 10, fontWeight: 600 },
              }}
            />
          ))}

          {/* Class average — always shown, thick accent purple */}
          <Line
            type="monotone"
            dataKey="classAvgScore"
            name="Class Avg"
            stroke="#7c6fff"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, fill: '#7c6fff' }}
            connectNulls={true}
          />

          {/* Per-student lines — toggled by table row clicks */}
          {selectedArray.map((sid, idx) => (
            <Line
              key={sid}
              type="monotone"
              dataKey={`student_${sid}`}
              name={studentNames.get(sid) ?? `Student ${idx + 1}`}
              stroke={STUDENT_COLORS[idx % STUDENT_COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
              strokeDasharray="6 2"
              connectNulls={true}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EngagementChart;
