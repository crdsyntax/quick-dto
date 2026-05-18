export interface EntityField {
  name: string;
  type: string;
  isPrimary?: boolean;
  isRelation?: boolean;
  isEnum?: boolean;
  isNullable?: boolean;
}

export interface EntityRelation {
  targetEntity: string;
  type: 'ManyToOne' | 'OneToMany' | 'OneToOne' | 'ManyToMany';
  propertyName: string;
}

export interface EntityData {
  fields: EntityField[];
  relations: EntityRelation[];
}

export interface ErdData {
  entities: Record<string, EntityData>;
}

export interface Position {
  x: number;
  y: number;
}

export interface NodePosition extends Position {
  width?: number;
  height?: number;
}

export interface RelationState {
  customLabel?: string;
  anchorPoints?: Position[];
  bendPoint?: Position; // Legacy support
}

export interface SavedDiagramState {
  positions: Record<string, NodePosition>;
  relations: Record<string, RelationState>;
}

export interface Node extends Position {
  id: string;
  data: EntityData;
  width: number;
  height: number;
}

export interface Link {
  id: string;
  source: string;
  target: string;
  type: string;
  propertyName: string;
  pairKey: string;
  linkIndex: number;
  totalInPair?: number;
  customLabel?: string;
  anchorPoints?: Position[];
  bendPoint?: Position;
}
