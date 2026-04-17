/**
 * @file KPICards.tsx
 * @description At-a-glance KPI summary cards for the SessionAnalytics page.
 *
 *              Displays four metric cards computed from already-fetched data:
 *               1. Class Average  — weighted avg score across all time-series minutes
 *               2. Peak Minute    — minute offset with the highest class avg score
 *               3. At-Risk Count  — students with avgLabel of 'low' or 'very_low'
 *               4. Data Points    — total EngagementRecord count across all students
 *
 *              No API calls — computed entirely from props already in SessionAnalytics state.
 *              At-Risk and Data Points cards are hidden for students (isInstructor guard
 *              is applied by the parent).
 */

import React, { useMemo } from 'react';
import type { ChartTimeSeries } from './EngagementChart';
import type { StudentSummary }  from './StudentTable';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KPICardsProps {
  /** 1-minute bucketed class average time series (already fetched) */
  timeSeries:    ChartTimeSeries[];
  /** Per-student aggregate summaries (already fetched; empty for students) */
  students:      StudentSummary[];
  /** Whether the current user is an instructor — controls which cards render */
  isInstructor:  boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Map engagement label → display color */
const LABEL_COLOR: Record<string, string> = {
  very_high: '#2ed573',
  high:      '#7bed9f',
  low:       '#ffa502',
  very_low:  '#ff4757',
};

/** Map engagement label → human-readable text */
const LABEL_TEXT: Record<string, string> = {
  very_high: 'Very High',
  high:      'High',
  low:       'Low',
  very_low:  'Very Low',
};

/**
 * @description Maps a numeric weighted-average score to an engagement label.
 *              Uses the same thresholds as EngagementDashboard and analytics.controller.
 * @param score - Weighted score 0.0 – 1.0
 * @returns {string} Engagement label
 */
const scoreToLabel = (score: number): string => {
  if (score >= 0.72) return 'very_high';
  if (score >= 0.47) return 'high';
  if (score >= 0.22) return 'low';
  return 'very_low';
};

// ── Sub-component: Single KPI Card ────────────────────────────────────────────

interface KPICardProps {
  /** Card icon (emoji or symbol) */
  icon:      string;
  /** Card title */
  title:     string;
  /** Large primary value to display */
  value:     string;
  /** Smaller subtitle below the value */
  subtitle:  string;
  /** Left-border accent color */
  accentColor: string;
}

/**
 * @description Renders a single KPI card with glassmorphism styling.
 * @param icon        - Emoji or symbol icon
 * @param title       - Card label
 * @param value       - The big metric number or text
 * @param subtitle    - Supporting detail below the value
 * @param accentColor - CSS color for the left border accent
 */
const KPICard: React.FC<KPICardProps> = ({ icon, title, value, subtitle, accentColor }) => (
  <div
    style={{
      background:   'var(--bg-surface)',
      border:       '1px solid var(--border)',
      borderLeft:   `3px solid ${accentColor}`,
      borderRadius: 14,
      padding:      '18px 20px',
      display:      'flex',
      flexDirection: 'column',
      gap:          6,
      transition:   'box-shadow 0.2s ease',
      cursor:       'default',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLDivElement).style.boxShadow =
        `0 0 0 1px ${accentColor}33, 0 4px 20px rgba(0,0,0,0.25)`;
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
    }}
  >
    {/* Header row: icon + title */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span
        style={{
          fontSize:      11,
          fontWeight:    600,
          color:         'var(--text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
    </div>

    {/* Primary value */}
    <span
      style={{
        fontSize:   26,
        fontWeight: 800,
        color:      accentColor,
        lineHeight: 1.1,
      }}
    >
      {value}
    </span>

    {/* Subtitle */}
    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
      {subtitle}
    </span>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @description Renders a responsive row of 4 KPI summary cards.
 *              At-Risk and Data Points cards are only shown to instructors.
 * @param timeSeries   - Class-level time series data
 * @param students     - Per-student summary array
 * @param isInstructor - Whether the current user is an instructor
 */
const KPICards: React.FC<KPICardsProps> = ({ timeSeries, students, isInstructor }) => {
  const kpis = useMemo(() => {
    // ── KPI 1: Class Average ─────────────────────────────────────────────────
    const avgScore =
      timeSeries.length > 0
        ? timeSeries.reduce((sum, p) => sum + p.classAvgScore, 0) / timeSeries.length
        : 0;
    const avgLabel = scoreToLabel(avgScore);

    // ── KPI 2: Peak Minute ───────────────────────────────────────────────────
    let peakPoint = timeSeries[0] ?? null;
    for (const p of timeSeries) {
      if (p.classAvgScore > (peakPoint?.classAvgScore ?? 0)) peakPoint = p;
    }

    // ── KPI 3: At-Risk Students ──────────────────────────────────────────────
    const atRiskCount = students.filter(
      (s) => s.avgLabel === 'low' || s.avgLabel === 'very_low'
    ).length;

    // ── KPI 4: Total Data Points ─────────────────────────────────────────────
    const totalRecords = students.reduce((sum, s) => sum + s.recordCount, 0);

    return { avgScore, avgLabel, peakPoint, atRiskCount, totalRecords };
  }, [timeSeries, students]);

  const { avgScore, avgLabel, peakPoint, atRiskCount, totalRecords } = kpis;

  /* Base cards shown to everyone */
  const cards: KPICardProps[] = [
    {
      icon:        '📊',
      title:       'Class Average',
      value:       LABEL_TEXT[avgLabel] ?? avgLabel,
      subtitle:    `${(avgScore * 100).toFixed(0)}% weighted score`,
      accentColor: LABEL_COLOR[avgLabel] ?? 'var(--accent)',
    },
    {
      icon:        '🔝',
      title:       'Peak Minute',
      value:       peakPoint ? `+${peakPoint.minuteOffset}m` : '—',
      subtitle:    peakPoint
        ? `${(peakPoint.classAvgScore * 100).toFixed(0)}% class avg at peak`
        : 'No data recorded',
      accentColor: '#2ed573',
    },
  ];

  /* Instructor-only cards */
  if (isInstructor) {
    cards.push(
      {
        icon:        '⚠️',
        title:       'At-Risk Students',
        value:       String(atRiskCount),
        subtitle:    atRiskCount === 0
          ? 'All students engaged'
          : `${atRiskCount} of ${students.length} student${students.length !== 1 ? 's' : ''} below threshold`,
        accentColor: atRiskCount > 0 ? '#ff4757' : '#2ed573',
      },
      {
        icon:        '🗂️',
        title:       'Data Points',
        value:       totalRecords.toLocaleString(),
        subtitle:    'Total engagement records saved',
        accentColor: 'var(--accent)',
      },
    );
  }

  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: `repeat(${cards.length}, 1fr)`,
        gap:                 16,
        marginBottom:        24,
      }}
      /* Stack to 2-col on narrow viewports via inline media —
         real responsiveness handled by the grid auto-collapse below */
    >
      {cards.map((card) => (
        <KPICard key={card.title} {...card} />
      ))}
    </div>
  );
};

export default KPICards;
