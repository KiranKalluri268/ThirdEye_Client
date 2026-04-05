/**
 * @file StudentTable.tsx
 * @description Paginated table showing per-student engagement summary for a session.
 *
 *              Columns:
 *               - Name (clickable — toggles student line on chart)
 *               - Avg Level badge
 *               - Avg Score (%)
 *               - Distribution bar (stacked proportional fill for all 4 labels)
 *               - Records count
 *
 *              Clicking a row calls onStudentToggle(studentId, name) which the
 *              parent (SessionAnalytics) uses to lazily fetch + show the student
 *              line on the EngagementChart.
 *
 *              5 rows per page, MUI-style pagination.
 */

import React, { useState } from 'react';
import { Tooltip } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentSummary {
  userId:      string;
  name:        string;
  avgScore:    number;
  avgLabel:    string;
  recordCount: number;
  distribution: {
    very_high: number;
    high:      number;
    low:       number;
    very_low:  number;
  };
}

interface StudentTableProps {
  students:         StudentSummary[];
  selectedStudents: Set<string>;
  onStudentToggle:  (studentId: string, name: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 5;

const LABEL_COLORS: Record<string, string> = {
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

// ── Distribution Bar ──────────────────────────────────────────────────────────

/**
 * @description Renders a stacked proportional bar for the 4 engagement labels.
 *              Each segment's width is proportional to its count vs total.
 * @param distribution - Count per label
 * @param total        - Total record count (denominator)
 */
const DistributionBar: React.FC<{
  distribution: StudentSummary['distribution'];
  total:        number;
}> = ({ distribution, total }) => {
  if (total === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;

  const segments: [string, number][] = [
    ['very_high', distribution.very_high],
    ['high',      distribution.high],
    ['low',       distribution.low],
    ['very_low',  distribution.very_low],
  ];

  return (
    <Tooltip
      title={segments.map(([label, count]) =>
        `${LABEL_TEXT[label]}: ${count} (${((count / total) * 100).toFixed(0)}%)`
      ).join(' · ')}
      arrow
    >
      <div
        style={{
          display:      'flex',
          height:       10,
          borderRadius: 6,
          overflow:     'hidden',
          width:        120,
          background:   'var(--bg-elevated)',
          cursor:       'default',
        }}
      >
        {segments.map(([label, count]) => {
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={label}
              style={{
                width:      `${pct}%`,
                background: LABEL_COLORS[label],
                height:     '100%',
              }}
            />
          );
        })}
      </div>
    </Tooltip>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @description Paginated student engagement summary table.
 *              Clicking a row toggles the student's line on the EngagementChart.
 *
 * @param students         - Array of per-student aggregates (sorted by avg score desc)
 * @param selectedStudents - Set of student IDs currently shown on the chart
 * @param onStudentToggle  - Callback when a row is clicked
 */
const StudentTable: React.FC<StudentTableProps> = ({
  students,
  selectedStudents,
  onStudentToggle,
}) => {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(students.length / ROWS_PER_PAGE);
  const slice      = students.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display:              'grid',
          gridTemplateColumns:  '1fr 120px 90px 140px 70px 36px',
          gap:                  12,
          padding:              '8px 16px',
          borderBottom:         '1px solid var(--border)',
          color:                'var(--text-muted)',
          fontSize:             11,
          fontWeight:           600,
          letterSpacing:        '0.06em',
          textTransform:        'uppercase',
        }}
      >
        <span>Student</span>
        <span>Avg Level</span>
        <span>Score</span>
        <span>Distribution</span>
        <span>Records</span>
        <span />
      </div>

      {/* ── Rows ─────────────────────────────────────────────────────────────── */}
      {slice.map((student) => {
        const isSelected = selectedStudents.has(student.userId);
        const total      = student.recordCount;

        return (
          <div
            key={student.userId}
            onClick={() => onStudentToggle(student.userId, student.name)}
            style={{
              display:              'grid',
              gridTemplateColumns:  '1fr 120px 90px 140px 70px 36px',
              gap:                  12,
              alignItems:           'center',
              padding:              '11px 16px',
              borderBottom:         '1px solid var(--border)',
              cursor:               'pointer',
              background:           isSelected ? 'rgba(124,111,255,0.08)' : 'transparent',
              transition:           'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background =
                isSelected ? 'rgba(124,111,255,0.08)' : 'transparent';
            }}
          >
            {/* Name */}
            <span
              style={{
                color:      isSelected ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: isSelected ? 700 : 500,
                fontSize:   13,
                overflow:   'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {student.name}
            </span>

            {/* Avg Level badge */}
            <span
              style={{
                fontSize:     11,
                fontWeight:   700,
                color:        LABEL_COLORS[student.avgLabel] ?? 'var(--text-secondary)',
                background:   'rgba(0,0,0,0.3)',
                padding:      '2px 8px',
                borderRadius: 12,
                border:       `1px solid ${LABEL_COLORS[student.avgLabel] ?? 'transparent'}44`,
                display:      'inline-block',
                whiteSpace:   'nowrap',
              }}
            >
              {LABEL_TEXT[student.avgLabel] ?? student.avgLabel}
            </span>

            {/* Score */}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {(student.avgScore * 100).toFixed(0)}%
            </span>

            {/* Distribution bar */}
            <DistributionBar distribution={student.distribution} total={total} />

            {/* Record count */}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {total}
            </span>

            {/* Chart toggle icon */}
            <ShowChartIcon
              sx={{
                fontSize: 16,
                color:    isSelected ? 'var(--accent)' : 'var(--border)',
                transition: 'color 0.15s',
              }}
            />
          </div>
        );
      })}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {students.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding:   '40px 0',
            color:     'var(--text-muted)',
            fontSize:  13,
          }}
        >
          No engagement data recorded for this session.
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'flex-end',
            gap:            8,
            padding:        '12px 16px',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding:      '4px 12px',
              borderRadius: 8,
              border:       '1px solid var(--border)',
              background:   page === 0 ? 'transparent' : 'var(--bg-elevated)',
              color:        page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor:       page === 0 ? 'not-allowed' : 'pointer',
              fontSize:     12,
            }}
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding:      '4px 12px',
              borderRadius: 8,
              border:       '1px solid var(--border)',
              background:   page >= totalPages - 1 ? 'transparent' : 'var(--bg-elevated)',
              color:        page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor:       page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              fontSize:     12,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentTable;
