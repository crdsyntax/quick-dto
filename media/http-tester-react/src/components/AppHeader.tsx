import React from 'react';
import { TerminalSquare } from 'lucide-react';
import { MESSAGES } from '../constants/messages';

export const AppHeader: React.FC = () => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-center border-b-2 border-borderDark pb-5 gap-4">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-bgDark text-textMain border-2 border-borderDark rounded-none">
          <TerminalSquare className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-accentLight flex items-center gap-2">
            API_TESTER_TERMINAL
            <span className="text-[10px] py-0.5 px-1.5 bg-bgDark text-textMain border-2 border-borderDark font-bold rounded-none">v3.0.0</span>
          </h1>
          <p className="text-xs font-bold text-textMuted mt-1">{MESSAGES.INITIALIZING}</p>
        </div>
      </div>
    </header>
  );
};
