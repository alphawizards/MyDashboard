// docs/04-css-design-system.md §Badge
// docs/03-frontend-components.md §Badge

type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'purple' | 'slate';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  size?: BadgeSize;
}

const COLOR_STYLES: Record<BadgeColor, { color: string; bg: string }> = {
  primary: { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  success: { color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  warning: { color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  error: { color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  purple: { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  slate: { color: '#94a3b8', bg: 'rgba(71,85,105,0.3)' },
};

export default function Badge({ label, color = 'slate', size = 'md' }: BadgeProps) {
  const styles = COLOR_STYLES[color];
  return (
    <span
      className={[
        'rounded-full font-semibold inline-block',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
      ].join(' ')}
      style={{ color: styles.color, backgroundColor: styles.bg }}
    >
      {label}
    </span>
  );
}
