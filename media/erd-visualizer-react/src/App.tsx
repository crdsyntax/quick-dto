import React, { useState, useEffect, useRef } from 'react';
import { useVSCode } from './hooks/useVSCode';
import ErdCanvas, { ErdCanvasHandle } from './components/ErdCanvas';
import Toolbar from './components/Toolbar';
import LoadingOverlay from './components/LoadingOverlay';
import LabelEditor from './components/LabelEditor';
import { ErdData, SavedDiagramState, Link } from './types';

const App: React.FC = () => {
  const { postMessage } = useVSCode();
  const [data, setData] = useState<ErdData | null>(null);
  const [savedState, setSavedState] = useState<SavedDiagramState>({ positions: {}, relations: {} });
  const [loading, setLoading] = useState(true);
  const [labelEditor, setLabelEditor] = useState<{ x: number, y: number, link: Link } | null>(null);
  const canvasRef = useRef<ErdCanvasHandle>(null);

  useEffect(() => {
    // Listen for messages from VS Code
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'setData':
          setData(message.data);
          if (message.savedState) {
            setSavedState(message.savedState);
          }
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request initial data
    postMessage('ready');

    return () => window.removeEventListener('message', handleMessage);
  }, [postMessage]);

  const handleSaveState = (state: SavedDiagramState) => {
    setSavedState(state);
    postMessage('saveState', { state });
  };

  const handleShowLabelEditor = (event: any, link: Link) => {
    setLabelEditor({
      x: event.clientX,
      y: event.clientY,
      link
    });
  };

  const handleSaveLabel = (newValue: string) => {
    if (labelEditor) {
      labelEditor.link.customLabel = newValue;
      setLabelEditor(null);
      // Force a re-render or state update if needed, 
      // but usually ErdCanvas handles its own internal state for rendering
    }
  };

  const handleCopyMarkdown = () => {
    if (canvasRef.current) {
      const mermaid = canvasRef.current.getMermaid();
      const backticks = '```';
      const markdown = `${backticks}mermaid\n${mermaid}${backticks}`;
      postMessage('copyToClipboard', { text: markdown });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {loading && <LoadingOverlay />}
      
      {data && (
        <>
          <Toolbar 
            onReset={() => canvasRef.current?.resetLayout()}
            onExport={() => canvasRef.current?.exportSvg()}
            onCopyMarkdown={handleCopyMarkdown}
          />
          
          <ErdCanvas 
            ref={canvasRef}
            data={data}
            savedState={savedState}
            onSaveState={handleSaveState}
            onShowLabelEditor={handleShowLabelEditor}
          />

          {labelEditor && (
            <LabelEditor 
              x={labelEditor.x}
              y={labelEditor.y}
              value={labelEditor.link.customLabel || labelEditor.link.propertyName || labelEditor.link.type}
              onSave={handleSaveLabel}
              onCancel={() => setLabelEditor(null)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default App;
