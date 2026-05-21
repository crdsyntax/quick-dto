import React from 'react';
import { Square, RefreshCw } from 'lucide-react';
import { MESSAGES } from '../constants/messages';
import { RepeatProgress } from '../types';

interface BatchProgressBarProps {
  progress: RepeatProgress;
  onStop: () => void;
}

export const BatchProgressBar: React.FC<BatchProgressBarProps> = ({ progress, onStop }) => {
  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-bgPanel/95 backdrop-blur-xl border-b-4 border-accentLight z-[100] flex items-center shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
      <div className="max-w-[1170px] mx-auto w-full px-5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <RefreshCw className="w-6 h-6 text-accentLight animate-spin" />
          <div className="flex flex-col">
            <span className="text-sm font-black uppercase text-accentLight tracking-widest">
              {MESSAGES.BATCH_RUNNING}
            </span>
            <span className="text-xs font-bold text-textMuted">
              PROGRESS: {progress.current} / {progress.total}
            </span>
          </div>
        </div>
        
        <button
          onClick={onStop}
          className="px-8 py-2.5 bg-[#ff0000] text-white hover:bg-white hover:text-[#ff0000] transition-all font-black rounded-none text-xs uppercase flex items-center gap-3 border-2 border-[#ff0000] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]"
        >
          <Square className="w-4 h-4 fill-current" />
          {MESSAGES.STOP_NOW}
        </button>
      </div>
      <div className="absolute bottom-0 left-0 h-1 bg-accentLight transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
    </div>
  );
};
