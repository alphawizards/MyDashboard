// docs/04-css-design-system.md §KPI Card
// docs/03-frontend-components.md §KPICard

export interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  /** Any valid CSS colour string, e.g. "var(--green)" or "#4ade80" */
  color?: string;
  highlight?: boolean;
  /** 0–100, renders progress bar below value */
  progress?: number;
}

export default function KPICard({
  label,
  value,
  sub,
  color,
  highlight = false,
  progress,
}: KPICardProps) {
  return (
    <div
      className={[
        'rounded-card border p-[18px]',
        highlight
          ? 'border-dashboard-accent'
          : 'border-dashboard-border bg-dashboard-surface',
      ].join(' ')}
      style={
        highlight
          ? {
              background:
                'linear-gradient(135deg, rgba(56,189,248,0.08), #1e293b)',
            }
          : undefined
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-muted mb-1">
        {label}
      </p>
      <p
        className="text-2xl font-bold text-dashboard-text"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-dashboard-muted mt-1">{sub}</p>}
      {typeof progress === 'number' && (
        <div className="mt-2 h-2 rounded-full bg-dashboard-surface2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              backgroundColor: color ?? 'var(--accent)',
            }}
          />
        </div>
      )}
    </div>
  );
}
