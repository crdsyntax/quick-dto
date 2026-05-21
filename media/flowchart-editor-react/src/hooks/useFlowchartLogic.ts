import { useState, useCallback, useEffect, useRef } from 'react';
import { useVSCode } from './useVSCode';
import { FlowchartData, FlowchartNode, FlowchartEdge } from '../../../../src/types/flowchart-types';
import { EditorMode } from '../enums';

export const useFlowchartLogic = (initialData: FlowchartData) => {
  const { postMessage, getState, setState } = useVSCode();
  const [data, setData] = useState<FlowchartData>(initialData);
  const [mode, setMode] = useState<EditorMode>(EditorMode.SELECT);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId) || null;
  const selectedEdge = data.edges.find(e => e.id === selectedEdgeId) || null;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message) return;

      switch (message.type) {
        case 'loadData':
          setData(message.data);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSave = useCallback(() => {
    postMessage('save', { data });
  }, [data, postMessage]);

  const handleExport = useCallback((format: 'svg' | 'json', content: string) => {
    postMessage('export', { format, content });
  }, [postMessage]);

  const updateNode = useCallback((nodeId: string, updates: Partial<FlowchartNode>) => {
    setData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    }));
  }, []);

  const updateEdge = useCallback((edgeId: string, updates: Partial<FlowchartEdge>) => {
    setData(prev => ({
      ...prev,
      edges: prev.edges.map(e => e.id === edgeId ? { ...e, ...updates } : e)
    }));
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setData(prev => ({
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== selectedNodeId),
        edges: prev.edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId)
      }));
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setData(prev => ({
        ...prev,
        edges: prev.edges.filter(e => e.id !== selectedEdgeId)
      }));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId]);

  return {
    state: {
      data,
      mode,
      selectedNodeId,
      selectedEdgeId,
      selectedNode,
      selectedEdge,
      zoom,
    },
    actions: {
      setData,
      setMode,
      setSelectedNodeId,
      setSelectedEdgeId,
      setZoom,
      handleSave,
      handleExport,
      updateNode,
      updateEdge,
      deleteSelected,
      postMessage,
    }
  };
};
