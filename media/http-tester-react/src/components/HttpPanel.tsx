import React, { useState, useEffect, useRef } from 'react';
import { KeyValuePair, FileData, HttpResponse } from '../types';
import { Plus, X, Play, RefreshCw, Square, Download, Copy, Braces, SlidersHorizontal, Hash, Lock, Paperclip, CheckCircle2, AlertCircle } from 'lucide-react';

interface HttpPanelProps {
  initialState?: any;
  loadId: number;
  onSendRequest: (request: any, repeatCount?: number, repeatDelay?: number) => void;
  isLoading: boolean;
  isRepeating: boolean;
  onStopRepeatedRequests: () => void;
  response: HttpResponse | null;
  globalToken: string;
  onStateChange: (state: any) => void;
  onTokensDetected: (access: string, refresh?: string) => void;
  onExportJson?: () => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-sky-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
  PATCH: 'text-violet-400',
  HEAD: 'text-slate-400',
  OPTIONS: 'text-teal-400',
};

const SUB_TABS = [
  { id: 'params', label: 'Params', icon: SlidersHorizontal },
  { id: 'headers', label: 'Headers', icon: Hash },
  { id: 'body', label: 'Body', icon: Braces },
  { id: 'auth', label: 'Auth', icon: Lock },
  { id: 'files', label: 'Files', icon: Paperclip },
] as const;

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const highlightJson = (json: string): string => {
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-300'; // number
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'text-sky-300' : 'text-emerald-300'; // key : string
      } else if (/^(true|false)$/.test(match)) {
        cls = 'text-violet-300';
      } else if (match === 'null') {
        cls = 'text-rose-300';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
};

export const HttpPanel: React.FC<HttpPanelProps> = ({
  initialState,
  loadId,
  onSendRequest,
  isLoading,
  isRepeating,
  onStopRepeatedRequests,
  response,
  globalToken,
  onStateChange,
  onTokensDetected,
  onExportJson,
}) => {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([{ key: '', value: '' }]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([{ key: '', value: '' }]);
  const [files, setFiles] = useState<{ fieldName: string; fileInputRef: any; fileName?: string; fileData?: string }[]>([]);
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');
  const [contentType, setContentType] = useState('json');
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatDelay, setRepeatDelay] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState<'body' | 'params' | 'headers' | 'files' | 'auth'>('body');
  const [responseView, setResponseView] = useState<'pretty' | 'raw'>('pretty');
  const [copied, setCopied] = useState(false);

  const fileInputRefCounter = useRef(0);

  useEffect(() => {
    if (response && response.data && typeof response.data === 'object') {
      const data = response.data as any;
      const access = data.access_token || data.accessToken || data.token;
      const refresh = data.refresh_token || data.refreshToken;
      if (access || refresh) {
        onTokensDetected(access, refresh);
      }
    }
  }, [response]);

  useEffect(() => {
    if (globalToken && authType === 'none' && !initialState) {
      setAuthType('global');
    }
  }, [globalToken]);

  useEffect(() => {
    onStateChange({
      url,
      method,
      body,
      queryParams: queryParams.filter((p) => p.key),
      headers: headers.filter((h) => h.key),
      authType,
      authToken,
      basicUsername,
      basicPassword,
      contentType,
    });
  }, [url, method, body, queryParams, headers, authType, authToken, basicUsername, basicPassword, contentType]);

  useEffect(() => {
    if (initialState) {
      setUrl(initialState.url || '');
      setMethod(initialState.method || 'GET');
      setBody(initialState.body || '');
      setAuthType(initialState.authType || 'none');
      setAuthToken(initialState.authToken || '');
      setBasicUsername(initialState.basicUsername || '');
      setBasicPassword(initialState.basicPassword || '');

      if (initialState.queryParams && initialState.queryParams.length > 0) {
        setQueryParams(initialState.queryParams);
      } else {
        setQueryParams([{ key: '', value: '' }]);
      }

      if (initialState.headers && initialState.headers.length > 0) {
        setHeaders(initialState.headers);
      } else {
        setHeaders([{ key: '', value: '' }]);
      }

      setContentType(initialState.contentType || 'json');
    }
  }, [loadId]);

  const paramCount = queryParams.filter((p) => p.key).length;
  const headerCount = headers.filter((h) => h.key).length;
  const fileCount = files.filter((f) => f.fileName).length;
  const tabBadges: Record<string, number> = {
    params: paramCount,
    headers: headerCount,
    files: fileCount,
  };

  const bodylessMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '' }]);
  const removeQueryParam = (index: number) => {
    const next = [...queryParams];
    next.splice(index, 1);
    setQueryParams(next.length ? next : [{ key: '', value: '' }]);
  };
  const updateQueryParam = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...queryParams];
    next[index][field] = val;
    setQueryParams(next);
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (index: number) => {
    const next = [...headers];
    next.splice(index, 1);
    setHeaders(next.length ? next : [{ key: '', value: '' }]);
  };
  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...headers];
    next[index][field] = val;
    setHeaders(next);
  };

  const addFileRow = () => {
    fileInputRefCounter.current += 1;
    setFiles([
      ...files,
      { fieldName: '', fileInputRef: React.createRef() }
    ]);
  };
  const removeFileRow = (index: number) => {
    const next = [...files];
    next.splice(index, 1);
    setFiles(next);
  };
  const updateFileRow = (index: number, fieldName: string) => {
    const next = [...files];
    next[index].fieldName = fieldName;
    setFiles(next);
  };
  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result?.toString().split(',')[1];
        const next = [...files];
        next[index].fileName = file.name;
        next[index].fileData = base64;
        setFiles(next);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = (count = 1) => {
    const collectedFiles: FileData[] = files
      .filter((f) => f.fieldName && f.fileData)
      .map((f) => ({
        fieldName: f.fieldName,
        fileName: f.fileName || 'file',
        fileData: f.fileData || '',
      }));

    const reqData = {
      url,
      method,
      body,
      contentType,
      queryParams,
      headers,
      authType,
      authToken,
      basicUsername,
      basicPassword,
      files: collectedFiles,
    };

    onSendRequest(reqData, count > 1 ? count : undefined, count > 1 ? repeatDelay : undefined);
  };

  const handleCopyResponse = () => {
    if (!response) return;
    const text = typeof response.data === 'object'
      ? JSON.stringify(response.data, null, 2)
      : String(response.data ?? '');
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  const getStatusStyle = (status: number) => {
    if (status >= 500) return 'text-red-400 border-red-500/40 bg-red-500/10';
    if (status >= 400) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    if (status >= 300) return 'text-sky-400 border-sky-500/40 bg-sky-500/10';
    return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  };

  const responseText = response
    ? (typeof response.data === 'object'
        ? JSON.stringify(response.data, null, 2)
        : String(response.data ?? ''))
    : '';

  const inputClass =
    'flex-1 px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50';

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Request line */}
      <div className="flex flex-col gap-2 rounded-xl border border-borderDark bg-bgPanel/40 p-2.5 shadow-card">
        <div className="flex gap-2 items-stretch">
          <div className="relative">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`w-28 appearance-none pl-3 pr-8 py-2.5 bg-bgDark border-l-4 rounded-lg text-sm font-bold uppercase tracking-wide focus:border-textMuted transition-colors cursor-pointer ${
                METHOD_COLORS[method] || 'text-textMain'
              } border-borderDark`}
              style={{ borderLeftColor: method === 'GET' ? '#34d399' : method === 'POST' ? '#38bdf8' : method === 'PUT' ? '#fbbf24' : method === 'DELETE' ? '#f87171' : method === 'PATCH' ? '#a78bfa' : method === 'HEAD' ? '#94a3b8' : '#2dd4bf' }}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-textMuted text-[10px]">▼</span>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/v1/resource"
            className="flex-1 px-3 py-2.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50 font-mono"
          />
          <button
            onClick={() => handleSend(1)}
            disabled={isLoading || isRepeating || !url.trim()}
            className="px-6 bg-textMain text-bgDark hover:bg-accentLight disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg text-sm font-bold flex items-center gap-2 shadow-card"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {isLoading ? 'Sending…' : 'Send'}
          </button>
        </div>

        {/* Secondary options */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-textMuted">
          <label className="flex items-center gap-1.5">
            <span>Repeat</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={repeatCount}
              onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
              disabled={isRepeating}
              className="w-16 px-2 py-1 bg-bgDark border border-borderDark rounded-md text-textMain focus:border-textMuted disabled:opacity-40"
            />
            <span>×</span>
          </label>
          <label className="flex items-center gap-1.5">
            <span>Delay</span>
            <input
              type="number"
              min="0"
              step="100"
              value={repeatDelay}
              onChange={(e) => setRepeatDelay(parseInt(e.target.value) || 0)}
              disabled={isRepeating}
              className="w-20 px-2 py-1 bg-bgDark border border-borderDark rounded-md text-textMain focus:border-textMuted disabled:opacity-40"
            />
            <span>ms</span>
          </label>
          <label className="flex items-center gap-1.5">
            <span>Body type</span>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              disabled={isRepeating}
              className="px-2 py-1 bg-bgDark border border-borderDark rounded-md text-textMain focus:border-textMuted disabled:opacity-40"
            >
              <option value="json">JSON</option>
              <option value="formdata">FormData</option>
            </select>
          </label>
          {isRepeating ? (
            <button
              onClick={onStopRepeatedRequests}
              className="ml-auto px-3 py-1 bg-textMain text-bgDark hover:bg-accentLight transition-colors rounded-md text-xs font-semibold flex items-center gap-1.5"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </button>
          ) : (
            <button
              onClick={() => handleSend(repeatCount)}
              disabled={isLoading || repeatCount <= 1}
              className="ml-auto px-3 py-1 bg-bgDark border border-borderDark text-textMain hover:border-textMuted disabled:opacity-30 transition-colors rounded-md text-xs font-medium flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Repeat
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 bg-bgPanel/30 border border-borderDark rounded-lg p-1">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const badge = tabBadges[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeSubTab === tab.id
                  ? 'bg-bgDark text-textMain shadow-card'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {badge ? (
                <span className="ml-0.5 min-w-[16px] px-1 rounded-full bg-textMain text-bgDark text-[10px] font-bold leading-4">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Sub tabs content */}
      <div className="bg-bgPanel/20 border border-borderDark rounded-lg p-4 min-h-[180px] shadow-card">
        {/* Params tab */}
        {activeSubTab === 'params' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-textMuted">Query parameters appended to the URL</p>
            {queryParams.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={param.key}
                  onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                  placeholder="Key"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                  placeholder="Value"
                  className={inputClass}
                />
                <button
                  onClick={() => removeQueryParam(index)}
                  className="p-1.5 text-textMuted hover:text-textMain transition-colors rounded-md hover:bg-bgPanel"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addQueryParam}
              className="self-start mt-1 px-2.5 py-1 bg-bgDark border border-borderDark text-textMain hover:border-textMuted transition-colors rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add param
            </button>
          </div>
        )}

        {/* Headers tab */}
        {activeSubTab === 'headers' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-textMuted">Request headers</p>
            {headers.map((header, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  placeholder="Header name"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  placeholder="Value"
                  className={inputClass}
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="p-1.5 text-textMuted hover:text-textMain transition-colors rounded-md hover:bg-bgPanel"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addHeader}
              className="self-start mt-1 px-2.5 py-1 bg-bgDark border border-borderDark text-textMain hover:border-textMuted transition-colors rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add header
            </button>
          </div>
        )}

        {/* Body tab */}
        {activeSubTab === 'body' && (
          <div className="flex flex-col gap-2">
            {bodylessMethod ? (
              <div className="flex items-center gap-2 text-xs text-textMuted border border-dashed border-borderDark rounded-lg px-3 py-4">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span><span className="font-semibold text-textMain">{method}</span> requests usually don't send a body. Switch the method or keep it empty.</span>
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={contentType === 'json' ? 'Request body (JSON)' : 'Request body (FormData)'}
                className="w-full min-h-[160px] px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors resize-y placeholder:text-textMuted/50 font-mono"
                spellCheck={false}
              />
            )}
          </div>
        )}

        {/* Auth tab */}
        {activeSubTab === 'auth' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1 bg-bgPanel/40 border border-borderDark rounded-lg p-0.5 w-fit">
              {['global', 'none', 'bearer', 'basic'].map((type) => (
                <button
                  key={type}
                  onClick={() => setAuthType(type)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    authType === type
                      ? 'bg-bgDark text-textMain shadow-card'
                      : 'text-textMuted hover:text-textMain'
                  }`}
                >
                  {type === 'global' ? 'Global' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {authType === 'global' && (
              <div className="text-textMuted text-sm border-l-2 border-emerald-500/60 pl-3">
                Using global token from settings.
                <div className="mt-1.5 text-xs font-mono text-textMain bg-bgDark rounded-md px-2 py-1 break-all">
                  Token: {globalToken || 'Not set'}
                </div>
              </div>
            )}

            {authType === 'none' && (
              <p className="text-textMuted text-sm border-l-2 border-borderDark pl-3">No authentication.</p>
            )}

            {authType === 'bearer' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-textMuted">Bearer token</label>
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Enter token"
                  className="w-full px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50 font-mono"
                />
              </div>
            )}

            {authType === 'basic' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-textMuted">Username</label>
                  <input
                    type="text"
                    value={basicUsername}
                    onChange={(e) => setBasicUsername(e.target.value)}
                    placeholder="Username"
                    className="px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-textMuted">Password</label>
                  <input
                    type="password"
                    value={basicPassword}
                    onChange={(e) => setBasicPassword(e.target.value)}
                    placeholder="Password"
                    className="px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Files tab */}
        {activeSubTab === 'files' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-textMuted">Files sent as multipart/form-data</p>
            {files.map((file, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={file.fieldName}
                  onChange={(e) => updateFileRow(index, e.target.value)}
                  placeholder="Field name"
                  className={inputClass}
                />
                <input
                  type="file"
                  onChange={(e) => handleFileChange(index, e)}
                  className="flex-1 px-2 py-1.5 bg-bgDark border border-borderDark rounded-lg text-xs text-textMuted file:mr-2 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-textMain file:text-bgDark hover:file:bg-accentLight transition-colors"
                />
                <button
                  onClick={() => removeFileRow(index)}
                  className="p-1.5 text-textMuted hover:text-textMain transition-colors rounded-md hover:bg-bgPanel"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addFileRow}
              className="self-start mt-1 px-2.5 py-1 bg-bgDark border border-borderDark text-textMain hover:border-textMuted transition-colors rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add file
            </button>
          </div>
        )}
      </div>

      {/* Response Panel */}
      {response && (
        <div className={`rounded-xl border overflow-hidden shadow-card ${
          response.status >= 400 ? 'border-red-500/40 bg-red-500/[0.04]' : 'border-borderDark bg-bgPanel/30'
        }`}>
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-borderDark">
            <span className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusStyle(response.status)}`}>
                {response.status >= 400 ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {response.status} {response.statusText}
              </span>
            </span>
            <div className="flex items-center gap-3 text-xs text-textMuted">
              <span className="flex items-center gap-1">
                <span className="text-textMain font-semibold">{response.time}</span>ms
              </span>
              <span className="flex items-center gap-1">
                <span className="text-textMain font-semibold">{(response.size / 1024).toFixed(2)}</span>KB
              </span>
              <div className="flex items-center gap-1 rounded-md border border-borderDark overflow-hidden">
                <button
                  onClick={() => setResponseView('pretty')}
                  className={`px-2 py-1 transition-colors ${responseView === 'pretty' ? 'bg-bgDark text-textMain' : 'hover:text-textMain'}`}
                >
                  Pretty
                </button>
                <button
                  onClick={() => setResponseView('raw')}
                  className={`px-2 py-1 transition-colors ${responseView === 'raw' ? 'bg-bgDark text-textMain' : 'hover:text-textMain'}`}
                >
                  Raw
                </button>
              </div>
              <button
                type="button"
                onClick={handleCopyResponse}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-borderDark text-textMain hover:bg-bgDark transition-all text-xs font-medium"
                title="Copy response"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              {onExportJson && (
                <button
                  type="button"
                  onClick={onExportJson}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-textMain text-textMain hover:bg-textMain hover:text-bgDark transition-all text-xs font-medium"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              )}
            </div>
          </div>
          {/* Data content */}
          <div className="p-4 overflow-auto max-h-[420px]">
            {responseText ? (
              responseView === 'pretty' && typeof response.data === 'object' ? (
                <pre
                  className="text-sm whitespace-pre-wrap break-words leading-relaxed font-mono"
                  dangerouslySetInnerHTML={{ __html: highlightJson(responseText) }}
                />
              ) : (
                <pre className="text-sm text-textMain whitespace-pre-wrap break-words leading-relaxed font-mono">
                  {responseView === 'raw' && typeof response.data !== 'object'
                    ? response.data
                    : responseText}
                </pre>
              )
            ) : (
              <p className="text-sm text-textMuted italic">No response body.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
