/**
 * @file Toast.tsx
 * @description Toast notification renderer. Reads from ToastContext and
 *              renders a fixed stack of dismissible toast pills.
 */

import React from 'react';
import { useToast, type ToastVariant } from '../../context/ToastContext';

/* ── Variant config ────────────────────────────────────────────────────── */

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: string; bg: string }> = {
  success: { border: 'var(--success)', icon: '✓', bg: 'rgba(34,197,94,0.12)' },
  error:   { border: 'var(--danger)',  icon: '✕', bg: 'rgba(239,68,68,0.12)' },
  warning: { border: 'var(--warning)', icon: '⚠', bg: 'rgba(249,115,22,0.12)' },
  info:    { border: 'var(--accent)',  icon: 'ℹ', bg: 'rgba(37,99,235,0.12)' },
};

/* ── Component ─────────────────────────────────────────────────────────── */

/**
 * @description Place once inside the ToastProvider tree (e.g. in AppShell or App).
 *              It renders all queued toasts in a fixed bottom-right stack.
 */
const ToastRenderer: React.FC = () => {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const cfg = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            role="alert"
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          10,
              padding:      '10px 16px',
              borderRadius: 'var(--radius-md)',
              border:       `1px solid ${cfg.border}`,
              background:   cfg.bg,
              backdropFilter: 'blur(8px)',
              color:        'var(--text-primary)',
              fontSize:     '0.875rem',
              fontWeight:   500,
              minWidth:     260,
              maxWidth:     340,
              pointerEvents: 'auto',
              cursor:       'default',
              animation:    toast.exiting
                ? 'toastOut 0.32s ease forwards'
                : 'toastIn  0.28s cubic-bezier(0.22,1,0.36,1) forwards',
              boxShadow:    '0 4px 24px rgba(0,0,0,0.45)',
            }}
            onClick={() => dismiss(toast.id)}
          >
            {/* Icon */}
            <span
              style={{
                width: 22, height: 22,
                borderRadius: '50%',
                border: `1.5px solid ${cfg.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', color: cfg.border, flexShrink: 0,
              }}
            >
              {cfg.icon}
            </span>

            {/* Message */}
            <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>

            {/* Close */}
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
              aria-label="Dismiss notification"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1,
                padding: 2, flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastRenderer;
