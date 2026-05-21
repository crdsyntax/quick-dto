export enum EditorMode {
  SELECT = 'select',
  CONNECT = 'connect',
  ADD_RECT = 'addRect',
  ADD_DIAMOND = 'addDiamond',
  ADD_ELLIPSE = 'addEllipse',
}

export enum FlowchartNodeType {
  ENTITY = 'entity',
  PROCESS = 'process',
  DECISION = 'decision',
  START = 'start',
  END = 'end',
  CONNECTOR = 'connector',
}

export enum Cardinality {
  ONE_TO_ONE = '1:1',
  ONE_TO_MANY = '1:N',
  MANY_TO_ONE = 'N:1',
  MANY_TO_MANY = 'N:M',
  NONE = 'none',
}

export enum EdgeStyle {
  SOLID = 'solid',
  DASHED = 'dashed',
  DOTTED = 'dotted',
}
