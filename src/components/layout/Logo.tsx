/**
 * @file Logo.tsx
 * @description ThirdEye SVG eye logo mark, rotated 90° (pointing sideways).
 *              Used in the sidebar, auth pages, and the mobile nav header.
 */

import React from 'react';

interface LogoProps {
  /** Pixel size of the icon (square). Default 32. */
  size?: number;
  /** Whether to show the "ThirdEye" wordmark next to the icon. Default true. */
  showName?: boolean;
  /** Additional class names on the wrapper */
  className?: string;
}

/**
 * @description Renders the ThirdEye "eye" SVG mark rotated 90° (landscape eye
 *              looking sideways), with an optional wordmark.
 */
const Logo: React.FC<LogoProps> = ({ size = 32, showName = true, className = '' }) => (
  <div
    className={`flex items-center gap-1 ${className}`}
    style={{ userSelect: 'none' }}
  >
    {showName && (
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: size * 0.56,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
        }}
      >
        ThirdEye
      </span>
    )}

    {/* Eye SVG – rotated 90° so it looks sideways */}
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: 'rotate(90deg)', flexShrink: 0 }}
      aria-label="ThirdEye logo"
    >
      {/* Outer eye outline */}
      <ellipse
        cx="20"
        cy="20"
        rx="10"
        ry="17"
        stroke="var(--accent)"
        strokeWidth="2.2"
        fill="none"
      />
      {/* Iris */}
      <circle
        cx="20"
        cy="20"
        r="5.5"
        fill="var(--accent)"
        opacity="0.85"
      />
      {/* Pupil */}
      <circle
        cx="20"
        cy="20"
        r="2.2"
        fill="var(--bg-surface)"
        opacity="0.9"
      />
      {/* Top lash accent */}
      <line x1="20" y1="3"  x2="20" y2="7"  stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      {/* Bottom lash accent */}
      <line x1="20" y1="33" x2="20" y2="37" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </div>
);

export default Logo;
