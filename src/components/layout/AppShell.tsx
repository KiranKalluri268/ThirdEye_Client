/**
 * @file AppShell.tsx
 * @description Persistent application shell with:
 *              - Fixed left sidebar on desktop (240 px wide)
 *              - Hamburger-triggered drawer overlay on mobile
 *              - ThirdEye Logo + nav links + user info + logout
 *              - Toast renderer included so it's available on all protected pages
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IconButton } from '@mui/material';
import MenuIcon         from '@mui/icons-material/Menu';
import CloseIcon        from '@mui/icons-material/Close';
import DashboardIcon    from '@mui/icons-material/Dashboard';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import LogoutIcon       from '@mui/icons-material/Logout';

import Logo         from './Logo';
import ToastRenderer from './Toast';
import useAuth      from '../../hooks/useAuth';

/* ── Nav items ────────────────────────────────────────────────────────── */

interface NavItem {
  label: string;
  path:  string;
  icon:  React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon    sx={{ fontSize: 20 }} /> },
  { label: 'Sessions',  path: '/sessions',  icon: <VideoLibraryIcon sx={{ fontSize: 20 }} /> },
];

/* ── Sidebar content (shared between desktop + mobile drawer) ─────────── */

const SidebarContent: React.FC<{
  onNavigate: (path: string) => void;
  currentPath: string;
  onLogout: () => void;
  userName: string;
  userRole: string;
  userColor: string;
}> = ({ onNavigate, currentPath, onLogout, userName, userRole, userColor }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px 0 20px',
    }}
  >
    {/* Logo */}
    <div style={{ padding: '0 20px 28px' }}>
      <Logo size={30} />
    </div>

    {/* Nav links */}
    <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
      {NAV_ITEMS.map(({ label, path, icon }) => {
        const active = currentPath === path || currentPath.startsWith(path + '/');
        return (
          <button
            key={path}
            onClick={() => onNavigate(path)}
            aria-current={active ? 'page' : undefined}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            12,
              padding:        '10px 14px',
              borderRadius:   'var(--radius-md)',
              border:         'none',
              cursor:         'pointer',
              fontFamily:     "'Tektur', system-ui, sans-serif",
              fontSize:       '0.875rem',
              fontWeight:     active ? 600 : 500,
              color:          active ? 'var(--accent)' : 'var(--text-secondary)',
              background:     active
                ? 'rgba(37, 99, 235, 0.12)'
                : 'transparent',
              borderLeft:     active ? '3px solid var(--accent)' : '3px solid transparent',
              transition:     'all 0.15s ease',
              textAlign:      'left',
              width:          '100%',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }
            }}
          >
            {icon}
            <span>{label}</span>
          </button>
        );
      })}
    </nav>

    {/* User info + logout */}
    <div
      style={{
        padding: '16px 16px 0',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 36, height: 36,
          borderRadius: '50%',
          background: userColor || 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.8rem', color: '#fff',
          flexShrink: 0,
        }}
      >
        {userName.slice(0, 2).toUpperCase()}
      </div>

      {/* Name + role */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {userName}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
          {userRole}
        </p>
      </div>

      {/* Logout */}
      <IconButton
        onClick={onLogout}
        size="small"
        aria-label="Logout"
        sx={{
          color: 'var(--text-muted)',
          '&:hover': { color: 'var(--danger)', background: 'rgba(239,68,68,0.08)' },
        }}
      >
        <LogoutIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </div>
  </div>
);

/* ── AppShell ─────────────────────────────────────────────────────────── */

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * @description Wraps protected pages with the sidebar layout.
 *              On mobile (< 768 px) the sidebar collapses to a hamburger drawer.
 */
const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, logout }    = useAuth();
  const navigate             = useNavigate();
  const location             = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userName  = user?.name  ?? '';
  const userRole  = user?.role  ?? '';
  const userColor = user?.avatarColor ?? 'var(--accent)';

  const sharedProps = {
    onNavigate:  handleNavigate,
    currentPath: location.pathname,
    onLogout:    handleLogout,
    userName,
    userRole,
    userColor,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg-primary)' }}>

      {/* ── Desktop sidebar (>= 768px) ─────────────────────────────────── */}
      <aside
        aria-label="Main navigation"
        style={{
          width:    'var(--sidebar-w)',
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          position:  'sticky',
          top:       0,
          height:    '100dvh',
          overflowY: 'auto',
          display:   'none',  /* hidden on mobile, shown via media query below */
        }}
        className="desktop-sidebar"
      >
        <SidebarContent {...sharedProps} />
      </aside>

      {/* ── Mobile top bar (< 768px) ───────────────────────────────────── */}
      <div
        className="mobile-topbar"
        style={{
          display:     'none', /* shown on mobile via media query */
          position:    'fixed',
          top: 0, left: 0, right: 0,
          zIndex:      100,
          height:      52,
          background:  'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          alignItems:  'center',
          padding:     '0 12px',
          gap:         12,
        }}
      >
        <IconButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          sx={{ color: 'var(--text-secondary)' }}
        >
          <MenuIcon />
        </IconButton>
        <Logo size={24} />
      </div>

      {/* ── Mobile drawer overlay ──────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.65)',
              zIndex: 200,
              animation: 'fadeIn 0.18s ease forwards',
            }}
          />
          {/* Drawer panel */}
          <div
            style={{
              position:  'fixed',
              top: 0, left: 0, bottom: 0,
              width:     'var(--sidebar-w)',
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
              zIndex:    201,
              animation: 'slideInLeft 0.22s cubic-bezier(0.22,1,0.36,1) forwards',
            }}
          >
            {/* Close button */}
            <IconButton
              onClick={() => setDrawerOpen(false)}
              size="small"
              aria-label="Close navigation"
              style={{ position: 'absolute', top: 10, right: 10 }}
              sx={{ color: 'var(--text-muted)' }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <SidebarContent {...sharedProps} />
          </div>
        </>
      )}

      {/* ── Main content area ──────────────────────────────────────────── */}
      <main
        style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}
        className="shell-main page-enter"
      >
        {children}
      </main>

      {/* ── Toast stack ───────────────────────────────────────────────── */}
      <ToastRenderer />

      {/* ── Responsive CSS ────────────────────────────────────────────── */}
      <style>{`
        @media (min-width: 768px) {
          .desktop-sidebar { display: block !important; }
          .mobile-topbar   { display: none   !important; }
          .shell-main { padding-top: 0 !important; }
        }
        @media (max-width: 767px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar   { display: flex !important; }
          .shell-main { padding-top: 52px; }
        }
      `}</style>
    </div>
  );
};

export default AppShell;
