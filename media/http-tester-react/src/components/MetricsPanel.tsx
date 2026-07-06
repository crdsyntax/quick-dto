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
    <div className="flex flex-col gap-5 w-full">
      <div className="bg-bgPanel/40 border border-borderDark rounded-lg p-3 flex items-center gap-3 shadow-card">
        <Activity className="w-5 h-5 text-textMain" />
        <h2 className="text-sm font-semibold text-textMain">System telemetry & metrics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HTTP Metrics */}
        <div className="bg-bgPanel/30 border border-borderDark rounded-lg p-4 shadow-card flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-borderDark">
            <Globe className="w-4 h-4 text-textMuted" />
            <h3 className="text-xs font-medium text-textMuted">HTTP telemetry</h3>
          </div>

          {!hasHttp ? (
            <div className="text-textMuted italic flex items-center justify-center h-32 text-sm font-medium">
              No HTTP data recorded
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-textMuted">Last status</span>
                  <span className={`text-lg font-semibold ${isHttpError ? 'text-textMain' : 'text-textMain'}`}>
                    {httpResponse.status} {httpResponse.statusText}
                  </span>
                </div>
                <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-textMuted">Response time</span>
                  <span className="text-lg font-semibold text-textMain flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {httpTime}ms
                  </span>
                </div>
                <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-textMuted">Payload size</span>
                  <span className="text-lg font-semibold text-textMain flex items-center gap-1">
                    <Server className="w-4 h-4" /> {httpSize}KB
                  </span>
                </div>
                <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-textMuted">Method</span>
                  <span className="text-lg font-semibold text-textMain">
                    {httpState?.method || 'UNKNOWN'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-textMuted">Target endpoint</span>
                <div className="bg-bgDark/50 border border-borderDark rounded-lg p-2.5 text-sm text-textMain font-mono overflow-x-auto whitespace-nowrap">
                  {httpState?.url || 'N/A'}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-medium text-textMuted">
                  <span>Performance</span>
                  <span>{httpTime < 100 ? 'Excellent' : httpTime < 500 ? 'Good' : httpTime < 1500 ? 'Moderate' : 'Poor'}</span>
                </div>
                <div className="w-full h-2 bg-bgDark/60 border border-borderDark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-textMain rounded-full transition-all"
                    style={{ width: `${Math.max(5, 100 - (httpTime / 20))}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Socket Metrics */}
        <div className="bg-bgPanel/30 border border-borderDark rounded-lg p-4 shadow-card flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-borderDark">
            <Radio className="w-4 h-4 text-textMuted" />
            <h3 className="text-xs font-medium text-textMuted">Socket telemetry</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-textMuted">Status</span>
              <span className={`text-lg font-semibold ${isSocketConnected ? 'text-textMain' : 'text-textMuted'}`}>
                {socketStatus.text.toUpperCase()}
              </span>
            </div>
            <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-textMuted">Events received</span>
              <span className="text-lg font-semibold text-textMain flex items-center gap-1">
                <Activity className="w-4 h-4" /> {listenEventsCount}
              </span>
            </div>
            <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-textMuted">Connection logs</span>
              <span className="text-lg font-semibold text-textMain flex items-center gap-1">
                <Cpu className="w-4 h-4" /> {totalSocketLogs}
              </span>
            </div>
            <div className="bg-bgDark/50 border border-borderDark rounded-lg p-3 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-textMuted">Errors</span>
              <span className={`text-lg font-semibold flex items-center gap-1 ${socketErrorCount > 0 ? 'text-textMain' : 'text-textMain'}`}>
                <ShieldAlert className="w-4 h-4" /> {socketErrorCount}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-textMuted">Current host</span>
            <div className="bg-bgDark/50 border border-borderDark rounded-lg p-2.5 text-sm text-textMain font-mono overflow-x-auto whitespace-nowrap">
              {(connectionLogs.length > 0 && connectionLogs[connectionLogs.length - 1]?.message?.includes('http'))
                ? connectionLogs[connectionLogs.length - 1].message
                : 'No active URI logged or disconnected'}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-medium text-textMuted">
              <span>Connection health</span>
              <span>{isSocketConnected ? (socketErrorCount > 0 ? 'Unstable' : 'Stable') : 'Offline'}</span>
            </div>
            <div className="w-full h-2 bg-bgDark/60 border border-borderDark rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isSocketConnected ? 'bg-textMain w-full' : 'bg-transparent w-0'}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
