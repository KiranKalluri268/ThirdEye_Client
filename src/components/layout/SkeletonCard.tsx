/**
 * @file SkeletonCard.tsx
 * @description Reusable skeleton shimmer placeholder card.
 *              Replaces "Loading…" text and spinners during data fetches.
 */

import React from 'react';

interface SkeletonCardProps {
  /** Height of the skeleton block. Default 80px */
  height?: number | string;
  /** Border radius. Default var(--radius-md) */
  borderRadius?: string;
  /** Additional style overrides */
  style?: React.CSSProperties;
}

/**
 * @description A single shimmer skeleton card. Stack multiple for list skeletons.
 */
const SkeletonCard: React.FC<SkeletonCardProps> = ({
  height = 80,
  borderRadius = 'var(--radius-md)',
  style,
}) => (
  <div
    className="skeleton"
    style={{
      width: '100%',
      height,
      borderRadius,
      ...style,
    }}
    aria-hidden="true"
  />
);

/** Renders N skeleton cards with a gap between them */
export const SkeletonList: React.FC<{ count?: number; height?: number }> = ({
  count = 4,
  height = 80,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} height={height} />
    ))}
  </div>
);

/** Renders a row of skeleton stat cards */
export const SkeletonStatRow: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} height={96} />
    ))}
  </div>
);

export default SkeletonCard;
