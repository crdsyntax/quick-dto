import React from 'react';
import { EditorMode } from '../enums';
import { SelectIcon, ConnectIcon, RectIcon, DiamondIcon, EllipseIcon, DeleteIcon } from './Icons';

interface ToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onDelete: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ mode, onModeChange, onDelete }) => {
  return (
    <div id="toolbar">
      <button 
        className={`toolbar-btn ${mode === EditorMode.SELECT ? 'active' : ''}`}
        onClick={() => onModeChange(EditorMode.SELECT)}
        title="Seleccionar (V)"
      >
        <SelectIcon />
      </button>
      <button 
        className={`toolbar-btn ${mode === EditorMode.CONNECT ? 'active' : ''}`}
        onClick={() => onModeChange(EditorMode.CONNECT)}
        title="Conectar (C)"
      >
        <ConnectIcon />
      </button>
      
      <div className="toolbar-divider" />
      
      <button 
        className={`toolbar-btn ${mode === EditorMode.ADD_RECT ? 'active' : ''}`}
        onClick={() => onModeChange(EditorMode.ADD_RECT)}
        title="Rectángulo - Proceso"
      >
        <RectIcon />
      </button>
      <button 
        className={`toolbar-btn ${mode === EditorMode.ADD_DIAMOND ? 'active' : ''}`}
        onClick={() => onModeChange(EditorMode.ADD_DIAMOND)}
        title="Diamante - Decisión"
      >
        <DiamondIcon />
      </button>
      <button 
        className={`toolbar-btn ${mode === EditorMode.ADD_ELLIPSE ? 'active' : ''}`}
        onClick={() => onModeChange(EditorMode.ADD_ELLIPSE)}
        title="Óvalo - Inicio/Fin"
      >
        <EllipseIcon />
      </button>
      
      <div className="toolbar-divider" />
      
      <button className="toolbar-btn" onClick={onDelete} title="Eliminar (Del)">
        <DeleteIcon />
      </button>
    </div>
  );
};
