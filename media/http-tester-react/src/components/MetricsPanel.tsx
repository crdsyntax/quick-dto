import React from 'react';
import { HttpResponse, SocketStatus } from '../types';
import { Activity, Globe, Radio, Server, Clock, ShieldAlert, Cpu } from 'lucide-react';
import { SocketStatusClass } from '../enums';

interface MetricsPanelProps {
  httpState: any;
  httpResponse: HttpResponse | null;
  socketStatus: SocketStatus;
  connectionLogs: any[];
  listenLogs: any[];
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  httpState,
  httpResponse,
  socketStatus,
  connectionLogs,
  listenLogs
}) => {
  const hasHttp = !!httpResponse;
  const httpTime = hasHttp ? httpResponse.time : 0;
  const httpSize = hasHttp ? (httpResponse.size / 1024).toFixed(2) : '0.00';
  const isHttpError = hasHttp && httpResponse.status >= 400;

  const isSocketConnected = socketStatus.className === SocketStatusClass.CONNECTED;
  const socketErrorCount = connectionLogs.filter(l => l.type === 'error').length;
  const totalSocketLogs = connectionLogs.length;
  const listenEventsCount = listenLogs.length;

  return (
    <div className="flex flex-col gap-6 w-full font-mono">
      <div className="bg-bgPanel/80 backdrop-blur-sm border-2 border-borderDark p-4 flex items-center gap-3 shadow-retro-dark">
        <Activity className="w-6 h-6 text-accentLight" />
        <h2 className="text-xl font-bold uppercase text-accentLight">System Telemetry & Metrics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* HTTP Metrics */}
        <div className="bg-bgDark/60 backdrop-blur-sm border-2 border-borderDark rounded-none p-5 shadow-retro-dark flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b-2 border-borderDark pb-2">
            <Globe className="w-5 h-5 text-textMuted" />
            <h3 className="text-sm font-bold uppercase text-textMuted">&gt; HTTP_TELEMETRY</h3>
          </div>

          {!hasHttp ? (
            <div className="text-textMuted italic flex items-center justify-center h-40 font-bold uppercase">
              NO HTTP DATA RECORDED
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-textMuted">LAST STATUS</span>
                  <span className={`text-xl font-bold ${isHttpError ? 'text-textMain' : 'text-accentLight'}`}>
                    {httpResponse.status} {httpResponse.statusText}
                  </span>
                </div>
                <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-textMuted">RESPONSE TIME</span>
                  <span className="text-xl font-bold text-accentLight flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {httpTime}ms
                  </span>
                </div>
                <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-textMuted">PAYLOAD SIZE</span>
                  <span className="text-xl font-bold text-accentLight flex items-center gap-1">
                    <Server className="w-4 h-4" /> {httpSize}KB
                  </span>
                </div>
                <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-textMuted">METHOD</span>
                  <span className="text-xl font-bold text-accentLight">
                    {httpState?.method || 'UNKNOWN'}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-textMuted">TARGET ENDPOINT</span>
                <div className="bg-bgPanel/40 border-2 border-borderDark p-3 text-xs text-accentLight overflow-x-auto whitespace-nowrap">
                  {httpState?.url || 'N/A'}
                </div>
              </div>

              {/* Pseudo-visual performance bar */}
              <div className="mt-4 flex flex-col gap-1">
                <div className="flex justify-between text-[10px] uppercase font-bold text-textMuted">
                  <span>Performance Rating</span>
                  <span>{httpTime < 100 ? 'EXCELLENT' : httpTime < 500 ? 'GOOD' : httpTime < 1500 ? 'MODERATE' : 'POOR'}</span>
                </div>
                <div className="w-full h-4 bg-bgPanel/40 border-2 border-borderDark flex">
                  <div 
                    className="h-full bg-textMain transition-all" 
                    style={{ width: `${Math.max(5, 100 - (httpTime / 20))}%` }} 
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Socket Metrics */}
        <div className="bg-bgDark/60 backdrop-blur-sm border-2 border-borderDark rounded-none p-5 shadow-retro-dark flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b-2 border-borderDark pb-2">
            <Radio className="w-5 h-5 text-textMuted" />
            <h3 className="text-sm font-bold uppercase text-textMuted">&gt; SOCKET_TELEMETRY</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-textMuted">STATUS</span>
              <span className={`text-xl font-bold ${isSocketConnected ? 'text-accentLight' : 'text-textMuted'}`}>
                {socketStatus.text.toUpperCase()}
              </span>
            </div>
            <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-textMuted">LISTEN EVENTS RECVD</span>
              <span className="text-xl font-bold text-accentLight flex items-center gap-1">
                <Activity className="w-4 h-4" /> {listenEventsCount}
              </span>
            </div>
            <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-textMuted">TOTAL CONNECTION LOGS</span>
              <span className="text-xl font-bold text-accentLight flex items-center gap-1">
                <Cpu className="w-4 h-4" /> {totalSocketLogs}
              </span>
            </div>
            <div className="bg-bgPanel/40 border-2 border-borderDark p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-textMuted">ERRORS ENCOUNTERED</span>
              <span className={`text-xl font-bold flex items-center gap-1 ${socketErrorCount > 0 ? 'text-textMain' : 'text-accentLight'}`}>
                <ShieldAlert className="w-4 h-4" /> {socketErrorCount}
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <span className="text-[10px] uppercase font-bold text-textMuted">CURRENT SOCKET HOST</span>
            <div className="bg-bgPanel/40 border-2 border-borderDark p-3 text-xs text-accentLight overflow-x-auto whitespace-nowrap">
              {(connectionLogs.length > 0 && connectionLogs[connectionLogs.length - 1]?.message?.includes('http')) 
                ? connectionLogs[connectionLogs.length - 1].message 
                : 'No active URI logged or disconnected'}
            </div>
          </div>

          {/* Health bar */}
          <div className="mt-4 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] uppercase font-bold text-textMuted">
              <span>Connection Health</span>
              <span>{isSocketConnected ? (socketErrorCount > 0 ? 'UNSTABLE' : 'STABLE') : 'OFFLINE'}</span>
            </div>
            <div className="w-full h-4 bg-bgPanel/40 border-2 border-borderDark flex">
              <div 
                className={`h-full transition-all ${isSocketConnected ? 'bg-textMain w-full' : 'bg-transparent w-0'}`} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
