import { EntityData } from "./erd-types";

/**
 * Tipos de nodos disponibles en el editor de flowchart
 */
export type FlowchartNodeType =
  | "entity"
  | "process"
  | "decision"
  | "start"
  | "end"
  | "connector";

/**
 * Tipos de cardinalidad para las relaciones
 */
export type Cardinality = "1:1" | "1:N" | "N:1" | "N:M" | "none";

/**
 * Representa un nodo en el diagrama de flujo
 */
export interface FlowchartNode {
  id: string;
  type: FlowchartNodeType;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  data?: EntityData; // Para nodos tipo 'entity'
}

/**
 * Representa una conexión/arista entre nodos
 */
export interface FlowchartEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: "top" | "right" | "bottom" | "left";
  targetHandle?: "top" | "right" | "bottom" | "left";
  cardinality?: Cardinality;
  label?: string;
  color?: string;
  style?: "solid" | "dashed" | "dotted";
}

/**
 * Datos completos del diagrama de flujo
 */
export interface FlowchartData {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  metadata?: FlowchartMetadata;
}

/**
 * Metadatos del diagrama
 */
export interface FlowchartMetadata {
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  zoom?: number;
  panX?: number;
  panY?: number;
}

/**
 * Mensajes enviados desde el webview a la extensión
 */
export type FlowchartMessage =
  | { type: "save"; data: FlowchartData }
  | { type: "export"; format: "svg" | "png" | "json" }
  | { type: "error"; message: string }
  | { type: "ready" }
  | { type: "nodeSelected"; nodeId: string | null }
  | { type: "edgeSelected"; edgeId: string | null };

/**
 * Mensajes enviados desde la extensión al webview
 */
export type ExtensionMessage =
  | { type: "loadData"; data: FlowchartData }
  | { type: "addEntity"; entity: EntityData; position: { x: number; y: number } }
  | { type: "updateTheme"; theme: "light" | "dark" }
  | { type: "exportResult"; success: boolean; message?: string };

/**
 * Configuración del nodo según su tipo
 */
export const NODE_CONFIGS: Record<
  FlowchartNodeType,
  { defaultWidth: number; defaultHeight: number; shape: string }
> = {
  entity: { defaultWidth: 200, defaultHeight: 150, shape: "rect" },
  process: { defaultWidth: 120, defaultHeight: 60, shape: "rect" },
  decision: { defaultWidth: 100, defaultHeight: 100, shape: "diamond" },
  start: { defaultWidth: 80, defaultHeight: 40, shape: "ellipse" },
  end: { defaultWidth: 80, defaultHeight: 40, shape: "ellipse" },
  connector: { defaultWidth: 30, defaultHeight: 30, shape: "circle" },
};

/**
 * Símbolos de cardinalidad para mostrar en las conexiones
 */
export const CARDINALITY_SYMBOLS: Record<Cardinality, { source: string; target: string }> = {
  "1:1": { source: "1", target: "1" },
  "1:N": { source: "1", target: "N" },
  "N:1": { source: "N", target: "1" },
  "N:M": { source: "N", target: "M" },
  none: { source: "", target: "" },
};
