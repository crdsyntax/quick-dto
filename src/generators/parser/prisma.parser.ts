import * as fs from "fs";
import * as path from "path";
import {
  EntityData,
  EntityField,
  EntityRelation,
  ErdDiagramData,
} from "../../types/erd-types";

export function parsePrismaSchema(schemaContent: string): Record<string, EntityData> {
  const entities: Record<string, EntityData> = {};
  const modelBlocks = schemaContent.match(/model\s+(\w+)\s*{[\s\S]*?}/g) || [];

  for (const block of modelBlocks) {
    const modelMatch = block.match(/model\s+(\w+)/);
    if (!modelMatch) continue;

    const modelName = modelMatch[1];
    const entityData: EntityData = {
      name: modelName,
      fields: [],
      relations: [],
    };

    const lines = block.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("model") || trimmed.startsWith("}")) {
        continue;
      }

      // Basic field parsing: name type attributes
      const fieldParts = trimmed.split(/\s+/);
      if (fieldParts.length < 2) continue;

      const fieldName = fieldParts[0];
      const fieldType = fieldParts[1].replace("?", "").replace("[]", "");
      const attributes = fieldParts.slice(2).join(" ");

      const isNullable = fieldParts[1].endsWith("?");
      const isArray = fieldParts[1].endsWith("[]");
      const isPrimary = attributes.includes("@id");
      const isRelation = attributes.includes("@relation") || modelBlocks.some(b => b.includes(`model ${fieldType}`));
      const isEnum = !isRelation && !["String", "Int", "Boolean", "DateTime", "Float", "Json", "Bytes", "BigInt", "Decimal"].includes(fieldType);

      if (isRelation) {
        // Determine relation type
        // This is a simplified heuristic:
        // If it's an array -> OneToMany or ManyToMany
        // If it's single -> ManyToOne or OneToOne
        
        let relType: "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany" = "ManyToOne";
        
        if (isArray) {
            relType = "OneToMany";
            // Check if it's ManyToMany (both sides are arrays) - requires cross-reference check later
        } else if (attributes.includes("@unique")) {
            relType = "OneToOne";
        }

        entityData.relations.push({
          type: relType,
          targetEntity: fieldType,
          propertyName: fieldName,
        });
      } else {
        entityData.fields.push({
          name: fieldName,
          type: fieldType,
          isPrimary,
          isNullable,
          isEnum,
          isRelation: false,
          decorators: attributes.split(/\s+/).filter(a => a.startsWith("@")),
        });
      }
    }

    entities[modelName] = entityData;
  }

  // Refine relation types (e.g. detect ManyToMany)
  for (const modelName in entities) {
    for (const rel of entities[modelName].relations) {
      const targetEntity = entities[rel.targetEntity];
      if (targetEntity) {
        const backRel = targetEntity.relations.find(r => r.targetEntity === modelName);
        if (backRel) {
          if (rel.type === "OneToMany" && backRel.type === "OneToMany") {
            rel.type = "ManyToMany";
            backRel.type = "ManyToMany";
          } else if (rel.type === "ManyToOne" && backRel.type === "OneToMany") {
            // Already correct
          } else if (rel.type === "OneToMany" && backRel.type === "ManyToOne") {
            // Already correct
          } else if (rel.type === "OneToOne" && backRel.type === "OneToOne") {
            // Already correct
          }
        }
      }
    }
  }

  return entities;
}

export function findPrismaSchema(rootPath: string): string | null {
  const commonPaths = [
    path.join(rootPath, "prisma", "schema.prisma"),
    path.join(rootPath, "schema.prisma"),
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}
