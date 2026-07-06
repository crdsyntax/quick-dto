import React from 'react';
import { Terminal } from 'lucide-react';
import { AppTab } from '../enums';

interface TabNavigationProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: AppTab.HTTP, label: 'HTTP' },
    { id: AppTab.CURL, label: 'CURL', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: AppTab.SOCKET, label: 'Socket' },
    { id: AppTab.METRICS, label: 'Metrics' },
  ];

  return (
    <div className="flex gap-0.5 bg-bgPanel/60 border border-borderDark rounded-lg p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-4 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
            currentTab === tab.id
              ? 'bg-bgDark text-textMain shadow-card'
              : 'text-textMuted hover:text-textMain'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
};
