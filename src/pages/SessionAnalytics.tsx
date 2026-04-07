/**
 * @file SessionAnalytics.tsx
 * @description Full analytics page for a completed session.
 *              Route: /sessions/:sessionId/analytics
 *
 *              Layout:
 *               1. Header — back button, session title, metadata badges
 *               2. EngagementChart — class avg + toggled student lines
 *               3. StudentTable — paginated aggregate stats (instructor only)
 *
 *              Data fetching:
 *               - On mount: GET /api/sessions/:sessionId/analytics
 *               - On student row click: lazily GET analytics/student/:studentId
 *                 (only fetched once; subsequent toggles use cached data)
 *
 *              Access control is enforced on the server. Students receive
 *              sessionInfo + timeSeries only (empty students array).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import ArrowBackIcon    from '@mui/icons-material/ArrowBack';
import PeopleIcon       from '@mui/icons-material/People';
import AccessTimeIcon   from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

import api     from '../api/api';
import useAuth from '../hooks/useAuth';

import EngagementChart, {
  type ChartTimeSeries,
  type StudentSeries as ChartStudentSeries,
} from '../components/analytics/EngagementChart';
import StudentTable, {
  type StudentSummary,
} from '../components/analytics/StudentTable';
import AppShell from '../components/layout/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionInfo {
  title:           string;
  description?:    string;
  instructor:      string;
  startTime:       string;
  endTime:         string | null;
  durationMinutes: number;
  status:          string;
}

interface AnalyticsResponse {
  success:     boolean;
  sessionInfo: SessionInfo;
  timeSeries:  ChartTimeSeries[];
  students:    StudentSummary[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * @description Formats an ISO date string to a readable display value.
 * @param iso - ISO 8601 date string
 * @returns {string} e.g. "Apr 5, 2026, 6:30 PM"
 */
const fmt = (iso: string): string =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/**
 * @description Formats a duration in minutes to a human-readable string.
 * @param minutes - Duration in minutes
 * @returns {string} e.g. "1h 15m" or "45m"
 */
const fmtDuration = (minutes: number): string => {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
};

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @description Session analytics page. Loads from the analytics API on mount.
 *              Lazily fetches per-student time series when a row is toggled.
 */
const SessionAnalytics: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate       = useNavigate();
  const { user }       = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────

  const [analytics,         setAnalytics]         = useState<AnalyticsResponse | null>(null);
  const [loading,           setLoading]            = useState(true);
  const [error,             setError]              = useState<string | null>(null);
  const [selectedStudents,  setSelectedStudents]   = useState<Set<string>>(new Set());
  const [studentSeriesMap,  setStudentSeriesMap]   = useState<Map<string, ChartStudentSeries[]>>(new Map());
  const [studentNamesMap,   setStudentNamesMap]    = useState<Map<string, string>>(new Map());
  const [fetchingStudent,   setFetchingStudent]    = useState<string | null>(null);

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  // ── Load analytics on mount ────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      try {
        const res = await api.get<AnalyticsResponse>(`/sessions/${sessionId}/analytics`);
        if (!res.data.success) throw new Error('Failed to load analytics');
        setAnalytics(res.data);

        // Pre-populate names map for chart legend
        const namesMap = new Map<string, string>();
        res.data.students.forEach((s) => namesMap.set(s.userId, s.name));
        setStudentNamesMap(namesMap);
      } catch (err) {
        console.error('[SessionAnalytics] load error:', err);
        setError('Failed to load session analytics. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  // ── Student row toggle ─────────────────────────────────────────────────────

  /**
   * @description Toggles a student's line on the chart.
   *              Lazily fetches their time series on first selection.
   *              Subsequent toggles use cached data from studentSeriesMap.
   * @param studentId - MongoDB ObjectId string
   * @param name      - Display name for the chart legend
   */
  const handleStudentToggle = useCallback(async (studentId: string, name: string) => {
    // Deselect if already selected
    if (selectedStudents.has(studentId)) {
      setSelectedStudents((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      return;
    }

    // Fetch time series if not cached
    if (!studentSeriesMap.has(studentId)) {
      setFetchingStudent(studentId);
      try {
        const res = await api.get<{ success: boolean; series: ChartStudentSeries[] }>(
          `/sessions/${sessionId}/analytics/student/${studentId}`
        );
        if (res.data.success) {
          setStudentSeriesMap((prev) => new Map(prev).set(studentId, res.data.series));
          setStudentNamesMap((prev) => new Map(prev).set(studentId, name));
        }
      } catch (err) {
        console.warn('[SessionAnalytics] student series fetch failed:', err);
        return; // Don't select if fetch failed
      } finally {
        setFetchingStudent(null);
      }
    }

    setSelectedStudents((prev) => new Set(prev).add(studentId));
  }, [selectedStudents, studentSeriesMap, sessionId]);

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 140px)' }}>
          <div className="text-center">
            <CircularProgress sx={{ color: 'var(--accent)' }} />
            <p style={{ color: 'var(--text-secondary)', marginTop: 16, fontSize: 14 }}>
              Loading session analytics…
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────

  if (error || !analytics) {
    return (
      <AppShell>
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 140px)' }}>
          <div className="text-center">
            <p style={{ color: 'var(--error, #ff4757)', fontSize: 14 }}>
              {error ?? 'Something went wrong.'}
            </p>
            <button
              onClick={() => navigate('/sessions')}
              style={{
                marginTop: 12, padding: '8px 20px',
                border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                cursor: 'pointer', fontSize: 13,
              }}
            >
              ← Back to Sessions
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const { sessionInfo, timeSeries, students } = analytics;

  // ── Render: page ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 36 }}>
          <button
            onClick={() => navigate('/sessions')}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          38,
              height:         38,
              borderRadius:   10,
              border:         '1px solid var(--border)',
              background:     'var(--bg-surface)',
              color:          'var(--text-secondary)',
              cursor:         'pointer',
              flexShrink:     0,
              marginTop:      2,
              transition:     'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'var(--text-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h1
                style={{
                  fontSize: '1.85rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  lineHeight: 1.1,
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sessionInfo.title}
              </h1>
              <span className={`status-pill ${sessionInfo.status === 'active' ? 'active' : 'completed'}`} style={{ marginTop: 2 }}>
                <span className="dot" />
                {sessionInfo.status === 'active' ? 'Live' : 'Completed'}
              </span>
            </div>

            {/* Metadata row */}
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18,
                color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarTodayIcon sx={{ fontSize: 16 }} />
                {fmt(sessionInfo.startTime)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AccessTimeIcon sx={{ fontSize: 16 }} />
                {fmtDuration(sessionInfo.durationMinutes)}
              </span>
              {isInstructor && students.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PeopleIcon sx={{ fontSize: 16 }} />
                  {students.length} student{students.length !== 1 ? 's' : ''} tracked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Chart section ────────────────────────────────────────────────── */}
        <div
          className="glass rounded-2xl p-5 mb-6 fade-in"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Engagement Over Time
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                1-minute averages
                {selectedStudents.size > 0 &&
                  ` · ${selectedStudents.size} student${selectedStudents.size !== 1 ? 's' : ''} overlaid`}
              </p>
            </div>
            {fetchingStudent && (
              <div className="flex items-center gap-2">
                <CircularProgress size={14} sx={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Loading student data…
                </span>
              </div>
            )}
          </div>

          {timeSeries.length === 0 ? (
            <div
              style={{
                height:     240,
                display:    'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color:      'var(--text-muted)',
                fontSize:   13,
              }}
            >
              No engagement data recorded for this session.
            </div>
          ) : (
            <EngagementChart
              timeSeries={timeSeries}
              studentSeries={studentSeriesMap}
              selectedStudents={selectedStudents}
              studentNames={studentNamesMap}
            />
          )}
        </div>

        {/* ── Student table (instructor only) ──────────────────────────────── */}
        {isInstructor && students.length > 0 && (
          <div
            className="glass rounded-2xl fade-in"
            style={{ border: '1px solid var(--border)', overflow: 'hidden' }}
          >
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Student Engagement Summary
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Click a row to overlay the student's line on the chart
                </p>
              </div>
              {selectedStudents.size > 0 && (
                <button
                  onClick={() => setSelectedStudents(new Set())}
                  style={{
                    fontSize:   12,
                    color:      'var(--text-muted)',
                    background: 'none',
                    border:     '1px solid var(--border)',
                    borderRadius: 8,
                    padding:    '4px 10px',
                    cursor:     'pointer',
                  }}
                >
                  Clear selection
                </button>
              )}
            </div>

            <StudentTable
              students={students}
              selectedStudents={selectedStudents}
              onStudentToggle={handleStudentToggle}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default SessionAnalytics;
