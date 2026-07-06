import React, { useState, useEffect } from 'react';
import { SocketRequest, SocketLog, SocketStatus } from '../types';
import { SocketStatusClass } from '../enums';
import { Power, Send, Radio, Terminal, Trash2, Download } from 'lucide-react';

interface SocketPanelProps {
  initialState?: any;
  loadId: number;
  socketStatus: SocketStatus;
  onConnect: (config: SocketRequest) => void;
  onDisconnect: () => void;
  onEmit: (eventName: string, payload: string) => void;
  onListen: (eventName: string) => void;
  connectionLogs: SocketLog[];
  listenLogs: SocketLog[];
  onClearConnectionLogs: () => void;
  onClearListenLogs: () => void;
  onStateChange: (state: any) => void;
  onExportJson?: () => void;
}

export const SocketPanel: React.FC<SocketPanelProps> = ({
  initialState,
  loadId,
  socketStatus,
  onConnect,
  onDisconnect,
  onEmit,
  onListen,
  connectionLogs,
  listenLogs,
  onClearConnectionLogs,
  onClearListenLogs,
  onStateChange,
  onExportJson,
}) => {
  const [url, setUrl] = useState('http://localhost:3000');
  const [path, setPath] = useState('/socket.io');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [eventName, setEventName] = useState('message');
  const [payload, setPayload] = useState('{}');
  const [transportMode, setTransportMode] = useState<'auto' | 'websocket' | 'polling'>('auto');
  const [listenEventName, setListenEventName] = useState('message');
  const [activeTab, setActiveTab] = useState<'emit' | 'listen' | 'logs'>('emit');

  const isConnected = socketStatus.className === SocketStatusClass.CONNECTED;

  useEffect(() => {
    onStateChange({
      url,
      path,
      token,
      userId,
      eventName,
      payload,
      transports: transportMode === 'auto' ? ['polling', 'websocket'] : [transportMode],
    });
  }, [url, path, token, userId, eventName, payload, transportMode]);

  useEffect(() => {
    if (initialState) {
      setUrl(initialState.url || 'http://localhost:3000');
      setPath(initialState.path || '/socket.io');
      setToken(initialState.token || '');
      setUserId(initialState.userId || '');
      setEventName(initialState.eventName || 'message');
      setPayload(initialState.payload || '{}');

      const transports = initialState.transports || [];
      if (transports.length === 2) setTransportMode('auto');
      else if (transports[0] === 'websocket') setTransportMode('websocket');
      else if (transports[0] === 'polling') setTransportMode('polling');
      else setTransportMode('auto');
    }
  }, [loadId]);

  const handleConnect = () => {
    onConnect({
      url,
      path,
      token,
      userId,
      eventName,
      payload,
      transports: transportMode === 'auto' ? ['polling', 'websocket'] : [transportMode],
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 w-full items-start">
        {/* Left Column: Config */}
        <div className="bg-bgPanel/40 border border-borderDark rounded-lg p-4 flex flex-col gap-3 shadow-card">
          <div className="flex items-center justify-between pb-2 border-b border-borderDark">
            <span className="text-xs font-medium text-textMuted">Socket.IO config</span>
            <span className="text-[10px] bg-bgDark text-textMuted border border-borderDark px-1.5 py-0.5 rounded">v4.x+</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isConnected}
              placeholder="http://localhost:3000"
              className="px-2.5 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors disabled:opacity-40 placeholder:text-textMuted/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">Path</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={isConnected}
              placeholder="/socket.io"
              className="px-2.5 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors disabled:opacity-40 placeholder:text-textMuted/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">Transport</label>
            <div className="flex gap-1 bg-bgDark border border-borderDark rounded-lg p-0.5">
              {(['auto', 'websocket', 'polling'] as const).map((mode) => (
                <button
                  key={mode}
                  disabled={isConnected}
                  onClick={() => setTransportMode(mode)}
                  className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all ${
                    transportMode === mode
                      ? 'bg-bgPanel text-textMain shadow-card'
                      : 'text-textMuted hover:text-textMain'
                  } disabled:opacity-40`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">Auth token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isConnected}
              placeholder="Optional token"
              className="px-2.5 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors disabled:opacity-40 placeholder:text-textMuted/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={isConnected}
              placeholder="Optional user ID"
              className="px-2.5 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors disabled:opacity-40 placeholder:text-textMuted/50"
            />
          </div>

          <div className="flex flex-col gap-2 mt-2">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="py-2 w-full bg-bgDark border border-textMain text-textMain hover:bg-textMain hover:text-bgDark transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Power className="w-3.5 h-3.5" />
                Connect
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="py-2 w-full bg-bgDark border border-textMain text-textMain hover:bg-textMain hover:text-bgDark transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Power className="w-3.5 h-3.5" />
                Disconnect
              </button>
            )}

            <div className={`w-full text-center py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
              isConnected ? 'border-textMain/50 text-textMain bg-bgDark/60' : 'border-borderDark text-textMuted bg-bgDark/30'
            }`}>
              Status: {socketStatus.text}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction area */}
        <div className="flex flex-col bg-bgPanel/20 border border-borderDark rounded-lg overflow-hidden shadow-card min-h-[400px]">
          {/* Sub tabs header */}
          <div className="flex gap-1 bg-bgPanel/30 border-b border-borderDark p-2">
            {(['emit', 'listen', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === tab
                    ? 'bg-bgDark text-textMain shadow-card'
                    : 'text-textMuted hover:text-textMain'
                }`}
              >
                {tab === 'emit' ? 'Emit event' : tab === 'listen' ? 'Listen event' : 'Socket logs'}
              </button>
            ))}
          </div>

          {/* Sub tab content */}
          <div className="p-4 flex-grow flex flex-col">
            {/* Tab: Emit */}
            {activeTab === 'emit' && (
              <div className="flex flex-col gap-3 flex-grow">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-textMuted">Event name</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. newMessage"
                    className="px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                  />
                </div>

                <div className="flex flex-col gap-1 flex-grow">
                  <label className="text-xs font-medium text-textMuted">Payload (JSON)</label>
                  <textarea
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="{}"
                    className="w-full flex-grow min-h-[180px] px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain font-mono focus:border-textMuted transition-colors resize-y placeholder:text-textMuted/50"
                  />
                </div>

                <button
                  onClick={() => onEmit(eventName, payload)}
                  disabled={!isConnected}
                  className="mt-1 py-2 px-4 bg-bgDark border border-textMain text-textMain hover:bg-textMain hover:text-bgDark disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 self-start"
                >
                  <Send className="w-3.5 h-3.5" />
                  Emit event
                </button>
              </div>
            )}

            {/* Tab: Listen */}
            {activeTab === 'listen' && (
              <div className="flex flex-col gap-3 flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-textMuted">Event name</label>
                    <input
                      type="text"
                      value={listenEventName}
                      onChange={(e) => setListenEventName(e.target.value)}
                      placeholder="e.g. message"
                      className="px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                    />
                  </div>
                  <button
                    onClick={() => onListen(listenEventName)}
                    disabled={!isConnected}
                    className="py-1.5 bg-bgDark border border-textMain text-textMain hover:bg-textMain hover:text-bgDark disabled:opacity-40 transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    Listen
                  </button>
                  <button
                    onClick={onClearListenLogs}
                    disabled={listenLogs.length === 0}
                    className="py-1.5 bg-bgDark border border-borderDark text-textMuted hover:border-textMuted disabled:opacity-40 transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>

                <div className="border border-borderDark rounded-lg bg-bgDark/40 flex-grow h-[240px] overflow-y-auto p-3.5 flex flex-col gap-2 text-xs">
                  {listenLogs.length === 0 ? (
                    <div className="text-textMuted italic text-center my-auto flex flex-col items-center justify-center gap-2 font-medium opacity-60">
                      <Radio className="w-5 h-5" />
                      Listening...
                    </div>
                  ) : (
                    listenLogs.map((log, i) => (
                      <div key={i} className="border-b border-borderDark/50 pb-1.5 last:border-0">
                        <span className="text-textMuted text-[11px]">[{log.time}]</span>{' '}
                        <span className="text-textMain font-medium text-[11px]">[Event: {log.eventName}]</span>
                        <pre className="text-textMain text-xs mt-0.5 pl-3 whitespace-pre-wrap font-mono">{log.message}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Logs */}
            {activeTab === 'logs' && (
              <div className="flex flex-col gap-3 flex-grow">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-textMuted">Connection logs</p>
                  <div className="flex gap-2">
                    {onExportJson && (
                      <button
                        type="button"
                        onClick={onExportJson}
                        disabled={connectionLogs.length === 0 && listenLogs.length === 0}
                        className="py-1 px-2.5 bg-bgDark/40 border border-borderDark hover:border-textMuted disabled:opacity-40 text-textMain transition-colors rounded-lg text-[11px] font-medium flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Export JSON
                      </button>
                    )}
                    <button
                      onClick={onClearConnectionLogs}
                      disabled={connectionLogs.length === 0}
                      className="py-1 px-2.5 bg-bgDark/40 border border-borderDark hover:border-textMuted disabled:opacity-40 text-textMain transition-colors rounded-lg text-[11px] font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  </div>
                </div>

                <div className="border border-borderDark rounded-lg bg-bgDark/40 flex-grow h-[240px] overflow-y-auto p-3.5 flex flex-col gap-1.5 text-xs text-textMain">
                  {connectionLogs.length === 0 ? (
                    <div className="text-textMuted italic text-center my-auto flex flex-col items-center justify-center gap-2 font-medium opacity-60">
                      <Terminal className="w-5 h-5" />
                      No logs.
                    </div>
                  ) : (
                    connectionLogs.map((log, i) => (
                      <div key={i} className={`py-1 border-b border-borderDark/50 last:border-0 ${
                        log.type === 'error' ? 'text-textMain pl-2 border-l-2 border-l-textMain' : 'text-textMain'
                      }`}>
                        <span className="text-textMuted mr-1">[{log.time}]</span>
                        {log.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
