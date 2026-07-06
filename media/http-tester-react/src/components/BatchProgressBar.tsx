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
    <div className="fixed top-0 left-0 right-0 bg-bgPanel/95 backdrop-blur-md border-b border-borderDark z-[100] shadow-card">
      <div className="max-w-[1170px] mx-auto w-full px-5 h-14 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-textMain animate-spin" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-textMain">
              {MESSAGES.BATCH_RUNNING}
            </span>
            <span className="text-xs text-textMuted">
              Progress: {progress.current} / {progress.total}
            </span>
          </div>
        </div>

        <button
          onClick={onStop}
          className="h-9 px-5 bg-textMain text-bgDark hover:bg-accentLight transition-colors rounded-lg text-xs font-semibold flex items-center gap-2 shadow-card"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          {MESSAGES.STOP_NOW}
        </button>
      </div>
      <div className="h-0.5 bg-textMain transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
    </div>
  );
};
