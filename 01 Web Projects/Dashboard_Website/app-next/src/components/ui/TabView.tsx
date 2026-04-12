'use client';

// docs/04-css-design-system.md §Tabs
// docs/03-frontend-components.md §TabView

import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabViewProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (id: string) => void;
}

export default function TabView({ tabs, defaultTab, onTabChange }: TabViewProps) {
  const [activeId, setActiveId] = useState(defaultTab ?? tabs[0]?.id ?? '');

  function handleTab(id: string) {
    setActiveId(id);
    onTabChange?.(id);
  }

  const activeContent = tabs.find((t) => t.id === activeId)?.content;

  return (
    <div>
      {/* Tab row */}
      <div className="flex flex-wrap gap-0">
        {tabs.map((tab, i) => {
          const isActive = tab.id === activeId;
          const isFirst = i === 0;
          const isLast = i === tabs.length - 1;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={[
                'px-[18px] py-[10px] text-sm font-semibold border transition-all duration-200 cursor-pointer',
                isFirst ? 'rounded-tl-input' : '',
                isLast ? 'rounded-tr-input' : '',
                isActive
                  ? 'bg-dashboard-surface text-dashboard-accent border-dashboard-border border-b-dashboard-surface'
                  : 'bg-dashboard-surface2 text-dashboard-muted border-dashboard-border hover:opacity-80',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Content area */}
      <div className="border border-t-0 border-dashboard-border bg-dashboard-surface p-5 rounded-b-card">
        {activeContent}
      </div>
    </div>
  );
}
