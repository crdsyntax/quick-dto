import React from 'react';
import { HttpPanel } from './components/HttpPanel';
import { SocketPanel } from './components/SocketPanel';
import { CurlPanel } from './components/CurlPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { BatchProgressBar } from './components/BatchProgressBar';
import { RetroBackground } from './components/RetroBackground';
import { AppHeader } from './components/AppHeader';
import { TabNavigation } from './components/TabNavigation';
import { AppLoadingOverlay } from './components/AppLoadingOverlay';
import { useAppLogic } from './hooks/useAppLogic';
import { AppTab, VscodePostCommand } from './enums';

const formatJsonFileName = (prefix: string): string => {
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  return `${prefix}-${timestamp}.json`;
};

const downloadJsonFile = (filename: string, data: unknown): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const App: React.FC = () => {
  const { state, actions } = useAppLogic();

  const handleTabChange = (tab: AppTab) => {
    actions.setCurrentTab(tab);
    actions.setSelectedCollectionName('');
    if (tab === AppTab.SOCKET) {
      actions.postMessage(VscodePostCommand.SOCKET_GET_INITIAL_STATE);
    }
  };

  const handleExportHttpResponseJson = () => {
    if (!state.httpResponse) return;
    downloadJsonFile(formatJsonFileName('http-response'), state.httpResponse);
  };

  const handleExportSocketResponseJson = () => {
    downloadJsonFile(formatJsonFileName('socket-data'), {
      status: state.socketStatus,
      connectionLogs: state.connectionLogs,
      listenLogs: state.listenLogs,
    });
  };

  const handleExportCurlJson = (payload: unknown) => {
    downloadJsonFile(formatJsonFileName('curl-request'), payload);
  };

  return (
    <div className="relative min-h-screen bg-bgDark text-textMain overflow-x-hidden">
      {state.isRepeating && (
        <BatchProgressBar
          progress={state.repeatProgress}
          onStop={actions.handleStopRepeatedRequests}
        />
      )}

      <div className="relative z-10 max-w-[1170px] mx-auto px-5 py-6 flex flex-col gap-4">
        <div className="relative">
          <AppHeader />
          <RetroBackground status={state.httpResponse?.status ?? null} />
        </div>

        {(state.currentTab === AppTab.HTTP || state.currentTab === AppTab.SOCKET) && (
          <div className="bg-bgPanel/40 border border-borderDark rounded-lg p-4 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-textMuted">Collection name</label>
                <input
                  type="text"
                  value={state.collectionName}
                  onChange={(e) => actions.setCollectionName(e.target.value)}
                  placeholder="e.g. Get Users List"
                  className="px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-textMuted">Group name</label>
                <input
                  type="text"
                  value={state.collectionGroup}
                  onChange={(e) => actions.setCollectionGroup(e.target.value)}
                  placeholder="e.g. User Management"
                  className="px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
                />
              </div>
              <button
                onClick={actions.handleSaveCollection}
                className="h-[38px] bg-textMain text-bgDark hover:bg-accentLight transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-card"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Save to collection
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4 items-start">
          <main className="flex-grow flex flex-col gap-3 min-w-0">
            <TabNavigation
              currentTab={state.currentTab}
              onTabChange={handleTabChange}
            />

            <div className="transition-all duration-300">
              {state.currentTab === AppTab.HTTP ? (
                <HttpPanel
                  initialState={state.httpFormState}
                  loadId={state.httpLoadId}
                  onSendRequest={actions.handleSendRequest}
                  isLoading={state.isLoading}
                  isRepeating={state.isRepeating}
                  onStopRepeatedRequests={actions.handleStopRepeatedRequests}
                  response={state.httpResponse}
                  globalToken={state.globalToken}
                  onStateChange={actions.handleHttpStateChange}
                  onTokensDetected={actions.handleTokensDetected}
                  onExportJson={handleExportHttpResponseJson}
                />
              ) : state.currentTab === AppTab.CURL ? (
                <CurlPanel
                  onImport={actions.handleCurlImport}
                  onExportJson={handleExportCurlJson}
                />
              ) : state.currentTab === AppTab.SOCKET ? (
                <SocketPanel
                  initialState={state.socketFormState}
                  loadId={state.socketLoadId}
                  socketStatus={state.socketStatus}
                  onConnect={actions.handleSocketConnect}
                  onDisconnect={actions.handleSocketDisconnect}
                  onEmit={actions.handleSocketEmit}
                  onListen={actions.handleSocketListen}
                  connectionLogs={state.connectionLogs}
                  listenLogs={state.listenLogs}
                  onClearConnectionLogs={() => actions.setConnectionLogs([])}
                  onClearListenLogs={() => actions.setListenLogs([])}
                  onStateChange={actions.handleSocketStateChange}
                  onExportJson={handleExportSocketResponseJson}
                />
              ) : (
                <MetricsPanel
                  httpState={state.httpFormState}
                  httpResponse={state.httpResponse}
                  socketStatus={state.socketStatus}
                  connectionLogs={state.connectionLogs}
                  listenLogs={state.listenLogs}
                />
              )}
            </div>
          </main>
        </div>

        {state.isLoading && !state.isRepeating && <AppLoadingOverlay />}
      </div>
    </div>
  );
};

export default App;
