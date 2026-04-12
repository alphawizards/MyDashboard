'use client';

// docs/04-css-design-system.md §Alert Box
// docs/03-frontend-components.md §AlertBox

import { useState } from 'react';

type AlertType = 'info' | 'warning' | 'error' | 'success';

interface AlertBoxProps {
  type?: AlertType;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
}

const VARIANTS: Record<AlertType, { bg: string; border: string; icon: string }> = {
  info: {
    bg: 'rgba(56,189,248,0.08)',
    border: 'rgba(56,189,248,0.2)',
    icon: 'ℹ️',
  },
  warning: {
    bg: 'rgba(251,146,60,0.1)',
    border: 'rgba(251,146,60,0.3)',
    icon: '⚠️',
  },
  error: {
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.3)',
    icon: '❌',
  },
  success: {
    bg: 'rgba(74,222,128,0.06)',
    border: 'rgba(74,222,128,0.3)',
    icon: '✅',
  },
};

export default function AlertBox({
  type = 'info',
  title,
  children,
  dismissible = false,
}: AlertBoxProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const variant = VARIANTS[type];

  return (
    <div
      className="rounded-card px-5 py-4 flex gap-3 items-start text-sm leading-relaxed"
      style={{ background: variant.bg, border: `1px solid ${variant.border}` }}
    >
      <span className="text-xl flex-shrink-0 leading-none mt-0.5">{variant.icon}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-dashboard-text mb-1">{title}</p>}
        <div className="text-dashboard-text">{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="text-dashboard-muted hover:text-dashboard-text transition-colors flex-shrink-0 text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
