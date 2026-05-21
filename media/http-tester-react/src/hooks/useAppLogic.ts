import { useState, useEffect, useCallback } from 'react';
import { useVSCode } from './useVSCode';
import { 
  Collection, 
  HttpResponse, 
  SocketLog, 
  SocketStatus, 
  RepeatProgress, 
  VSCodeState 
} from '../types';
import { AppTab, AuthType, SocketLogType, SocketStatusClass, SocketStatusText, VscodeIncomingCommand, VscodePostCommand } from '../enums';
import { MESSAGES } from '../constants/messages';
import { mapHeadersToRecord, mapQueryParamsToRecord, parseCurlToState } from '../utils/httpUtils';

export const useAppLogic = () => {
  const { postMessage, getState, setState } = useVSCode();

  // App General State
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.HTTP);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionName, setSelectedCollectionName] = useState<string>('');
  const [globalToken, setGlobalToken] = useState<string>('');
  const [globalRefreshToken, setGlobalRefreshToken] = useState<string>('');
  const [collectionName, setCollectionName] = useState<string>('');
  const [collectionGroup, setCollectionGroup] = useState<string>('');

  // HTTP State
  const [httpFormState, setHttpFormState] = useState<VSCodeState | null>(null);
  const [httpResponse, setHttpResponse] = useState<HttpResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRepeating, setIsRepeating] = useState<boolean>(false);
  const [repeatProgress, setRepeatProgress] = useState<RepeatProgress>({ current: 0, total: 0 });
  const [httpLoadId, setHttpLoadId] = useState<number>(0);

  // Socket State
  const [socketFormState, setSocketFormState] = useState<VSCodeState | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>({ 
    text: SocketStatusText.DISCONNECTED, 
    className: SocketStatusClass.DISCONNECTED 
  });
  const [connectionLogs, setConnectionLogs] = useState<SocketLog[]>([]);
  const [listenLogs, setListenLogs] = useState<SocketLog[]>([]);
  const [socketLoadId, setSocketLoadId] = useState<number>(0);

  const triggerHttpLoad = useCallback((state: VSCodeState): void => {
    setHttpFormState(state);
    setHttpLoadId(prev => prev + 1);
  }, []);

  const triggerSocketLoad = useCallback((state: VSCodeState): void => {
    setSocketFormState(state);
    setSocketLoadId(prev => prev + 1);
  }, []);

  const isError = (httpResponse?.status && httpResponse.status >= 400) || socketStatus.className === 'error';

  useEffect(() => {
    document.body.dataset.status = isError ? 'error' : 'ready';
    if (isError) {
      document.body.classList.add('has-error');
    } else {
      document.body.classList.remove('has-error');
    }
  }, [isError]);

  useEffect(() => {
    const savedState = getState() as VSCodeState;
    if (savedState) {
      setCollections(savedState.collections || []);
      if (savedState.url) {
        triggerHttpLoad({
          url: savedState.url || '',
          method: savedState.method || 'GET',
          body: savedState.body || '',
          queryParams: savedState.queryParams || [],
          headers: savedState.headers || [],
          authType: savedState.authType || AuthType.NONE,
          authToken: savedState.authToken || '',
          basicUsername: savedState.basicUsername || '',
          basicPassword: savedState.basicPassword || '',
        });
      }
    }
  }, [getState, triggerHttpLoad]);

  const handleHttpStateChange = (state: VSCodeState): void => {
    setHttpFormState(state);
    
    const authHeader = state.headers?.find((h: any) => h.key?.toLowerCase() === 'authorization');
    if (authHeader && authHeader.value?.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.value.substring(7);
      setGlobalToken(token);
      postMessage(VscodePostCommand.SAVE_GLOBAL_TOKEN, { token });
    }

    setState({
      ...getState(),
      ...state,
      collections,
    });

    postMessage(VscodePostCommand.SAVE_LAST_REQUEST, { request: state });
  };

  const handleSocketStateChange = (state: VSCodeState): void => {
    setSocketFormState(state);
    postMessage(VscodePostCommand.SOCKET_STATE_UPDATE, { data: state });
  };

  const handleTokensDetected = (access: string, refresh?: string): void => {
    if (access) {
      setGlobalToken(access);
      postMessage(VscodePostCommand.SAVE_GLOBAL_TOKEN, { token: access });
    }
    if (refresh) {
      setGlobalRefreshToken(refresh);
      postMessage(VscodePostCommand.SAVE_GLOBAL_REFRESH_TOKEN, { token: refresh });
    }
    postMessage(VscodePostCommand.SHOW_TOAST, { message: MESSAGES.TOKENS_DETECTED });
  };

  const handleCurlImport = (parsedRequest: any, autoRun: boolean): void => {
    const state = parseCurlToState(parsedRequest);
    triggerHttpLoad(state);
    setCurrentTab(AppTab.HTTP);

    if (autoRun) {
      handleSendRequest(state);
    }
  };

  const handleSendRequest = (request: VSCodeState, count?: number, delay?: number): void => {
    setHttpResponse(null);

    const payload = {
      ...request,
      headers: mapHeadersToRecord(request.headers || []),
      queryParams: mapQueryParamsToRecord(request.queryParams || []),
    };

    if (payload.authType === AuthType.GLOBAL) {
      payload.authType = AuthType.BEARER;
      payload.authToken = globalToken;
    }

    if (count && count > 1) {
      setIsRepeating(true);
      setRepeatProgress({ current: 0, total: count });
      postMessage(VscodePostCommand.REPEAT_REQUEST, { request: payload, repeatCount: count, delay });
    } else {
      setIsLoading(true);
      postMessage(VscodePostCommand.SEND_REQUEST, { request: payload });
    }
  };

  const handleStopRepeatedRequests = (): void => {
    setIsRepeating(false);
    postMessage(VscodePostCommand.STOP_REPEATED_REQUESTS);
  };

  const handleSocketConnect = (config: VSCodeState): void => {
    postMessage(VscodePostCommand.SOCKET_CONNECT, { data: config });
  };

  const handleSocketDisconnect = (): void => {
    postMessage(VscodePostCommand.SOCKET_DISCONNECT);
  };

  const handleSocketEmit = (name: string, payloadStr: string): void => {
    postMessage(VscodePostCommand.SOCKET_EMIT, {
      data: { eventName: name, payload: payloadStr }
    });
  };

  const handleSocketListen = (name: string): void => {
    postMessage(VscodePostCommand.SOCKET_LISTEN, { data: { eventName: name } });
  };

  const handleSaveCollection = (): void => {
    if (!collectionName) {
      postMessage(VscodePostCommand.SHOW_TOAST, { message: MESSAGES.SAVE_COLLECTION_ERROR_NO_NAME });
      return;
    }

    let collectionData: any = {
      name: collectionName,
      group: collectionGroup,
    };

    if (currentTab === AppTab.HTTP) {
      collectionData = {
        ...collectionData,
        ...httpFormState,
        type: 'http',
      };
    } else if (currentTab === AppTab.SOCKET) {
      collectionData = {
        ...collectionData,
        ...socketFormState,
        type: 'socket',
      };
    } else {
      postMessage(VscodePostCommand.SHOW_TOAST, { message: MESSAGES.SAVE_COLLECTION_ERROR_INVALID_TAB });
      return;
    }

    postMessage(VscodePostCommand.SAVE_COLLECTION, { collection: collectionData });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message) return;

      switch (message.command) {
        case VscodeIncomingCommand.RESPONSE:
          setIsLoading(false);
          setHttpResponse(message.response);
          break;
        
        case VscodeIncomingCommand.ERROR:
          setIsLoading(false);
          setIsRepeating(false);
          setHttpResponse({
            status: 500,
            statusText: MESSAGES.INTERNAL_ERROR,
            time: 0,
            size: 0,
            data: message.message
          });
          break;

        case VscodeIncomingCommand.REPEAT_PROGRESS:
          setHttpResponse(message.response);
          setIsRepeating(true);
          setRepeatProgress({ current: message.current, total: message.total });
          break;

        case VscodeIncomingCommand.REPEAT_COMPLETE:
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
                  message: MESSAGES.REPEAT_SUMMARY,
                  successful: successCount,
                  failed: failCount,
                  total: message.totalRequests,
                }
              }
            };
          });
          break;

        case VscodeIncomingCommand.STOP_LOADING:
          setIsLoading(false);
          break;

        case VscodeIncomingCommand.SOCKET_LOG:
          setConnectionLogs((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: message.message,
              type: message.type as SocketLogType
            }
          ]);
          break;

        case VscodeIncomingCommand.SOCKET_LISTEN_LOG:
          setListenLogs((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: message.message,
              eventName: message.eventName,
              type: SocketLogType.INFO
            }
          ]);
          break;

        case VscodeIncomingCommand.SOCKET_STATUS:
          setSocketStatus({ text: message.status, className: message.className });
          break;

        case VscodeIncomingCommand.LOAD_COLLECTIONS:
          if (message.collections && Array.isArray(message.collections)) {
            const newHttp = message.collections.filter((c: Collection) => c.type === 'http');
            setCollections((prev) => {
              const cleaned = prev.filter((c: Collection) => c.type === 'socket');
              const next = [...cleaned, ...newHttp];
              postMessage(VscodePostCommand.SAVE_COLLECTIONS, { collections: next });
              return next;
            });
            if (newHttp.length > 0) {
              setSelectedCollectionName(newHttp[0].name);
              triggerHttpLoad(newHttp[0]);
              setCollectionName(newHttp[0].name || '');
              setCollectionGroup(newHttp[0].group || '');
            }
          }
          break;

        case VscodeIncomingCommand.SOCKET_INITIAL_STATE:
          if (message.state) {
            triggerSocketLoad(message.state);
          }
          setSocketStatus({ text: message.status.text, className: message.status.class });
          break;

        case VscodeIncomingCommand.LOAD_GLOBAL_TOKEN:
          setGlobalToken(message.token || '');
          break;

        case VscodeIncomingCommand.LOAD_GLOBAL_REFRESH_TOKEN:
          setGlobalRefreshToken(message.token || '');
          break;

        case VscodeIncomingCommand.IMPORTED_COLLECTIONS:
          if (message.collections && Array.isArray(message.collections)) {
            setCollections((prev) => {
              const next = [...prev];
              message.collections.forEach((col: Collection) => {
                const idx = next.findIndex((c) => c.name === col.name && c.type === col.type);
                if (idx === -1) {
                  next.push(col);
                }
              });
              postMessage(VscodePostCommand.SAVE_COLLECTIONS, { collections: next });
              return next;
            });
            postMessage(VscodePostCommand.SHOW_TOAST, { message: MESSAGES.COLLECTION_IMPORT_SUCCESS(message.collections.length) });
          }
          break;

        case VscodeIncomingCommand.INITIALIZE_COLLECTIONS:
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

        case VscodeIncomingCommand.LOAD_REQUEST:
          if (message.request) {
            setCurrentTab(AppTab.HTTP);
            triggerHttpLoad(message.request);
            setCollectionName(message.request.name || '');
            setCollectionGroup(message.request.group || '');
            setIsLoading(true);
            postMessage(VscodePostCommand.SEND_REQUEST, { request: message.request });
          }
          break;

        case VscodeIncomingCommand.LOAD_COLLECTION:
          if (message.collection) {
            setCurrentTab((message.collection.type === 'http' || message.collection.type === 'socket') ? message.collection.type : AppTab.HTTP);
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
  }, [postMessage, getState, setState, collections, currentTab, triggerHttpLoad, triggerSocketLoad]);

  return {
    state: {
      currentTab,
      collections,
      selectedCollectionName,
      globalToken,
      globalRefreshToken,
      collectionName,
      collectionGroup,
      httpFormState,
      httpResponse,
      isLoading,
      isRepeating,
      repeatProgress,
      httpLoadId,
      socketFormState,
      socketStatus,
      connectionLogs,
      listenLogs,
      socketLoadId,
      isError,
    },
    actions: {
      setCurrentTab,
      setSelectedCollectionName,
      setCollectionName,
      setCollectionGroup,
      setConnectionLogs,
      setListenLogs,
      handleHttpStateChange,
      handleSocketStateChange,
      handleTokensDetected,
      handleCurlImport,
      handleSendRequest,
      handleStopRepeatedRequests,
      handleSocketConnect,
      handleSocketDisconnect,
      handleSocketEmit,
      handleSocketListen,
      handleSaveCollection,
      postMessage,
    }
  };
};
