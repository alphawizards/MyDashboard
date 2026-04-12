// docs/04-css-design-system.md §Card
// docs/03-frontend-components.md §ChartCard

interface ChartCardProps {
  title: string;
  icon?: string;
  subtitle?: string;
  height?: number;
  children: React.ReactNode;
}

export default function ChartCard({
  title,
  icon,
  subtitle,
  height = 300,
  children,
}: ChartCardProps) {
  return (
    <div className="rounded-card border border-dashboard-border bg-dashboard-surface p-[22px]">
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
        <div>
          <h2 className="text-base font-semibold text-dashboard-text leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-dashboard-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div style={{ position: 'relative', height }}>{children}</div>
    </div>
  );
}
