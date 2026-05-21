import React from 'react';
import { useFlowchartLogic } from './hooks/useFlowchartLogic';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { FlowchartData } from '../../../src/types/flowchart-types';

declare const initialData: FlowchartData;

const App: React.FC = () => {
  const { state, actions } = useFlowchartLogic(initialData);

  return (
    <div className="flex w-full h-full">
      <Toolbar 
        mode={state.mode} 
        onModeChange={actions.setMode} 
        onDelete={actions.deleteSelected} 
      />
      
      <div id="canvas-container" className="flex-1 relative overflow-hidden">
        <Canvas 
          data={state.data}
          mode={state.mode}
          onNodeSelect={actions.setSelectedNodeId}
          onEdgeSelect={actions.setSelectedEdgeId}
          onDataChange={actions.setData}
          onZoomChange={actions.setZoom}
        />
        
        <div id="top-controls">
          <button className="control-btn" onClick={() => {/* Reset logic */}}>Reset Layout</button>
          <button className="control-btn" onClick={() => actions.handleExport('svg', '')}>Export SVG</button>
          <button className="control-btn" onClick={() => actions.handleExport('json', JSON.stringify(state.data))}>Export JSON</button>
          <button className="control-btn" onClick={actions.handleSave}>Guardar</button>
        </div>
        
        <div id="zoom-info">{Math.round(state.zoom * 100)}%</div>
      </div>

      <PropertiesPanel 
        selectedNode={state.selectedNode}
        selectedEdge={state.selectedEdge}
        onNodeUpdate={actions.updateNode}
        onEdgeUpdate={actions.updateEdge}
      />
    </div>
  );
};

export default App;
