import React from 'react';

interface RetroBackgroundProps {
  status: number | null;
}

export const RetroBackground: React.FC<RetroBackgroundProps> = ({ status }) => {
  const getState = () => {
    if (status === null) return 'ready';
    if (status >= 500) return 'error';
    if (status >= 400) return 'warning';
    return 'ready';
  };

  const state = getState();

  const config = {
    ready: {
      face: '[◕‿◕]',
      label: 'System Ready',
      color: '#10b981',
      shadow: 'rgba(16, 185, 129, 0.25)',
      animate: 'animate-pulse',
    },
    warning: {
      face: '[>_<]',
      label: 'Warning',
      color: '#eab308',
      shadow: 'rgba(234, 179, 8, 0.25)',
      animate: 'animate-pulse',
    },
    error: {
      face: '[͡⎚͜͡⎚]',
      label: 'Critical Error',
      color: '#dc2626',
      shadow: 'rgba(220, 38, 38, 0.25)',
      animate: 'animate-bounce',
    },
  };

  const c = config[state];

  return (
    <div className="absolute top-2 right-0 opacity-40 pointer-events-none">
      <div
        className="relative flex flex-col items-center justify-center p-1.5 border rounded-sm"
        style={{ borderColor: c.color, boxShadow: `0 0 6px ${c.shadow}` }}
      >
        <div
          className="relative flex flex-col items-center justify-center w-[68px] h-[44px] border bg-black"
          style={{ borderColor: c.color }}
        >
          <div
            className={`flex flex-col items-center gap-0 select-none ${c.animate}`}
            style={{ color: c.color }}
          >
            <span className="text-[13px] leading-none font-bold tracking-normal">{c.face}</span>
            <span className="text-[5px] uppercase font-mono leading-none mt-0.5">{c.label}</span>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_2px]"></div>
        </div>
        <div className="w-7 h-[3px] border-x border-b bg-zinc-900" style={{ borderColor: c.color }}></div>
        <div className="w-11 h-[3px] border bg-zinc-800 rounded-sm" style={{ borderColor: c.color }}></div>
      </div>
    </div>
  );
};
