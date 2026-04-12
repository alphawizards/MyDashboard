// Phase 1 component gallery — visual smoke-test for all UI shells.
// Static placeholder data only; marked with // Phase 1 placeholder.
// This page is replaced with real dashboard sections in Phases 3–5.

import Header from '@/components/layout/Header';
import ControlsPanel from '@/components/layout/ControlsPanel';
import KPICard from '@/components/ui/KPICard';
import KPIGrid from '@/components/ui/KPIGrid';
import ChartCard from '@/components/ui/ChartCard';
import AlertBox from '@/components/ui/AlertBox';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import TabView from '@/components/ui/TabView';
import DataTable from '@/components/ui/DataTable';
import DropZone from '@/components/ui/DropZone';

// Phase 1 placeholder data
const KPI_CARDS = [
  { label: 'Super Balance', value: '$1.24M', sub: 'at age 60', color: 'var(--green)', highlight: true, progress: 72 },
  { label: 'Monthly Income', value: '$14,583', sub: 'combined take-home', color: 'var(--accent)' },
  { label: 'Total Debt', value: '$385K', sub: 'across 3 liabilities', color: 'var(--red)', progress: 45 },
  { label: 'Savings Rate', value: '42.65%', sub: 'of gross income', color: 'var(--teal)', progress: 43 },
  { label: 'Readiness', value: '87%', sub: 'on track', color: 'var(--green)', progress: 87 },
  { label: 'Net Worth', value: '$2.1M', sub: 'projected', color: 'var(--purple)' },
] as const;

const TABLE_HEADERS = [
  { key: 'year', label: 'Year', align: 'left' as const },
  { key: 'age', label: 'Age' },
  { key: 'balance', label: 'Balance', align: 'right' as const },
  { key: 'return', label: 'Return', align: 'right' as const },
];

const TABLE_ROWS = [
  { year: '2026', age: '35', balance: '$155,000', return: '$12,400' },
  { year: '2027', age: '36', balance: '$182,400', return: '$14,590' },
  { year: '2028', age: '37', balance: '$212,400', return: '$16,990' },
  { year: '2029', age: '38', balance: '$245,730', return: '$19,660' },
  { year: '2030', age: '39', balance: '$282,770', return: '$22,620' },
];

const TABS = [
  {
    id: 'super',
    label: 'Super Projection',
    content: (
      <DataTable
        headers={TABLE_HEADERS}
        rows={TABLE_ROWS}
        highlightRow={(_row: Record<string, unknown>, i: number) => i === 2}
        maxHeight={220}
      />
    ),
  },
  {
    id: 'debt',
    label: 'Debt Payoff',
    content: (
      <p className="text-sm text-dashboard-muted">
        Debt payoff table — Phase 3 placeholder.
      </p>
    ),
  },
  {
    id: 'budget',
    label: 'Budget',
    content: (
      <p className="text-sm text-dashboard-muted">
        Budget breakdown table — Phase 3 placeholder.
      </p>
    ),
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-dashboard-bg">
      <Header version="v1.0.0" />

      <div className="max-w-dashboard mx-auto p-6 space-y-6">

        {/* Phase 1 notice */}
        <AlertBox type="info" title="Phase 1 Component Gallery">
          All UI shells are rendered with static placeholder data. Wire-up to live
          calculations happens in Phases 2–5.
        </AlertBox>

        {/* Controls panel */}
        <ControlsPanel defaultOpen={false} />

        {/* KPI grid */}
        <section>
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            KPI Cards
          </h2>
          <KPIGrid cards={[...KPI_CARDS]} />
        </section>

        {/* Alert variants */}
        <section>
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Alert Box Variants
          </h2>
          <div className="space-y-3">
            <AlertBox type="info">Info: Your super is on track for retirement at 60.</AlertBox>
            <AlertBox type="warning" title="Caution" dismissible>
              Warning: Debt-to-income ratio exceeds 30%.
            </AlertBox>
            <AlertBox type="error">Error: Unable to load projection data.</AlertBox>
            <AlertBox type="success">Success: Config saved to cloud.</AlertBox>
          </div>
        </section>

        {/* Badges & progress bars */}
        <section>
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Badges & Progress Bars
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge label="On Track" color="success" />
            <Badge label="At Risk" color="warning" />
            <Badge label="Shortfall" color="error" />
            <Badge label="IO Phase" color="primary" />
            <Badge label="P&I Phase" color="purple" />
            <Badge label="Pending" color="slate" />
          </div>
          <div className="space-y-3 max-w-md">
            <ProgressBar value={72} label="Super Readiness" colour="var(--green)" showPercent />
            <ProgressBar value={45} label="Debt Cleared" colour="var(--red)" showPercent />
            <ProgressBar value={87} label="Retirement Score" colour="var(--teal)" showPercent />
          </div>
        </section>

        {/* Chart card placeholder */}
        <section>
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Chart Card (shell)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Super Balance Projection" icon="📈" subtitle="Conservative · Base · Optimistic">
              <div className="h-full flex items-center justify-center text-dashboard-muted text-sm">
                Chart.js chart rendered in Phase 3
              </div>
            </ChartCard>
            <ChartCard title="Debt Payoff Timeline" icon="💳">
              <div className="h-full flex items-center justify-center text-dashboard-muted text-sm">
                Chart.js chart rendered in Phase 3
              </div>
            </ChartCard>
          </div>
        </section>

        {/* Tab view */}
        <section>
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Tab View + Data Table
          </h2>
          <TabView tabs={TABS} defaultTab="super" />
        </section>

        {/* Drop zone */}
        <section>
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Drop Zone (Expense Tracker)
          </h2>
          <DropZone />
        </section>

        <footer className="text-center py-7 border-t border-dashboard-border mt-8">
          <p className="text-xs text-dashboard-muted leading-relaxed">
            RetireAU Dashboard — Phase 1 Scaffold · Spec pack at{' '}
            <code className="text-dashboard-accent">Dashboard_Website/</code>
          </p>
        </footer>
      </div>
    </div>
  );
}
