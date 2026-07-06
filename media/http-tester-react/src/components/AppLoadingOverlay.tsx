import React from 'react';
import { MESSAGES } from '../constants/messages';

export const AppLoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity">
      <div className="flex flex-col items-center gap-4 bg-bgPanel/80 px-8 py-6 border border-borderDark rounded-lg shadow-card">
        <div className="text-textMain font-semibold text-base">
          {MESSAGES.PROCESSING_REQUEST}
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-textMain rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-textMain rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-textMain rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
