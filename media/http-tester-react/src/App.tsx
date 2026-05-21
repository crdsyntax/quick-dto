import React from 'react';
import { HttpPanel } from './components/HttpPanel';
import { SocketPanel } from './components/SocketPanel';
import { CurlPanel } from './components/CurlPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { BatchProgressBar } from './components/BatchProgressBar';
import { RetroBackground } from './components/RetroBackground';
import { AppHeader } from './components/AppHeader';
import { CollectionPanel } from './components/CollectionPanel';
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
    <div className="relative min-h-screen bg-zinc-950 font-mono text-emerald-500 overflow-x-hidden">
      {state.isRepeating && (
        <BatchProgressBar 
          progress={state.repeatProgress} 
          onStop={actions.handleStopRepeatedRequests} 
        />
      )}

      <RetroBackground isError={state.isError} />

      <div className="relative z-10 max-w-[1170px] mx-auto px-5 py-7 flex flex-col gap-5 selection:bg-textMain selection:text-bgDark">
        <AppHeader />

        {(state.currentTab === AppTab.HTTP || state.currentTab === AppTab.SOCKET) && (
          <CollectionPanel
            name={state.collectionName}
            group={state.collectionGroup}
            onNameChange={actions.setCollectionName}
            onGroupChange={actions.setCollectionGroup}
            onSave={actions.handleSaveCollection}
          />
        )}

        <div className="flex gap-5 items-start">
          <main className="flex-grow flex flex-col gap-4 min-w-0">
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
