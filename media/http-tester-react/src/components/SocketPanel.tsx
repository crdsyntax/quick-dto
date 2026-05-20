import React, { useState, useEffect } from 'react';
import { SocketRequest } from '../types';
import { Power, Send, Radio, Terminal, Trash2 } from 'lucide-react';

interface SocketLog {
  time: string;
  message: string;
  type: 'event' | 'error' | 'info';
  eventName?: string;
}

interface SocketPanelProps {
  initialState?: any;
  loadId: number;
  socketStatus: { text: string; className: string };
  onConnect: (config: SocketRequest) => void;
  onDisconnect: () => void;
  onEmit: (eventName: string, payload: string) => void;
  onListen: (eventName: string) => void;
  connectionLogs: SocketLog[];
  listenLogs: SocketLog[];
  onClearConnectionLogs: () => void;
  onClearListenLogs: () => void;
  onStateChange: (state: any) => void;
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

  const isConnected = socketStatus.className === 'connected';

  // Sync state upward
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

  // Load external state ONLY when loadId changes
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
    <div className="flex flex-col gap-5 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-5 w-full items-start">
        {/* Left Column: Config */}
        <div className="bg-bgPanel/80 backdrop-blur-sm p-4 border-2 border-borderDark rounded-none flex flex-col gap-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-textMuted border-b-2 border-borderDark pb-2 flex items-center justify-between">
            <span>&gt; SOCKET.IO CONFIG</span>
            <span className="text-[9px] bg-accentLight text-bgDark px-1.5 rounded-none">V4.X+</span>
          </h2>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-textMuted flex items-center justify-between">
              URL
              <span className="text-[8px] lowercase italic opacity-70">http://domain.com</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isConnected}
              placeholder="http://localhost:3000"
              className="p-1.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-xs focus:border-accentLight focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-textMuted flex items-center justify-between">
              PATH
              <span className="text-[8px] lowercase italic opacity-70">default: /socket.io</span>
            </label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={isConnected}
              placeholder="/socket.io"
              className="p-1.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-xs focus:border-accentLight focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-textMuted">TRANSPORT PROTOCOL</label>
            <div className="grid grid-cols-3 border-2 border-borderDark rounded-none overflow-hidden h-8">
              {(['auto', 'websocket', 'polling'] as const).map((mode) => (
                <button
                  key={mode}
                  disabled={isConnected}
                  onClick={() => setTransportMode(mode)}
                  className={`text-[9px] font-bold uppercase transition flex items-center justify-center ${
                    transportMode === mode 
                      ? 'bg-textMain text-bgDark' 
                      : 'bg-bgDark text-textMuted hover:text-textMain'
                  } disabled:opacity-50`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-textMuted">AUTH TOKEN</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isConnected}
              placeholder="OPTIONAL TOKEN"
              className="p-1.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-xs focus:border-accentLight focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-textMuted">USER ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={isConnected}
              placeholder="OPTIONAL USER ID"
              className="p-1.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-xs focus:border-accentLight focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Action Button & Status */}
          <div className="flex flex-col gap-2.5 mt-3">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="py-2 w-full bg-bgDark border-2 border-textMain text-textMain hover:bg-textMain hover:text-bgDark font-bold rounded-none text-[10px] uppercase flex items-center justify-center gap-2 transition"
              >
                <Power className="w-3.5 h-3.5" />
                CONNECT
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="py-2 w-full bg-bgDark border-2 border-accentLight text-accentLight hover:bg-accentLight hover:text-bgDark font-bold rounded-none text-[10px] uppercase flex items-center justify-center gap-2 transition"
              >
                <Power className="w-3.5 h-3.5" />
                DISCONNECT
              </button>
            )}

            <div
              className={`w-full text-center py-1.5 px-2 border-2 rounded-none text-[10px] font-bold uppercase tracking-wider ${
                isConnected ? 'border-textMain text-accentLight bg-bgDark' : 'border-borderDark text-textMuted'
              }`}
            >
              STATUS: {socketStatus.text}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction area */}
        <div className="flex flex-col bg-bgDark/60 backdrop-blur-sm border-2 border-borderDark rounded-none overflow-hidden min-h-[450px]">
          {/* Sub tabs header */}
          <div className="flex bg-bgPanel/40 border-b-2 border-borderDark">
            <button
              onClick={() => setActiveTab('emit')}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase transition border-b-2 tracking-wider ${
                activeTab === 'emit'
                  ? 'border-textMain text-accentLight bg-bgDark'
                  : 'border-transparent text-textMuted hover:text-textMain'
              }`}
            >
              EMIT EVENT
            </button>
            <button
              onClick={() => setActiveTab('listen')}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase transition border-b-2 tracking-wider ${
                activeTab === 'listen'
                  ? 'border-textMain text-accentLight bg-bgDark'
                  : 'border-transparent text-textMuted hover:text-textMain'
              }`}
            >
              LISTEN EVENT
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase transition border-b-2 tracking-wider ${
                activeTab === 'logs'
                  ? 'border-textMain text-accentLight bg-bgDark'
                  : 'border-transparent text-textMuted hover:text-textMain'
              }`}
            >
              SOCKET LOGS
            </button>
          </div>

          {/* Sub tab content */}
          <div className="p-4 flex-grow flex flex-col">
            {/* Tab: Emit */}
            {activeTab === 'emit' && (
              <div className="flex flex-col gap-3.5 flex-grow">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-textMuted">EVENT NAME</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. newMessage"
                    className="p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-xs focus:border-accentLight focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 flex-grow">
                  <label className="text-[10px] font-bold uppercase text-textMuted">PAYLOAD (JSON)</label>
                  <textarea
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="{}"
                    className="w-full flex-grow min-h-[180px] p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-xs focus:border-accentLight focus:outline-none resize-y"
                  />
                </div>

                <button
                  onClick={() => onEmit(eventName, payload)}
                  disabled={!isConnected}
                  className="mt-2 py-2 px-4 bg-bgDark border-2 border-textMain text-textMain hover:bg-textMain hover:text-bgDark disabled:opacity-50 transition font-bold rounded-none text-[10px] uppercase flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  EMIT EVENT
                </button>
              </div>
            )}

            {/* Tab: Listen */}
            {activeTab === 'listen' && (
              <div className="flex flex-col gap-3.5 flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px] gap-2.5 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-textMuted">EVENT NAME LISTENER</label>
                    <input
                      type="text"
                      value={listenEventName}
                      onChange={(e) => setListenEventName(e.target.value)}
                      placeholder="e.g. message"
                      className="p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-xs focus:border-accentLight focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => onListen(listenEventName)}
                    disabled={!isConnected}
                    className="py-2 bg-bgDark border-2 border-textMain text-textMain hover:bg-textMain hover:text-bgDark disabled:opacity-50 transition font-bold rounded-none text-[10px] uppercase flex items-center justify-center gap-1"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    ESCUCHAR
                  </button>
                  <button
                    onClick={onClearListenLogs}
                    disabled={listenLogs.length === 0}
                    className="py-2 bg-bgDark border-2 border-borderDark hover:border-textMain disabled:opacity-40 text-textMain transition font-bold rounded-none text-[10px] uppercase flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    LIMPIAR
                  </button>
                </div>

                {/* Logs area */}
                <div className="border-2 border-borderDark rounded-none bg-bgDark/40 flex-grow h-[240px] overflow-y-auto p-3.5 flex flex-col gap-2 text-[11px]">
                  {listenLogs.length === 0 ? (
                    <div className="text-textMuted italic text-center my-auto flex flex-col items-center justify-center gap-2 font-bold uppercase opacity-60">
                      <Radio className="w-5 h-5 animate-pulse" />
                      ESCUCHANDO...
                    </div>
                  ) : (
                    listenLogs.map((log, i) => (
                      <div key={i} className="border-b border-borderDark pb-2">
                        <span className="text-textMuted">[{log.time}]</span>{' '}
                        <span className="text-accentLight font-bold">[EVENT: {log.eventName}]</span>
                        <pre className="text-textMain mt-1 pl-3 whitespace-pre-wrap">{log.message}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Logs */}
            {activeTab === 'logs' && (
              <div className="flex flex-col gap-3.5 flex-grow">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-bold uppercase text-textMuted">CONNECTION LOGS</h3>
                  <button
                    onClick={onClearConnectionLogs}
                    disabled={connectionLogs.length === 0}
                    className="py-1 px-2.5 bg-bgPanel/40 border-2 border-borderDark hover:border-textMain disabled:opacity-40 text-textMain transition font-bold rounded-none text-[9px] uppercase flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> LIMPIAR
                  </button>
                </div>

                {/* Logs area */}
                <div className="border-2 border-borderDark rounded-none bg-bgDark/40 flex-grow h-[240px] overflow-y-auto p-3.5 flex flex-col gap-1.5 text-[11px] text-textMain">
                  {connectionLogs.length === 0 ? (
                    <div className="text-textMuted italic text-center my-auto flex flex-col items-center justify-center gap-2 uppercase font-bold opacity-60">
                      <Terminal className="w-5 h-5" />
                      NO LOGS.
                    </div>
                  ) : (
                    connectionLogs.map((log, i) => (
                      <div key={i} className={`py-1 border-b border-borderDark last:border-b-0 ${
                        log.type === 'error' ? 'text-accentLight border-l-2 border-l-textMain pl-2' : 'text-textMain'
                      }`}>
                        <span className="text-textMuted mr-2">[{log.time}]</span>
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
