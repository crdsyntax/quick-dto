import React, { useState, useEffect, useRef } from 'react';
import { KeyValuePair, FileData, HttpResponse } from '../types';
import { Plus, X, Play, RefreshCw, Square, Download } from 'lucide-react';

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
    }
  }, [loadId]);

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

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Request Line */}
      <div className="flex gap-2 items-stretch">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-24 px-3 py-2 bg-bgPanel border border-borderDark rounded-lg text-sm font-medium text-textMain focus:border-textMuted transition-colors"
        >
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/v1/resource"
          className="flex-1 px-3 py-2 bg-bgPanel border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
        />
        <button
          onClick={() => handleSend(1)}
          disabled={isLoading || isRepeating}
          className="px-5 bg-textMain text-bgDark hover:bg-accentLight disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg text-xs font-semibold flex items-center gap-2 shadow-card"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Send
        </button>
      </div>

      {/* Repeat Request & Content Type Panel */}
      <div className="bg-bgPanel/40 border border-borderDark rounded-lg p-3 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">Repeat count</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={repeatCount}
              onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
              disabled={isRepeating}
              className="px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors disabled:opacity-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">Delay (ms)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={repeatDelay}
              onChange={(e) => setRepeatDelay(parseInt(e.target.value) || 0)}
              disabled={isRepeating}
              className="px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors disabled:opacity-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-textMuted">Content type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              disabled={isRepeating}
              className="px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors disabled:opacity-40"
            >
              <option value="json">JSON</option>
              <option value="formdata">FormData</option>
            </select>
          </div>
          {isRepeating ? (
            <button
              onClick={onStopRepeatedRequests}
              className="w-full h-[34px] bg-textMain text-bgDark hover:bg-accentLight transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-card"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop requests
            </button>
          ) : (
            <button
              onClick={() => handleSend(repeatCount)}
              disabled={isLoading}
              className="w-full h-[34px] bg-bgDark border border-borderDark text-textMain hover:border-textMuted disabled:opacity-40 transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Repeat ({repeatCount})
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs header */}
      <div className="flex gap-1 bg-bgPanel/30 border border-borderDark rounded-lg p-0.5">
        {(['body', 'params', 'headers', 'files', 'auth'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeSubTab === tab
                ? 'bg-bgDark text-textMain shadow-card'
                : 'text-textMuted hover:text-textMain'
            }`}
          >
            {tab === 'params' ? 'Query Params' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Sub tabs content */}
      <div className="bg-bgPanel/20 border border-borderDark rounded-lg p-4 min-h-[160px] shadow-card">
        {/* Body tab */}
        {activeSubTab === 'body' && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Request body (JSON)"
            className="w-full min-h-[140px] px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors resize-y placeholder:text-textMuted/50 font-mono"
          />
        )}

        {/* Query Params tab */}
        {activeSubTab === 'params' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-textMuted">Query parameters</p>
            {queryParams.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={param.key}
                  onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                  placeholder="Key"
                  className="flex-1 px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                />
                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                />
                <button
                  onClick={() => removeQueryParam(index)}
                  className="p-1.5 text-textMuted hover:text-textMain transition-colors rounded-md hover:bg-bgPanel"
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
            <p className="text-xs font-medium text-textMuted">Headers</p>
            {headers.map((header, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  placeholder="Header name"
                  className="flex-1 px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="p-1.5 text-textMuted hover:text-textMain transition-colors rounded-md hover:bg-bgPanel"
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

        {/* Files tab */}
        {activeSubTab === 'files' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-textMuted">Files (FormData)</p>
            {files.map((file, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={file.fieldName}
                  onChange={(e) => updateFileRow(index, e.target.value)}
                  placeholder="Field name"
                  className="flex-1 px-3 py-1.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                />
                <input
                  type="file"
                  onChange={(e) => handleFileChange(index, e)}
                  className="flex-1 px-2 py-1.5 bg-bgDark border border-borderDark rounded-lg text-xs text-textMuted file:mr-2 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-textMain file:text-bgDark hover:file:bg-accentLight transition-colors"
                />
                <button
                  onClick={() => removeFileRow(index)}
                  className="p-1.5 text-textMuted hover:text-textMain transition-colors rounded-md hover:bg-bgPanel"
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
              <div className="text-textMuted text-sm border-l-2 border-textMuted pl-3">
                Using global token from settings.
                <div className="mt-1.5 text-xs font-mono text-textMain bg-bgDark rounded-md px-2 py-1">
                  Token: {globalToken || 'Not set'}
                </div>
              </div>
            )}

            {authType === 'none' && (
              <p className="text-textMuted text-sm border-l-2 border-textMuted pl-3">No authentication.</p>
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
      </div>

      {/* Response Panel */}
      {response && (
        <div className="bg-bgPanel/30 border border-borderDark rounded-lg overflow-hidden shadow-card min-h-[200px]">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-borderDark">
            <span className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                response.status >= 400
                  ? 'bg-textMain text-bgDark'
                  : 'bg-bgDark border border-textMain text-textMain'
              }`}>
                {response.status} {response.statusText}
              </span>
            </span>
            <div className="flex items-center gap-4 text-xs text-textMuted">
              <span><span className="text-textMain font-medium">{response.time}ms</span></span>
              <span><span className="text-textMain font-medium">{(response.size / 1024).toFixed(2)}KB</span></span>
              {onExportJson && (
                <button
                  type="button"
                  onClick={onExportJson}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-textMain text-textMain hover:bg-textMain hover:text-bgDark transition-all text-xs font-medium"
                >
                  <Download className="w-3 h-3" />
                  Export JSON
                </button>
              )}
            </div>
          </div>
          {/* Data content */}
          <div className="p-4 overflow-auto max-h-[400px]">
            <pre className="text-sm text-textMain whitespace-pre-wrap leading-relaxed font-mono">
              {typeof response.data === 'object'
                ? JSON.stringify(response.data, null, 2)
                : response.data}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
