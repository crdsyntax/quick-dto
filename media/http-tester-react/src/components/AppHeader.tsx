import React from 'react';
import { TerminalSquare } from 'lucide-react';
import { MESSAGES } from '../constants/messages';

export const AppHeader: React.FC = () => {
  return (
    <header className="flex items-center gap-4 pb-4 border-b border-borderDark">
      <div className="p-2 bg-bgPanel border border-borderDark rounded-lg">
        <TerminalSquare className="w-5 h-5 text-textMain" />
      </div>
      <div className="flex items-center gap-3 flex-1">
        <div>
          <h1 className="text-lg font-semibold text-textMain flex items-center gap-2">
            API Tester
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-bgPanel text-textMuted border border-borderDark rounded">v3.0.0</span>
          </h1>
          <p className="text-xs text-textMuted mt-0.5">{MESSAGES.INITIALIZING}</p>
        </div>
      </div>
    </header>
  );
};
