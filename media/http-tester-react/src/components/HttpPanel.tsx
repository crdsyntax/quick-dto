import React, { useState, useEffect, useRef } from 'react';
import { KeyValuePair, FileData, HttpResponse } from '../types';
import { Plus, X, Play, RefreshCw, Save } from 'lucide-react';

interface HttpPanelProps {
  initialState?: any;
  loadId: number;
  onSendRequest: (request: any, repeatCount?: number, repeatDelay?: number) => void;
  onSaveCollection: (collection: any) => void;
  isLoading: boolean;
  response: HttpResponse | null;
  globalToken: string;
  onStateChange: (state: any) => void;
}

export const HttpPanel: React.FC<HttpPanelProps> = ({
  initialState,
  loadId,
  onSendRequest,
  onSaveCollection,
  isLoading,
  response,
  globalToken,
  onStateChange,
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
  const [collectionName, setCollectionName] = useState('');
  const [collectionGroup, setCollectionGroup] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'body' | 'params' | 'headers' | 'files' | 'auth'>('body');

  const fileInputRefCounter = useRef(0);

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
    });
  }, [url, method, body, queryParams, headers, authType, authToken, basicUsername, basicPassword]);

  useEffect(() => {
    if (initialState) {
      setUrl(initialState.url || '');
      setMethod(initialState.method || 'GET');
      setBody(initialState.body || '');
      setAuthType(initialState.authType || 'none');
      setAuthToken(initialState.authToken || '');
      setBasicUsername(initialState.basicUsername || '');
      setBasicPassword(initialState.basicPassword || '');
      setCollectionName(initialState.name || '');
      setCollectionGroup(initialState.group || '');

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

  const handleSave = () => {
    if (!collectionName) {
      alert('POR FAVOR INGRESA UN NOMBRE PARA LA COLECCIÓN');
      return;
    }

    const collectionData = {
      name: collectionName,
      group: collectionGroup,
      type: 'http',
      url,
      method,
      body,
      queryParams: queryParams.filter(p => p.key),
      headers: headers.filter(h => h.key),
      authType,
      authToken,
      basicUsername,
      basicPassword,
      contentType,
    };

    onSaveCollection(collectionData);
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Request Line */}
      <div className="flex gap-3 items-center">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-32 p-3 bg-bgDark border-2 border-borderDark text-textMain font-bold uppercase rounded-none text-sm focus:border-accentLight focus:outline-none"
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
          className="flex-grow p-3 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none placeholder-textMuted"
        />
        <button
          onClick={() => handleSend(1)}
          disabled={isLoading}
          className="px-6 h-[48px] bg-textMain text-bgDark hover:bg-accentLight disabled:bg-borderDark disabled:text-textMuted transition font-bold rounded-none text-xs uppercase flex items-center gap-2 shadow-retro"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          SEND
        </button>
      </div>

      {/* Repeat Request & Content Type Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-bgPanel p-4 border-2 border-borderDark rounded-none">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-textMuted">REPEAT COUNT</label>
          <input
            type="number"
            min="1"
            max="1000"
            value={repeatCount}
            onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
            className="p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-textMuted">DELAY (MS)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={repeatDelay}
            onChange={(e) => setRepeatDelay(parseInt(e.target.value) || 0)}
            className="p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-textMuted">CONTENT TYPE</label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none uppercase"
          >
            <option value="json">JSON</option>
            <option value="formdata">FormData</option>
          </select>
        </div>
        <button
          onClick={() => handleSend(repeatCount)}
          disabled={isLoading}
          className="w-full h-[44px] bg-bgDark border-2 border-borderDark hover:border-textMain text-textMain transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          REPEAT REQUEST
        </button>
      </div>

      {/* Save Collection Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-bgPanel p-4 border-2 border-borderDark rounded-none shadow-retro-dark">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-textMuted">COLLECTION NAME</label>
          <input
            type="text"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="e.g. Get Users List"
            className="p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-textMuted">GROUP NAME</label>
          <input
            type="text"
            value={collectionGroup}
            onChange={(e) => setCollectionGroup(e.target.value)}
            placeholder="e.g. User Management"
            className="p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full h-[44px] bg-accentLight text-bgDark hover:bg-textMain transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-2 shadow-retro"
        >
          <Save className="w-4 h-4" />
          SAVE TO COLLECTION
        </button>
      </div>

      {/* Sub tabs header */}
      <div className="flex border-b-2 border-borderDark">
        {(['body', 'params', 'headers', 'files', 'auth'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-5 py-2.5 text-xs font-bold uppercase transition-all border-b-4 tracking-wider ${
              activeSubTab === tab
                ? 'border-textMain text-accentLight bg-bgPanel'
                : 'border-transparent text-textMuted hover:text-textMain'
            }`}
          >
            {tab === 'params' ? 'QUERY PARAMS' : tab}
          </button>
        ))}
      </div>

      {/* Sub tabs content */}
      <div className="bg-bgPanel border-2 border-borderDark rounded-none p-5 min-h-[160px]">
        {/* Body tab */}
        {activeSubTab === 'body' && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="REQUEST BODY"
            className="w-full min-h-[140px] p-3 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none resize-y placeholder-textMuted"
          />
        )}

        {/* Query Params tab */}
        {activeSubTab === 'params' && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-textMuted uppercase">QUERY PARAMETERS</h4>
            {queryParams.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={param.key}
                  onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                  placeholder="KEY"
                  className="flex-1 p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
                />
                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                  placeholder="VALUE"
                  className="flex-1 p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
                />
                <button
                  onClick={() => removeQueryParam(index)}
                  className="p-2 text-textMuted hover:text-accentLight transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button
              onClick={addQueryParam}
              className="self-start mt-2 px-3 py-1.5 bg-bgDark border-2 border-borderDark text-textMain hover:border-textMain transition font-bold rounded-none text-xs uppercase flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> ADD PARAM
            </button>
          </div>
        )}

        {/* Headers tab */}
        {activeSubTab === 'headers' && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-textMuted uppercase">HEADERS</h4>
            {headers.map((header, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  placeholder="HEADER NAME"
                  className="flex-1 p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  placeholder="VALUE"
                  className="flex-1 p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="p-2 text-textMuted hover:text-accentLight transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button
              onClick={addHeader}
              className="self-start mt-2 px-3 py-1.5 bg-bgDark border-2 border-borderDark text-textMain hover:border-textMain transition font-bold rounded-none text-xs uppercase flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> ADD HEADER
            </button>
          </div>
        )}

        {/* Files tab */}
        {activeSubTab === 'files' && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-textMuted uppercase">FILES (FORMDATA)</h4>
            {files.map((file, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={file.fieldName}
                  onChange={(e) => updateFileRow(index, e.target.value)}
                  placeholder="FIELD NAME"
                  className="flex-1 p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
                />
                <input
                  type="file"
                  onChange={(e) => handleFileChange(index, e)}
                  className="flex-1 p-1 bg-bgDark border-2 border-borderDark text-textMuted rounded-none text-xs focus:border-accentLight focus:outline-none"
                />
                <button
                  onClick={() => removeFileRow(index)}
                  className="p-2 text-textMuted hover:text-accentLight transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button
              onClick={addFileRow}
              className="self-start mt-2 px-3 py-1.5 bg-bgDark border-2 border-borderDark text-textMain hover:border-textMain transition font-bold rounded-none text-xs uppercase flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> ADD FILE
            </button>
          </div>
        )}

        {/* Auth tab */}
        {activeSubTab === 'auth' && (
          <div className="flex flex-col gap-4">
            <div className="flex border-b-2 border-borderDark mb-2">
              {['global', 'none', 'bearer', 'basic'].map((type) => (
                <button
                  key={type}
                  onClick={() => setAuthType(type)}
                  className={`px-4 py-2 text-xs font-bold uppercase transition border-b-4 ${
                    authType === type
                      ? 'border-textMain text-accentLight'
                      : 'border-transparent text-textMuted hover:text-textMain'
                  }`}
                >
                  {type === 'global' ? 'GLOBAL (INHERIT)' : type}
                </button>
              ))}
            </div>

            {authType === 'global' && (
              <div className="text-textMuted italic text-sm border-l-4 border-borderDark pl-3">
                &gt; Utilizando token global heredado del panel de configuración.
                <div className="mt-2 text-xs text-textMain font-bold">
                  TOKEN: {globalToken || 'NOT SET'}
                </div>
              </div>
            )}

            {authType === 'none' && (
              <p className="text-textMuted text-sm border-l-4 border-borderDark pl-3">&gt; NO AUTHENTICATION.</p>
            )}

            {authType === 'bearer' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase font-bold text-textMuted">BEARER TOKEN</label>
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="ENTER TOKEN"
                  className="w-full p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
                />
              </div>
            )}

            {authType === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase font-bold text-textMuted">USERNAME</label>
                  <input
                    type="text"
                    value={basicUsername}
                    onChange={(e) => setBasicUsername(e.target.value)}
                    placeholder="USERNAME"
                    className="p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase font-bold text-textMuted">PASSWORD</label>
                  <input
                    type="password"
                    value={basicPassword}
                    onChange={(e) => setBasicPassword(e.target.value)}
                    placeholder="PASSWORD"
                    className="p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Response Panel */}
      {response && (
        <div className="bg-bgDark border-2 border-borderDark rounded-none mt-4 overflow-hidden shadow-retro-dark">
          {/* Header */}
          <div className="flex justify-between items-center bg-bgPanel px-5 py-3 border-b-2 border-borderDark text-xs font-bold text-textMuted uppercase">
            <span className={`px-2 py-1 ${response.status >= 400 ? 'bg-textMain text-bgDark' : 'bg-transparent text-accentLight border-2 border-textMain'}`}>
              HTTP {response.status} {response.statusText}
            </span>
            <div className="flex gap-4">
              <span>TIME: <strong className="text-textMain">{response.time}ms</strong></span>
              <span>SIZE: <strong className="text-textMain">{(response.size / 1024).toFixed(2)}KB</strong></span>
            </div>
          </div>
          {/* Data content */}
          <div className="p-5 overflow-auto max-h-[400px]">
            <pre className="text-xs text-textMain whitespace-pre-wrap leading-relaxed">
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
