/**
 * @file SessionTimer.tsx
 * @description Displays a live elapsed time counter from when the session started.
 *              Updates every second using setInterval.
 */

import React, { useState, useEffect } from 'react';

interface SessionTimerProps {
  /** ISO string of when the session became active */
  startTime: string;
}

/**
 * @description Formats a duration in seconds to MM:SS or HH:MM:SS.
 * @param seconds - Total elapsed seconds
 * @returns {string} Formatted string e.g. "01:23:45"
 */
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/**
 * @description Live session timer. Counts up from the session's startTime.
 * @param startTime - ISO timestamp of when the session became active
 */
const SessionTimer: React.FC<SessionTimerProps> = ({ startTime }) => {
  const getElapsed = () => Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const [elapsed, setElapsed] = useState(getElapsed);

  useEffect(() => {
    const id = setInterval(() => setElapsed(getElapsed()), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  return (
    <span
      className="font-mono text-sm px-2 py-0.5 rounded-md"
      style={{ background: 'var(--bg-elevated)', color: 'var(--success)', letterSpacing: '0.05em' }}
    >
      {formatDuration(elapsed)}
    </span>
  );
};

export default SessionTimer;
