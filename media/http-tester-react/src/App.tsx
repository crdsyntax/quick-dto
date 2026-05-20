import React, { useState, useEffect } from 'react';
import { useVSCode } from './hooks/useVSCode';
import { HttpPanel } from './components/HttpPanel';
import { SocketPanel } from './components/SocketPanel';
import { CurlPanel } from './components/CurlPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { Collection, HttpResponse } from './types';
import { Globe, TerminalSquare, Terminal, Square, RefreshCw } from 'lucide-react';

interface SocketLog {
  time: string;
  message: string;
  type: 'event' | 'error' | 'info';
  eventName?: string;
}

const App: React.FC = () => {
  const { postMessage, getState, setState } = useVSCode();

  // App General State
  const [currentTab, setCurrentTab] = useState<'http' | 'socket' | 'metrics' | 'curl'>('http');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionName, setSelectedCollectionName] = useState('');
  const [globalToken, setGlobalToken] = useState('');
  const [globalRefreshToken, setGlobalRefreshToken] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collectionGroup, setCollectionGroup] = useState('');

  // HTTP State
  const [httpFormState, setHttpFormState] = useState<any>(null);
  const [httpResponse, setHttpResponse] = useState<HttpResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatProgress, setRepeatProgress] = useState({ current: 0, total: 0 });
  const [httpLoadId, setHttpLoadId] = useState(0);

  const triggerHttpLoad = (state: any) => {
    setHttpFormState(state);
    setHttpLoadId(prev => prev + 1);
  };

  // Socket State
  const [socketFormState, setSocketFormState] = useState<any>(null);
  const [socketStatus, setSocketStatus] = useState({ text: 'Disconnected', className: 'disconnected' });
  const [connectionLogs, setConnectionLogs] = useState<SocketLog[]>([]);
  const [listenLogs, setListenLogs] = useState<SocketLog[]>([]);
  const [socketLoadId, setSocketLoadId] = useState(0);

  const triggerSocketLoad = (state: any) => {
    setSocketFormState(state);
    setSocketLoadId(prev => prev + 1);
  };

  const isError = (httpResponse?.status && httpResponse.status >= 400) || socketStatus.className === 'error';

  useEffect(() => {
    document.body.dataset.status = isError ? 'error' : 'ready';
    if (isError) {
      document.body.classList.add('has-error');
    } else {
      document.body.classList.remove('has-error');
    }
  }, [isError]);

  // Restores original non-collection state on mount
  useEffect(() => {
    const savedState = getState();
    if (savedState) {
      setCollections(savedState.collections || []);
      // Restore HTTP State
      if (savedState.url) {
        triggerHttpLoad({
          url: savedState.url || '',
          method: savedState.method || 'GET',
          body: savedState.body || '',
          queryParams: savedState.queryParams || [],
          headers: savedState.headers || [],
          authType: savedState.authType || 'none',
          authToken: savedState.authToken || '',
          basicUsername: savedState.basicUsername || '',
          basicPassword: savedState.basicPassword || '',
        });
      }
    }
  }, []);

  const handleHttpStateChange = (state: any) => {
    setHttpFormState(state);
    
    const authHeader = state.headers?.find((h: any) => h.key?.toLowerCase() === 'authorization');
    if (authHeader && authHeader.value?.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.value.substring(7);
      setGlobalToken(token);
      postMessage('saveGlobalToken', { token });
    }

    setState({
      ...getState(),
      ...state,
      collections,
    });

    postMessage('saveLastRequest', { request: state });
  };

  const handleSocketStateChange = (state: any) => {
    setSocketFormState(state);
    postMessage('socketStateUpdate', { data: state });
  };

  const handleTokensDetected = (access: string, refresh?: string) => {
    if (access) {
      setGlobalToken(access);
      postMessage('saveGlobalToken', { token: access });
    }
    if (refresh) {
      setGlobalRefreshToken(refresh);
      postMessage('saveGlobalRefreshToken', { token: refresh });
    }
    postMessage('showToast', { message: '🔐 TOKENS DETECTADOS Y ALMACENADOS GLOBALMENTE' });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message) return;

      switch (message.command) {
        case 'response':
          setIsLoading(false);
          setHttpResponse(message.response);
          break;
        
        case 'error':
          setIsLoading(false);
          setIsRepeating(false);
          setHttpResponse({
            status: 500,
            statusText: 'Internal Error',
            time: 0,
            size: 0,
            data: message.message
          });
          break;

        case 'repeatProgress':
          setHttpResponse(message.response);
          setIsRepeating(true);
          setRepeatProgress({ current: message.current, total: message.total });
          break;

        case 'repeatComplete':
          setIsLoading(false);
          setIsRepeating(false);
          setRepeatProgress({ current: 0, total: 0 });
          const successCount = message.results.filter((r: any) => r.success).length;
          const failCount = message.results.filter((r: any) => !r.success).length;
          setHttpResponse((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              data: {
                ...prev.data,
                _summary: {
                  message: 'Repeat Request Summary Complete',
                  successful: successCount,
                  failed: failCount,
                  total: message.totalRequests,
                }
              }
            };
          });
          break;

        case 'stopLoading':
          setIsLoading(false);
          break;

        case 'socketLog':
          setConnectionLogs((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: message.message,
              type: message.type
            }
          ]);
          break;

        case 'socketListenLog':
          setListenLogs((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: message.message,
              eventName: message.eventName,
              type: 'info'
            }
          ]);
          break;

        case 'socketStatus':
          setSocketStatus({ text: message.status, className: message.className });
          break;

        case 'loadCollections':
          if (message.collections && Array.isArray(message.collections)) {
            const newHttp = message.collections.filter((c) => c.type === 'http');
            setCollections((prev) => {
              const cleaned = prev.filter((c) => c.type === 'socket');
              const next = [...cleaned, ...newHttp];
              postMessage('saveCollections', { collections: next });
              return next;
            });
            // Auto-load first one if present
            if (newHttp.length > 0) {
              setSelectedCollectionName(newHttp[0].name);
              triggerHttpLoad(newHttp[0]);
              setCollectionName(newHttp[0].name || '');
              setCollectionGroup(newHttp[0].group || '');
            }
          }
          break;

        case 'socketInitialState':
          if (message.state) {
            triggerSocketLoad(message.state);
          }
          setSocketStatus({ text: message.status.text, className: message.status.class });
          break;

        case 'loadGlobalToken':
          setGlobalToken(message.token || '');
          break;

        case 'loadGlobalRefreshToken':
          setGlobalRefreshToken(message.token || '');
          break;

        case 'importedCollections':
          if (message.collections && Array.isArray(message.collections)) {
            setCollections((prev) => {
              const next = [...prev];
              message.collections.forEach((col: Collection) => {
                const idx = next.findIndex((c) => c.name === col.name && c.type === col.type);
                if (idx === -1) {
                  next.push(col);
                }
              });
              postMessage('saveCollections', { collections: next });
              return next;
            });
            postMessage('showToast', { message: `✅ ${message.collections.length} COLECCIÓN(ES) IMPORTADA(S) EXITOSAMENTE.` });
          }
          break;

        case 'initializeCollections':
          if (message.collections && Array.isArray(message.collections)) {
            setCollections(message.collections);
            setSelectedCollectionName((prev) => {
              const exists = message.collections.some((c: Collection) => c.name === prev && c.type === currentTab);
              return exists ? prev : '';
            });
            if (message.lastRequest) {
              triggerHttpLoad(message.lastRequest);
              setCollectionName(message.lastRequest.name || '');
              setCollectionGroup(message.lastRequest.group || '');
            }
          }
          break;

        case 'loadRequest':
          if (message.request) {
            setCurrentTab('http');
            triggerHttpLoad(message.request);
            setCollectionName(message.request.name || '');
            setCollectionGroup(message.request.group || '');
            // Auto-send
            setIsLoading(true);
            postMessage('sendRequest', { request: message.request });
          }
          break;

        case 'loadCollection':
          if (message.collection) {
            setCurrentTab((message.collection.type === 'http' || message.collection.type === 'socket') ? message.collection.type : 'http');
            setSelectedCollectionName(message.collection.name);
            setCollectionName(message.collection.name || '');
            setCollectionGroup(message.collection.group || '');
            if (message.collection.type === 'http') {
              triggerHttpLoad(message.collection);
            } else {
              triggerSocketLoad(message.collection);
            }
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [postMessage, getState, setState, collections, currentTab, socketStatus.className, httpResponse?.status]);

  const handleCurlImport = (parsedRequest: any, autoRun: boolean) => {
    const mappedHeaders = Object.entries(parsedRequest.headers || {}).map(([key, value]) => ({
      key,
      value: String(value)
    }));

    if (!mappedHeaders.some(h => h.key.toLowerCase() === 'content-type') && parsedRequest.body) {
        mappedHeaders.push({ key: 'Content-Type', value: 'application/json' });
    }

    const state = {
      url: parsedRequest.url,
      method: parsedRequest.method,
      body: typeof parsedRequest.body === 'object' ? JSON.stringify(parsedRequest.body, null, 2) : String(parsedRequest.body || ''),
      headers: mappedHeaders,
      queryParams: parsedRequest.queryParams || [],
      authType: parsedRequest.authType || 'none',
      authToken: parsedRequest.authToken || '',
      basicUsername: parsedRequest.basicUsername || '',
      basicPassword: parsedRequest.basicPassword || '',
    };

    triggerHttpLoad(state);
    setCurrentTab('http');

    if (autoRun) {
      handleSendRequest(state);
    }
  };

  // HTTP Panel actions
  const handleSendRequest = (request: any, count?: number, delay?: number) => {
    setHttpResponse(null);

    // Map queryParams and headers arrays to objects for the extension backend
    const mappedHeaders = request.headers.reduce((acc: any, h: any) => {
      if (h.key) acc[h.key] = h.value;
      return acc;
    }, {});

    const mappedParams = request.queryParams.reduce((acc: any, p: any) => {
      if (p.key) {
        if (acc[p.key]) {
          acc[p.key] = Array.isArray(acc[p.key]) ? [...acc[p.key], p.value] : [acc[p.key], p.value];
        } else {
          acc[p.key] = p.value;
        }
      }
      return acc;
    }, {});

    const payload = {
      ...request,
      headers: mappedHeaders,
      queryParams: mappedParams,
    };

    if (payload.authType === 'global') {
      payload.authType = 'bearer';
      payload.authToken = globalToken;
    }

    if (count && count > 1) {
      setIsRepeating(true);
      setRepeatProgress({ current: 0, total: count });
      postMessage('repeatRequest', { request: payload, repeatCount: count, delay });
    } else {
      setIsLoading(true);
      postMessage('sendRequest', { request: payload });
    }
  };

  const handleStopRepeatedRequests = () => {
    setIsRepeating(false);
    postMessage('stopRepeatedRequests');
  };

  // Socket Panel actions
  const handleSocketConnect = (config: any) => {
    postMessage('socketConnect', { data: config });
  };

  const handleSocketDisconnect = () => {
    postMessage('socketDisconnect');
  };

  const handleSocketEmit = (name: string, payloadStr: string) => {
    postMessage('socketEmit', {
      data: { eventName: name, payload: payloadStr }
    });
  };

  const handleSocketListen = (name: string) => {
    postMessage('socketListen', { data: { eventName: name } });
  };

  const handleSaveCollection = () => {
    if (!collectionName) {
      postMessage('showToast', { message: '❌ POR FAVOR INGRESA UN NOMBRE PARA LA COLECCIÓN' });
      return;
    }

    let collectionData: any = {
      name: collectionName,
      group: collectionGroup,
    };

    if (currentTab === 'http') {
      collectionData = {
        ...collectionData,
        ...httpFormState,
        type: 'http',
      };
    } else if (currentTab === 'socket') {
      collectionData = {
        ...collectionData,
        ...socketFormState,
        type: 'socket',
      };
    } else {
      postMessage('showToast', { message: '❌ NO SE PUEDE GUARDAR COLECCIÓN EN ESTA PESTAÑA' });
      return;
    }

    postMessage('saveCollection', { collection: collectionData });
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 font-mono text-emerald-500 overflow-x-hidden">
      {/* Batch Progress Bar (Fixed at top, on top of everything) */}
      {isRepeating && (
        <div className="fixed top-0 left-0 right-0 h-16 bg-bgPanel/95 backdrop-blur-xl border-b-4 border-accentLight z-[100] flex items-center shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
          <div className="max-w-[1170px] mx-auto w-full px-5 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <RefreshCw className="w-6 h-6 text-accentLight animate-spin" />
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase text-accentLight tracking-widest">
                  &gt; BATCH_RUNNING
                </span>
                <span className="text-xs font-bold text-textMuted">
                  PROGRESS: {repeatProgress.current} / {repeatProgress.total}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleStopRepeatedRequests}
              className="px-8 py-2.5 bg-[#ff0000] text-white hover:bg-white hover:text-[#ff0000] transition-all font-black rounded-none text-xs uppercase flex items-center gap-3 border-2 border-[#ff0000] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]"
            >
              <Square className="w-4 h-4 fill-current" />
              STOP_NOW
            </button>
          </div>
          {/* Progress fill line at the absolute bottom of the fixed bar */}
          <div className="absolute bottom-0 left-0 h-1 bg-accentLight transition-all duration-300" style={{ width: `${(repeatProgress.current / repeatProgress.total) * 100}%` }} />
        </div>
      )}

      {/* Retro PC Background */}
      <div className="fixed inset-0 flex items-center justify-center opacity-35 pointer-events-none z-0">
        <div className={`relative flex flex-col items-center justify-center p-8 border-4 rounded-sm transition-colors duration-300 retro-pc-border`}>
          <div className="relative flex flex-col items-center justify-center w-80 h-56 border-4 bg-black p-4 shadow-inner retro-pc-border">
            <div className={`flex flex-col items-center space-y-4 tracking-widest font-bold text-4xl select-none retro-pc-border ${!isError ? 'animate-pulse' : 'animate-bounce'}`}>
              <span>{isError ? '[ > 益 < ]' : '[ ◕ ‿ ◕ ]'}</span>
              <span className="text-xs uppercase font-mono tracking-normal">{isError ? 'Fatal Error' : 'System Ready'}</span>
            </div>
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]"></div>
          </div>
          <div className="w-32 h-4 border-x-4 border-b-4 bg-zinc-900 retro-pc-border"></div>
          <div className="w-48 h-3 border-4 bg-zinc-800 rounded-sm retro-pc-border"></div>
        </div>
      </div>

      <div className="relative z-10 max-w-[1170px] mx-auto px-5 py-7 flex flex-col gap-5 selection:bg-textMain selection:text-bgDark">
        {/* Retro Header */}
        <header className="flex flex-col md:flex-row justify-between items-center border-b-2 border-borderDark pb-5 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-bgDark text-textMain border-2 border-borderDark rounded-none">
              <TerminalSquare className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-accentLight flex items-center gap-2">
                API_TESTER_TERMINAL
                <span className="text-[10px] py-0.5 px-1.5 bg-bgDark text-textMain border-2 border-borderDark font-bold rounded-none">v3.0.0</span>
              </h1>
              <p className="text-xs font-bold text-textMuted mt-1">&gt; INITIALIZING HTTP &amp; SOCKET INTERFACES...</p>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Sidebar controls removed - functionality moved to VS Code Sidebar */}
          </div>
        </header>

        {/* Save Collection Panel (Global) */}
        {(currentTab === 'http' || currentTab === 'socket') && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-bgPanel/20 backdrop-blur-md p-3.5 border-2 border-borderDark rounded-none">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-textMuted">COLLECTION NAME</label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g. Get Users List"
                className="p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-textMuted">GROUP NAME</label>
              <input
                type="text"
                value={collectionGroup}
                onChange={(e) => setCollectionGroup(e.target.value)}
                placeholder="e.g. User Management"
                className="p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
              />
            </div>
            <button
              onClick={handleSaveCollection}
              className="w-full h-[40px] bg-bgDark border-2 border-accentLight text-accentLight hover:bg-accentLight hover:text-bgDark transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4" />
              SAVE TO COLLECTION
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex gap-5 items-start">
          <main className="flex-grow flex flex-col gap-4 min-w-0">
            {/* Main Tabs */}
            <div className="flex border-b-2 border-borderDark">
              <button
                onClick={() => {
                  setCurrentTab('http');
                  setSelectedCollectionName('');
                }}
                className={`px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-all border-b-2 flex items-center gap-2 ${
                  currentTab === 'http'
                    ? 'border-textMain text-accentLight bg-bgPanel/20 backdrop-blur-md'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                &gt; HTTP_MODE
              </button>
              <button
                onClick={() => {
                  setCurrentTab('curl');
                  setSelectedCollectionName('');
                }}
                className={`px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-all border-b-2 flex items-center gap-2 ${
                  currentTab === 'curl'
                    ? 'border-textMain text-accentLight bg-bgPanel/20 backdrop-blur-md'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                &gt; CURL_MODE
              </button>
              <button
                onClick={() => {
                  setCurrentTab('socket');
                  setSelectedCollectionName('');
                  postMessage('socketGetInitialState');
                }}
                className={`px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-all border-b-2 flex items-center gap-2 ${
                  currentTab === 'socket'
                    ? 'border-textMain text-accentLight bg-bgPanel/20 backdrop-blur-md'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                &gt; SOCKET_MODE
              </button>
              <button
                onClick={() => {
                  setCurrentTab('metrics');
                  setSelectedCollectionName('');
                }}
                className={`px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-all border-b-2 flex items-center gap-2 ${
                  currentTab === 'metrics'
                    ? 'border-textMain text-accentLight bg-bgPanel/20 backdrop-blur-md'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                &gt; METRICS_MODE
              </button>
            </div>

            {/* Active Panel View */}
            <div className="transition-all duration-300">
              {currentTab === 'http' ? (
                <HttpPanel
                  initialState={httpFormState}
                  loadId={httpLoadId}
                  onSendRequest={handleSendRequest}
                  isLoading={isLoading}
                  isRepeating={isRepeating}
                  onStopRepeatedRequests={handleStopRepeatedRequests}
                  response={httpResponse}
                  globalToken={globalToken}
                  onStateChange={handleHttpStateChange}
                  onTokensDetected={handleTokensDetected}
                />
              ) : currentTab === 'curl' ? (
                <CurlPanel 
                  onImport={handleCurlImport}
                />
              ) : currentTab === 'socket' ? (
                <SocketPanel
                  initialState={socketFormState}
                  loadId={socketLoadId}
                  socketStatus={socketStatus}
                  onConnect={handleSocketConnect}
                  onDisconnect={handleSocketDisconnect}
                  onEmit={handleSocketEmit}
                  onListen={handleSocketListen}
                  connectionLogs={connectionLogs}
                  listenLogs={listenLogs}
                  onClearConnectionLogs={() => setConnectionLogs([])}
                  onClearListenLogs={() => setListenLogs([])}
                  onStateChange={handleSocketStateChange}
                />
              ) : (
                <MetricsPanel
                  httpState={httpFormState}
                  httpResponse={httpResponse}
                  socketStatus={socketStatus}
                  connectionLogs={connectionLogs}
                  listenLogs={listenLogs}
                />
              )}
            </div>
          </main>
        </div>

        {/* Loading Overlay (Only for single requests) */}
        {isLoading && !isRepeating && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity">
            <div className="flex flex-col items-center gap-4 bg-bgPanel/80 p-8 border-4 border-textMain rounded-none">
              <div className="text-textMain font-bold text-xl uppercase animate-pulse">&gt; PROCESSING REQUEST...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
