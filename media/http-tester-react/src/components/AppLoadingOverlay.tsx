import React from 'react';
import { MESSAGES } from '../constants/messages';

export const AppLoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity">
      <div className="flex flex-col items-center gap-4 bg-bgPanel/80 p-8 border-4 border-textMain rounded-none">
        <div className="text-textMain font-bold text-xl uppercase animate-pulse">
          {MESSAGES.PROCESSING_REQUEST}
        </div>
      </div>
    </div>
  );
};
