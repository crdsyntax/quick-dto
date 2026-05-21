import React from 'react';
import { FlowchartNode, FlowchartEdge } from '../../../../src/types/flowchart-types';
import { FlowchartNodeType, Cardinality, EdgeStyle } from '../enums';

interface PropertiesPanelProps {
  selectedNode: FlowchartNode | null;
  selectedEdge: FlowchartEdge | null;
  onNodeUpdate: (id: string, updates: Partial<FlowchartNode>) => void;
  onEdgeUpdate: (id: string, updates: Partial<FlowchartEdge>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  selectedEdge,
  onNodeUpdate,
  onEdgeUpdate,
}) => {
  if (!selectedNode && !selectedEdge) return null;

  return (
    <div id="properties" className="visible">
      <h3>Propiedades</h3>
      
      {selectedNode && (
        <div id="node-props">
          <div className="prop-group">
            <label>Etiqueta</label>
            <input 
              type="text" 
              value={selectedNode.label} 
              onChange={(e) => onNodeUpdate(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div className="prop-group">
            <label>Tipo</label>
            <select 
              value={selectedNode.type} 
              disabled={selectedNode.type === FlowchartNodeType.ENTITY}
              onChange={(e) => onNodeUpdate(selectedNode.id, { type: e.target.value as any })}
            >
              <option value={FlowchartNodeType.PROCESS}>Proceso</option>
              <option value={FlowchartNodeType.DECISION}>Decisión</option>
              <option value={FlowchartNodeType.START}>Inicio</option>
              <option value={FlowchartNodeType.END}>Fin</option>
            </select>
          </div>
          <div className="prop-group">
            <label>Color de relleno</label>
            <input 
              type="color" 
              value={selectedNode.color || '#1e1e1e'} 
              onChange={(e) => onNodeUpdate(selectedNode.id, { color: e.target.value })}
              style={{ width: '100%', height: '28px', padding: '2px', cursor: 'pointer' }}
            />
          </div>
          <div className="prop-group">
            <label>Opacidad</label>
            <input 
              type="range" 
              min="0" max="100" 
              value={(selectedNode.opacity || 1) * 100} 
              onChange={(e) => onNodeUpdate(selectedNode.id, { opacity: parseInt(e.target.value) / 100 })}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
              {Math.round((selectedNode.opacity || 1) * 100)}%
            </span>
          </div>
        </div>
      )}

      {selectedEdge && (
        <div id="edge-props">
          <div className="prop-group">
            <label>Etiqueta</label>
            <input 
              type="text" 
              value={selectedEdge.label || ''} 
              onChange={(e) => onEdgeUpdate(selectedEdge.id, { label: e.target.value })}
            />
          </div>
          <div className="prop-group">
            <label>Cardinalidad</label>
            <select 
              value={selectedEdge.cardinality || Cardinality.NONE} 
              onChange={(e) => onEdgeUpdate(selectedEdge.id, { cardinality: e.target.value as any })}
            >
              <option value={Cardinality.NONE}>Ninguna</option>
              <option value={Cardinality.ONE_TO_ONE}>1:1</option>
              <option value={Cardinality.ONE_TO_MANY}>1:N</option>
              <option value={Cardinality.MANY_TO_ONE}>N:1</option>
              <option value={Cardinality.MANY_TO_MANY}>N:M</option>
            </select>
          </div>
          <div className="prop-group">
            <label>Estilo</label>
            <select 
              value={selectedEdge.style || EdgeStyle.SOLID} 
              onChange={(e) => onEdgeUpdate(selectedEdge.id, { style: e.target.value as any })}
            >
              <option value={EdgeStyle.SOLID}>Sólido</option>
              <option value={EdgeStyle.DASHED}>Discontinuo</option>
              <option value={EdgeStyle.DOTTED}>Punteado</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
