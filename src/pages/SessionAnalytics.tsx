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
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <CircularProgress sx={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: 16, fontSize: 14 }}>
            Loading session analytics…
          </p>
        </div>
      </div>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────

  if (error || !analytics) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: 'var(--bg-primary)' }}
      >
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
    );
  }

  const { sessionInfo, timeSeries, students } = analytics;

  // ── Render: page ───────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="max-w-5xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-8">
          <button
            onClick={() => navigate('/sessions')}
            style={{
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              width:        36,
              height:       36,
              borderRadius: 10,
              border:       '1px solid var(--border)',
              background:   'var(--bg-surface)',
              color:        'var(--text-secondary)',
              cursor:       'pointer',
              flexShrink:   0,
              marginTop:    3,
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                style={{
                  fontSize:   11,
                  fontWeight: 600,
                  padding:    '2px 8px',
                  borderRadius: 8,
                  background: 'var(--bg-elevated)',
                  color:      'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Completed
              </span>
            </div>

            <h1
              className="text-2xl font-bold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {sessionInfo.title}
            </h1>

            {/* Metadata row */}
            <div
              className="flex flex-wrap items-center gap-4 mt-2"
              style={{ color: 'var(--text-muted)', fontSize: 13 }}
            >
              <span className="flex items-center gap-1">
                <CalendarTodayIcon sx={{ fontSize: 14 }} />
                {fmt(sessionInfo.startTime)}
              </span>
              <span className="flex items-center gap-1">
                <AccessTimeIcon sx={{ fontSize: 14 }} />
                {fmtDuration(sessionInfo.durationMinutes)}
              </span>
              {isInstructor && students.length > 0 && (
                <span className="flex items-center gap-1">
                  <PeopleIcon sx={{ fontSize: 14 }} />
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
              <h2
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Engagement Over Time
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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
                <h2
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Student Engagement Summary
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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
    </div>
  );
};

export default SessionAnalytics;
