// docs/04-css-design-system.md §Progress Bar
// docs/03-frontend-components.md §ProgressBar

interface ProgressBarProps {
  value: number; // 0–100
  label?: string;
  colour?: string; // CSS colour string
  showPercent?: boolean;
  height?: number; // px, default 8
}

export default function ProgressBar({
  value,
  label,
  colour = 'var(--accent)',
  showPercent = false,
  height = 8,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div>
      {(label ?? showPercent) && (
        <div className="flex justify-between mb-1">
          {label && <span className="text-xs text-dashboard-muted">{label}</span>}
          {showPercent && (
            <span className="text-xs text-dashboard-muted">{clamped.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div
        className="rounded-full bg-dashboard-surface2 overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: colour }}
        />
      </div>
    </div>
  );
}
