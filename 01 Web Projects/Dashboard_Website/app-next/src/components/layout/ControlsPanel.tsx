'use client';

// docs/04-css-design-system.md §Header (controls section styling)
// docs/03-frontend-components.md §ControlsPanel
// Phase 1: collapsible shell with empty section labels.
// Phase 2 will wire all inputs to the Zustand useConfig() store.

import { useState } from 'react';

interface ControlsPanelProps {
  defaultOpen?: boolean;
}

export default function ControlsPanel({ defaultOpen = false }: ControlsPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-card border border-dashboard-border bg-dashboard-surface p-5">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-dashboard-text">⚙ Scenario Controls</span>
        <svg
          className={`w-5 h-5 text-dashboard-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="mt-4 space-y-6">
          <Section label="Current Balances & Profile">
            <InputRow label="User 1 Name" />
            <InputRow label="User 1 Age" />
            <InputRow label="User 2 Name" />
            <InputRow label="User 2 Age" />
            <InputRow label="Desired Retirement Age" />
          </Section>

          <Section label="Debt Balances">
            <InputRow label="Number of Debts" />
          </Section>

          <Section label="Super & Returns">
            <InputRow label="User 1 Super Balance" />
            <InputRow label="User 2 Super Balance" />
            <InputRow label="Expected Annual Return (%)" />
          </Section>

          <Section label="Mortgage & Property">
            <InputRow label="Property Value" />
            <InputRow label="Mortgage Balance" />
            <InputRow label="Annual Interest Rate (%)" />
          </Section>

          <Section label="Retirement">
            <InputRow label="Target Annual Income (AUD)" />
          </Section>

          <Section label="Children">
            <InputRow label="Number of Children" />
          </Section>

          <Section label="Family Trust Property">
            <InputRow label="Property Value" />
            <InputRow label="Loan Balance" />
          </Section>

          <p className="text-xs text-dashboard-muted italic">
            Phase 1 shell — inputs wired to Zustand store in Phase 2.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-muted mb-3 pb-1 border-b border-dashboard-border">
        {label}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function InputRow({ label }: { label: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-dashboard-muted mb-1">
        {label}
      </label>
      <input
        disabled
        placeholder="Phase 2"
        className="w-full rounded-input bg-dashboard-surface2 border border-dashboard-border text-sm text-dashboard-muted px-3 py-2 opacity-50 cursor-not-allowed"
      />
    </div>
  );
}
