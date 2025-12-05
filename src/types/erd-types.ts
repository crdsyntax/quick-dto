export interface EntityField {
  name: string;
  type: string;
  isPrimary?: boolean;
  isNullable?: boolean;
  decorators: string[];
}

export interface EntityRelation {
  type: "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany";
  targetEntity: string;
  propertyName: string;
}

export interface EntityData {
  name: string;
  fields: EntityField[];
  relations: EntityRelation[];
}

export interface ErdDiagramData {
  entities: Record<string, EntityData>;
  rootEntity: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface SavedPositions {
  [entityName: string]: NodePosition;
}
