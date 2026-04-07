/**
 * @file ToastContext.tsx
 * @description Context that provides a global toast notification system.
 *              Use the `useToast()` hook to push success / error / warning / info toasts.
 */

import React, { createContext, useCallback, useContext, useState, useRef } from 'react';

/* ── Types ───────────────────────────────────────────────────────────────── */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

/* ── Context ─────────────────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 3800;
const EXIT_MS     = 340;

/* ── Provider ────────────────────────────────────────────────────────────── */

/**
 * @description Wrap your app (or a layout) with this to enable toast notifications.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers              = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Mark as exiting to trigger CSS out-animation
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const push = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, variant }]);

    const timer = setTimeout(() => dismiss(id), DURATION_MS);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
};

/* ── Hook ────────────────────────────────────────────────────────────────── */

/**
 * @description Returns { push, dismiss } to control toasts from any component.
 * @example
 *   const { push } = useToast();
 *   push('Session created!', 'success');
 */
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

export default ToastContext;
