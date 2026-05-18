import React, { useState, useEffect } from 'react';
import { useVSCode } from './hooks/useVSCode';
import { Sidebar } from './components/Sidebar';
import { HttpPanel } from './components/HttpPanel';
import { SocketPanel } from './components/SocketPanel';
import { CurlPanel } from './components/CurlPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { Collection, HttpResponse } from './types';
import { Globe, TerminalSquare, Terminal } from 'lucide-react';

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
  const [showSidebar, setShowSidebar] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionName, setSelectedCollectionName] = useState('');
  const [globalToken, setGlobalToken] = useState('');

  // HTTP State
  const [httpFormState, setHttpFormState] = useState<any>(null);
  const [httpResponse, setHttpResponse] = useState<HttpResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
          // Show iteration inside text UI helper
          break;

        case 'repeatComplete':
          setIsLoading(false);
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
            }
          }
          break;

        case 'loadRequest':
          if (message.request) {
            setCurrentTab('http');
            triggerHttpLoad(message.request);
            // Auto-send
            setIsLoading(true);
            postMessage('sendRequest', { request: message.request });
          }
          break;

        case 'loadCollection':
          if (message.collection) {
            setCurrentTab((message.collection.type === 'http' || message.collection.type === 'socket') ? message.collection.type : 'http');
            setSelectedCollectionName(message.collection.name);
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
  }, [postMessage, getState, setState, collections]);

  // Sidebar controls
  const handleSelectCollection = (name: string) => {
    setSelectedCollectionName(name);
    const col = collections.find((c) => c.name === name && c.type === currentTab);
    if (col) {
      if (currentTab === 'http') {
        triggerHttpLoad(col);
      } else {
        triggerSocketLoad(col);
      }
      postMessage('showToast', { message: `COLECCIÓN '${name}' (${currentTab.toUpperCase()}) CARGADA.` });
    }
  };

  const handleSaveCollection = (name: string) => {
    const currentState = currentTab === 'http' ? httpFormState : socketFormState;
    const newCollection: Collection = {
      name,
      type: currentTab,
      ...currentState,
    };

    setCollections((prev) => {
      const idx = prev.findIndex((c) => c.name === name && c.type === currentTab);
      const next = [...prev];
      if (idx !== -1) {
        next[idx] = newCollection;
      } else {
        next.push(newCollection);
      }
      postMessage('saveCollections', { collections: next });
      return next;
    });

    postMessage('showToast', { message: `COLECCIÓN '${name}' (${currentTab.toUpperCase()}) GUARDADA.` });
  };

  const handleDeleteCollection = (name: string) => {
    if (!name) return;
    postMessage('deleteCollection', { name, type: currentTab });
  };

  const handleClearCollections = () => {
    postMessage('clearCollections', { type: currentTab });
  };

  const handleImportJson = () => {
    postMessage('importJson', { type: currentTab });
  };

  const handleExportJson = () => {
    postMessage('exportJson', { type: currentTab, collections });
  };

  const handleDetectSwagger = () => {
    postMessage('detectSwagger');
    setIsLoading(true);
  };

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
  const handleSendRequest = (request: any, count?: number) => {
    setIsLoading(true);
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
      postMessage('repeatRequest', { request: payload, repeatCount: count });
    } else {
      postMessage('sendRequest', { request: payload });
    }
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

  return (
    <div className="max-w-[1300px] mx-auto px-6 py-8 flex flex-col gap-6 font-mono selection:bg-textMain selection:text-bgDark">
      {/* Retro Header */}
      <header className="flex flex-col md:flex-row justify-between items-center border-b-4 border-borderDark pb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-textMain text-bgDark rounded-none shadow-retro">
            <TerminalSquare className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-accentLight flex items-center gap-3">
              API_TESTER_TERMINAL
              <span className="text-xs py-1 px-2 bg-bgDark text-textMain border-2 border-borderDark font-bold rounded-none">v3.0.0</span>
            </h1>
            <p className="text-sm font-bold text-textMuted mt-1">&gt; INITIALIZING HTTP &amp; SOCKET INTERFACES...</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-5 py-2.5 bg-bgDark border-2 border-borderDark hover:bg-textMain hover:text-bgDark text-textMain transition font-bold rounded-none text-xs uppercase"
          >
            {showSidebar ? 'OCULTAR SIDEBAR [X]' : 'MOSTRAR SIDEBAR [ ]'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex gap-6 items-start">
        {showSidebar && (
          <Sidebar
            collections={collections}
            currentTab={currentTab}
            selectedCollectionName={selectedCollectionName}
            onSelectCollection={handleSelectCollection}
            onSaveCollection={handleSaveCollection}
            onDeleteCollection={handleDeleteCollection}
            onClearCollections={handleClearCollections}
            onImportJson={handleImportJson}
            onExportJson={handleExportJson}
            onDetectSwagger={handleDetectSwagger}
          />
        )}

        <main className="flex-grow flex flex-col gap-5 min-w-0">
          {/* Main Tabs */}
          <div className="flex border-b-4 border-borderDark">
            <button
              onClick={() => {
                setCurrentTab('http');
                setSelectedCollectionName('');
              }}
              className={`px-6 py-3 font-bold uppercase tracking-wider text-sm transition-all border-b-4 flex items-center gap-2 ${
                currentTab === 'http'
                  ? 'border-textMain text-accentLight bg-bgPanel'
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
              className={`px-6 py-3 font-bold uppercase tracking-wider text-sm transition-all border-b-4 flex items-center gap-2 ${
                currentTab === 'curl'
                  ? 'border-textMain text-accentLight bg-bgPanel'
                  : 'border-transparent text-textMuted hover:text-textMain'
              }`}
            >
              <Terminal className="w-4 h-4" />
              &gt; CURL_MODE
            </button>
            <button
              onClick={() => {
                setCurrentTab('socket');
                setSelectedCollectionName('');
                postMessage('socketGetInitialState');
              }}
              className={`px-6 py-3 font-bold uppercase tracking-wider text-sm transition-all border-b-4 flex items-center gap-2 ${
                currentTab === 'socket'
                  ? 'border-textMain text-accentLight bg-bgPanel'
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
              className={`px-6 py-3 font-bold uppercase tracking-wider text-sm transition-all border-b-4 flex items-center gap-2 ${
                currentTab === 'metrics'
                  ? 'border-textMain text-accentLight bg-bgPanel'
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
                response={httpResponse}
                globalToken={globalToken}
                onStateChange={handleHttpStateChange}
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

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/90 flex justify-center items-center z-50 transition-opacity">
          <div className="flex flex-col items-center gap-4 bg-bgPanel p-8 border-4 border-textMain rounded-none shadow-retro">
            <div className="text-textMain font-bold text-xl uppercase animate-pulse">&gt; PROCESSING REQUEST...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
