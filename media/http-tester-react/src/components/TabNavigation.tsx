import React from 'react';
import { Terminal } from 'lucide-react';
import { AppTab } from '../enums';

interface TabNavigationProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: AppTab.HTTP, label: 'HTTP_MODE' },
    { id: AppTab.CURL, label: 'CURL_MODE', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: AppTab.SOCKET, label: 'SOCKET_MODE' },
    { id: AppTab.METRICS, label: 'METRICS_MODE' },
  ];

  return (
    <div className="flex border-b-2 border-borderDark">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-all border-b-2 flex items-center gap-2 ${
            currentTab === tab.id
              ? 'border-textMain text-accentLight bg-bgPanel/20 backdrop-blur-md'
              : 'border-transparent text-textMuted hover:text-textMain'
          }`}
        >
          {tab.icon}
          &gt; {tab.label}
        </button>
      ))}
    </div>
  );
};
