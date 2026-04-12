// docs/03-frontend-components.md §KPIGrid

import KPICard, { type KPICardProps } from './KPICard';

interface KPIGridProps {
  cards?: KPICardProps[];
  children?: React.ReactNode;
}

export default function KPIGrid({ cards, children }: KPIGridProps) {
  return (
    <div
      className="grid gap-3.5"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
    >
      {/* TODO(phase-3): replace key={i} with stable id once live data wires in */}
      {cards?.map((card, i) => <KPICard key={i} {...card} />)}
      {children}
    </div>
  );
}
