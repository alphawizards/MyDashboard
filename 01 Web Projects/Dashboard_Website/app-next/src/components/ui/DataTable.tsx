// docs/04-css-design-system.md §Table
// docs/03-frontend-components.md §DataTable

interface Header {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
}

interface DataTableProps {
  headers: Header[];
  rows: Array<Record<string, unknown>>;
  highlightRow?: (row: Record<string, unknown>, index: number) => boolean;
  maxHeight?: number;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
}

export default function DataTable({
  headers,
  rows,
  highlightRow,
  maxHeight = 500,
  onSort: _onSort,
}: DataTableProps) {
  return (
    <div
      className="overflow-auto rounded-card border border-dashboard-border"
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h.key}
                className={[
                  'sticky top-0 bg-dashboard-surface px-[10px] py-[8px]',
                  'text-xs font-semibold uppercase tracking-wide text-dashboard-muted',
                  'border-b border-dashboard-border',
                  h.align === 'right' ? 'text-right' : 'text-left',
                  h.sortable ? 'cursor-pointer hover:text-dashboard-text' : '',
                ].join(' ')}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* TODO(phase-3): replace key={i} with stable row id once live data wires in */}
          {rows.map((row, i) => {
            const highlighted = highlightRow?.(row, i) ?? false;
            return (
              <tr
                key={i}
                className={[
                  'border-b border-dashboard-border/30',
                  'hover:bg-[rgba(56,189,248,0.04)] transition-colors',
                  highlighted ? 'bg-[rgba(56,189,248,0.08)] font-semibold' : '',
                ].join(' ')}
              >
                {headers.map((h) => (
                  <td
                    key={h.key}
                    className={[
                      'px-[10px] py-[8px] text-sm text-dashboard-text',
                      h.align === 'right' ? 'text-right' : 'text-left',
                    ].join(' ')}
                  >
                    {String(row[h.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
