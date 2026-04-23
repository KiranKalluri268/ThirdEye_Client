/**
 * @file AdminDashboard.tsx
 * @description Platform-wide admin analytics page.
 *              Route: /admin  (admin role only — silently redirects others)
 *
 *              Sections:
 *               1. KPI cards    — Users · Sessions · Engagement Records · Completion Rate
 *               2. User panel   — Role breakdown + recent registrations
 *               3. Session panel — Status breakdown + recent sessions table
 *               4. Engagement   — Avg score + label distribution bar
 *               5. Top sessions — Highest-engagement sessions
 */

import React, { useEffect, useState } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { CircularProgress }            from '@mui/material';
import PeopleIcon         from '@mui/icons-material/People';
import VideoLibraryIcon   from '@mui/icons-material/VideoLibrary';
import InsightsIcon       from '@mui/icons-material/Insights';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import SchoolIcon         from '@mui/icons-material/School';
import PersonIcon         from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BarChartIcon       from '@mui/icons-material/BarChart';
import MeetingRoomIcon    from '@mui/icons-material/MeetingRoom';

import api     from '../api/api';
import useAuth from '../hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminStats {
  users: {
    total:  number;
    byRole: { admin: number; instructor: number; student: number };
    recentUsers: { _id: string; name: string; email: string; role: string; avatarColor: string; createdAt: string }[];
  };
  sessions: {
    total:          number;
    byStatus:       { scheduled: number; active: number; completed: number; expired: number };
    completionRate: number;
    recentSessions: {
      _id:            string;
      title:          string;
      status:         string;
      startTime:      string;
      durationMinutes:number;
      roomCode:       string | null;
      instructor:     { name: string; avatarColor: string };
    }[];
  };
  engagement: {
    totalRecords: number;
    avgScore:     number;
    byLabel: {
      very_high: { count: number; pct: number };
      high:      { count: number; pct: number };
      low:       { count: number; pct: number };
      very_low:  { count: number; pct: number };
    };
    topSessions: { sessionId: string; title: string; avgScore: number; records: number }[];
  };
  rooms: { total: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { dateStyle: 'medium' });

const scoreColor = (score: number): string => {
  if (score >= 0.72) return '#22c55e';
  if (score >= 0.47) return '#3b82f6';
  if (score >= 0.22) return '#f59e0b';
  return '#ef4444';
};

const LABEL_META: Record<string, { label: string; color: string }> = {
  very_high: { label: 'Very High', color: '#22c55e' },
  high:      { label: 'High',      color: '#3b82f6' },
  low:       { label: 'Low',       color: '#f59e0b' },
  very_low:  { label: 'Very Low',  color: '#ef4444' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** KPI stat card */
const KPICard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}> = ({ label, value, icon, accent = 'var(--accent)' }) => (
  <div
    className="glass card-hover"
    style={{
      borderRadius: 'var(--radius-lg)',
      padding: '22px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}
  >
    <div
      style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${accent}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: accent,
      }}
    >
      {icon}
    </div>
    <div>
      <p style={{
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4,
      }}>
        {label}
      </p>
      <p style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </p>
    </div>
  </div>
);

/** Section header */
const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div style={{ marginBottom: 16 }}>
    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
    {subtitle && (
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 3 }}>{subtitle}</p>
    )}
  </div>
);

/** Engagement label bar segment */
const LabelBar: React.FC<{ label: string; pct: number; color: string; count: number }> = ({
  label, pct, color, count,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
    <span style={{ width: 80, fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 4,
        background: color,
        transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
    <span style={{ width: 44, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
      {pct}%
    </span>
    <span style={{ width: 52, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
      ({count})
    </span>
  </div>
);

/** Status badge pill */
const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`status-pill ${status}`} style={{ fontSize: '0.7rem' }}>
    <span className="dot" />
    {status === 'active' ? 'Live' : status}
  </span>
);

/** Avatar initials bubble */
const Avatar: React.FC<{ name: string; color: string; size?: number }> = ({ name, color, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: color || 'var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: size * 0.3, color: '#fff', flexShrink: 0,
  }}>
    {name.slice(0, 2).toUpperCase()}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

/**
 * @description Admin-only analytics dashboard. Silently redirects non-admin users
 *              to /dashboard on mount.
 */
type UserRow    = AdminStats['users']['recentUsers'][number];
type SessionRow = AdminStats['sessions']['recentSessions'][number];

const AdminDashboard: React.FC = () => {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const [stats,   setStats]   = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Expand: users ──────────────────────────────────────────────────────
  const [usersExpanded, setUsersExpanded] = useState(false);
  const [allUsers,      setAllUsers]      = useState<UserRow[] | null>(null);
  const [usersLoading,  setUsersLoading]  = useState(false);

  // ── Expand: sessions ───────────────────────────────────────────────────
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [allSessions,      setAllSessions]      = useState<SessionRow[] | null>(null);
  const [sessionsLoading,  setSessionsLoading]  = useState(false);

  // ── Guard: redirect non-admins silently ────────────────────────────────
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // ── Fetch stats ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    api.get<{ success: boolean } & AdminStats>('/admin/stats')
      .then((res) => { if (!res.data.success) throw new Error('Failed'); setStats(res.data); })
      .catch(() => setError('Failed to load admin stats. Please try again.'))
      .finally(() => setLoading(false));
  }, [user]);

  // ── Expand handlers ────────────────────────────────────────────────────
  const handleExpandUsers = async () => {
    if (usersExpanded) { setUsersExpanded(false); return; }
    if (allUsers)      { setUsersExpanded(true);  return; }
    setUsersLoading(true);
    try {
      const res = await api.get<{ success: boolean; users: UserRow[] }>('/admin/users');
      setAllUsers(res.data.users);
      setUsersExpanded(true);
    } catch { /* silent */ } finally { setUsersLoading(false); }
  };

  const handleExpandSessions = async () => {
    if (sessionsExpanded) { setSessionsExpanded(false); return; }
    if (allSessions)      { setSessionsExpanded(true);  return; }
    setSessionsLoading(true);
    try {
      const res = await api.get<{ success: boolean; sessions: SessionRow[] }>('/admin/sessions');
      setAllSessions(res.data.sessions);
      setSessionsExpanded(true);
    } catch { /* silent */ } finally { setSessionsLoading(false); }
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)' }}>
        <div style={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: 'var(--accent)' }} />
          <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Loading platform stats…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error || !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{error ?? 'Something went wrong.'}</p>
      </div>
    );
  }

  const { users, sessions, engagement, rooms } = stats;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="fade-in" style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <AdminPanelSettingsIcon sx={{ fontSize: 28, color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Admin Dashboard
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Platform-wide analytics across all users, sessions, and engagement data.
        </p>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────────── */}
      <div
        className="fade-in"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 32,
        }}
      >
        <KPICard
          label="Total Users"
          value={users.total}
          icon={<PeopleIcon />}
          accent="#7c6fff"
        />
        <KPICard
          label="Total Sessions"
          value={sessions.total}
          icon={<VideoLibraryIcon />}
          accent="#3b82f6"
        />
        <KPICard
          label="Engagement Records"
          value={engagement.totalRecords.toLocaleString()}
          icon={<InsightsIcon />}
          accent="#22c55e"
        />
        <KPICard
          label="Completion Rate"
          value={`${sessions.completionRate}%`}
          icon={<CheckCircleIcon />}
          accent="#f59e0b"
        />
        <KPICard
          label="Total Rooms"
          value={rooms.total}
          icon={<MeetingRoomIcon />}
          accent="#ec4899"
        />
      </div>

      {/* ── Row: Users + Engagement overview ──────────────────────────────── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}
        className="admin-two-col"
      >

        {/* Users panel */}
        <div className="glass fade-in" style={{ borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <SectionHeader title="Users" subtitle="Breakdown by role" />

          {/* Role pills */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { role: 'Students',    count: users.byRole.student,    color: '#3b82f6', icon: <SchoolIcon sx={{ fontSize: 16 }} /> },
              { role: 'Instructors', count: users.byRole.instructor,  color: '#7c6fff', icon: <PersonIcon sx={{ fontSize: 16 }} /> },
              { role: 'Admins',      count: users.byRole.admin,       color: '#f59e0b', icon: <AdminPanelSettingsIcon sx={{ fontSize: 16 }} /> },
            ].map(({ role, count, color, icon }) => (
              <div
                key={role}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 14px', borderRadius: 30,
                  background: `${color}18`, border: `1px solid ${color}44`,
                  color,
                }}
              >
                {icon}
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{count}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{role}</span>
              </div>
            ))}
          </div>

          {/* User list — preview or full */}
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
            {usersExpanded ? 'All Users' : 'Recent Registrations'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(usersExpanded && allUsers ? allUsers : users.recentUsers).map((u) => (
              <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} color={u.avatarColor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.name}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {u.email}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'capitalize',
                    color: u.role === 'admin' ? '#f59e0b' : u.role === 'instructor' ? '#7c6fff' : '#3b82f6',
                    background: u.role === 'admin' ? '#f59e0b18' : u.role === 'instructor' ? '#7c6fff18' : '#3b82f618',
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {u.role}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {fmtDate(u.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {users.total > 5 && (
            <button
              onClick={handleExpandUsers}
              disabled={usersLoading}
              style={{
                marginTop: 14, width: '100%', padding: '8px 0',
                borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', cursor: usersLoading ? 'wait' : 'pointer',
                fontSize: '0.78rem', fontWeight: 600,
                color: usersExpanded ? 'var(--text-muted)' : 'var(--accent)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {usersLoading ? 'Loading…' : usersExpanded ? '↑ Show less' : `View all ${users.total} users →`}
            </button>
          )}
        </div>

        {/* Engagement overview panel */}
        <div className="glass fade-in" style={{ borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <SectionHeader title="Engagement Overview" subtitle="Platform-wide label distribution" />

          {/* Avg score chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12, marginBottom: 22,
            background: `${scoreColor(engagement.avgScore)}18`,
            border: `1px solid ${scoreColor(engagement.avgScore)}44`,
          }}>
            <BarChartIcon sx={{ fontSize: 18, color: scoreColor(engagement.avgScore) }} />
            <div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                PLATFORM AVG SCORE
              </p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: scoreColor(engagement.avgScore), lineHeight: 1 }}>
                {(engagement.avgScore * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Distribution bars */}
          {(['very_high', 'high', 'low', 'very_low'] as const).map((key) => (
            <LabelBar
              key={key}
              label={LABEL_META[key].label}
              color={LABEL_META[key].color}
              pct={engagement.byLabel[key].pct}
              count={engagement.byLabel[key].count}
            />
          ))}

          {/* Top sessions by engagement */}
          {engagement.topSessions.length > 0 && (
            <>
              <p style={{
                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--text-muted)', margin: '18px 0 10px',
              }}>
                Top Sessions by Engagement
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {engagement.topSessions.map((s, i) => (
                  <div
                    key={s.sessionId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 10,
                      background: 'var(--bg-elevated)',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/sessions/${s.sessionId}/analytics`)}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : 'var(--bg-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800,
                      color: i < 2 ? '#fff' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{
                      flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {s.title}
                    </span>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 700,
                      color: scoreColor(s.avgScore),
                    }}>
                      {(s.avgScore * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Sessions status breakdown ─────────────────────────────────────── */}
      <div className="glass fade-in" style={{ borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <SectionHeader title="Sessions" subtitle={`${sessions.total} total sessions across all instructors`} />
          {/* Status pills summary */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'active',    color: '#22c55e' },
              { key: 'scheduled', color: '#3b82f6' },
              { key: 'completed', color: '#94a3b8' },
              { key: 'expired',   color: '#ef4444' },
            ].map(({ key, color }) => (
              sessions.byStatus[key as keyof typeof sessions.byStatus] > 0 && (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 20,
                  background: `${color}15`, border: `1px solid ${color}40`,
                  color,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>{key}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                    {sessions.byStatus[key as keyof typeof sessions.byStatus]}
                  </span>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Sessions table — preview or full */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Session', 'Instructor', 'Status', 'Date', 'Duration', ''].map((h) => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontSize: '0.68rem', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sessionsExpanded && allSessions ? allSessions : sessions.recentSessions).map((s) => (
                <tr
                  key={s._id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.12s',
                    cursor: s.status === 'completed' ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={s.status === 'completed' ? () => navigate(`/sessions/${s._id}/analytics`) : undefined}
                >
                  <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 200 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {s.title}
                    </span>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={s.instructor?.name ?? '?'} color={s.instructor?.avatarColor ?? '#7c6fff'} size={26} />
                      <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {s.instructor?.name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <StatusPill status={s.status} />
                  </td>
                  <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {fmtDate(s.startTime)}
                  </td>
                  <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>
                    {s.durationMinutes}m
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                    {s.status === 'completed' && (
                      <span style={{
                        fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
                      }}>
                        <BarChartIcon sx={{ fontSize: 14 }} /> Analytics
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* View more / Show less — sessions */}
        {sessions.total > 10 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              onClick={handleExpandSessions}
              disabled={sessionsLoading}
              style={{
                padding: '8px 24px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                cursor: sessionsLoading ? 'wait' : 'pointer',
                fontSize: '0.8rem', fontWeight: 600,
                color: sessionsExpanded ? 'var(--text-muted)' : 'var(--accent)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {sessionsLoading ? 'Loading…' : sessionsExpanded ? '↑ Show less' : `View all ${sessions.total} sessions →`}
            </button>
          </div>
        )}
      </div>

      {/* ── Responsive grid fix ────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .admin-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
