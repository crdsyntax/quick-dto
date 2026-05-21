import React from 'react';
import { MESSAGES } from '../constants/messages';

interface RetroBackgroundProps {
  isError: boolean;
}

export const RetroBackground: React.FC<RetroBackgroundProps> = ({ isError }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center opacity-35 pointer-events-none z-0">
      <div className={`relative flex flex-col items-center justify-center p-8 border-4 rounded-sm transition-colors duration-300 retro-pc-border`}>
        <div className="relative flex flex-col items-center justify-center w-80 h-56 border-4 bg-black p-4 shadow-inner retro-pc-border">
          <div className={`flex flex-col items-center space-y-4 tracking-widest font-bold text-4xl select-none retro-pc-border ${!isError ? 'animate-pulse' : 'animate-bounce'}`}>
            <span>{isError ? '[ > 益 < ]' : '[ ◕ ‿ ◕ ]'}</span>
            <span className="text-xs uppercase font-mono tracking-normal">
              {isError ? MESSAGES.FATAL_ERROR : MESSAGES.SYSTEM_READY}
            </span>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]"></div>
        </div>
        <div className="w-32 h-4 border-x-4 border-b-4 bg-zinc-900 retro-pc-border"></div>
        <div className="w-48 h-3 border-4 bg-zinc-800 rounded-sm retro-pc-border"></div>
      </div>
    </div>
  );
};
