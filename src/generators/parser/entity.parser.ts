import { PropertyInfo } from "../../types/types";
import { toCamelCase } from "../../utils/case.util";

export function parseEntityProperties(entityContent: string): PropertyInfo[] {
  const lines = entityContent.split("\n");
  const properties: PropertyInfo[] = [];
  let currentComment = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("//")) {
      currentComment += trimmed.substring(2).trim() + " ";
      continue;
    }

    const relationMatch = trimmed.match(/@(ManyToOne|OneToOne|ManyToMany)\(([^)]*)\)\s*(\w+)?\s*:/);
    if (relationMatch) {
      const propName = toCamelCase((relationMatch[3] || "relation") + "Id");
      properties.push({
        name: propName,
        type: "number",
        isRelationId: true,
        description: currentComment.trim() || undefined,
        isOptional: true,
      });
      currentComment = "";
      continue;
    }

    const propMatch = trimmed.match(/^(\w+)\??:\s*([^;]+);/);
    if (propMatch) {
      let [, name, type] = propMatch;
      if (name === "id") continue;

      properties.push({
        name: toCamelCase(name),
        type: type.trim(),
        isOptional: name.endsWith("?"),
        description: currentComment.trim() || undefined,
      });
      currentComment = "";
    }

    if (trimmed.startsWith("@") || trimmed.startsWith("export class")) {
      currentComment = "";
    }
  }

  return properties;
}