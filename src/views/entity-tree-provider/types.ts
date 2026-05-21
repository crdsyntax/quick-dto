export type EntityRelationType =
  | "ManyToOne"
  | "OneToMany"
  | "OneToOne"
  | "ManyToMany"
  | "Ref";

export interface EntityRelation {
  type: EntityRelationType;
  targetEntity: string;
  propertyName: string;
}
