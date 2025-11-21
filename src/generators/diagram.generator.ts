import * as fs from "fs";
import * as ts from "typescript";
import * as path from "path";

interface EntityRelation {
  name: string;
  type: string;
  relation: "OneToMany" | "ManyToOne" | "ManyToMany" | "OneToOne";
  target: string;
}

export async function generateDiagram(filePath: string): Promise<string> {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  const entityName = path.basename(filePath).replace(".entity.ts", "");
  const relations: EntityRelation[] = [];
  const properties: { name: string; type: string }[] = [];

  // Extract via AST
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name?.text && node.name.text.toLowerCase() === entityName.toLowerCase()) {
      node.members.forEach((member) => {
        if ((member as any).name) {
          const propName = (member as any).name.getText();
          const propType = (member as any).type?.getText() || "any";
          properties.push({ name: propName, type: propType });
        }

        const memberWithDecorators = member as any;
        const decorators = (memberWithDecorators.decorators || []).map((d: any) => d.getText());
        decorators.forEach((dec: string) => {
          const relMatch = dec.match(/@(OneToMany|ManyToOne|ManyToMany|OneToOne)\s*\(\s*(?:\([^)]*\)\s*=>\s*)?([\w\d_]+)/);
          if (relMatch) {
            const relation = relMatch[1] as EntityRelation["relation"];
            const target = relMatch[2];
            relations.push({ name: (member as any).name.getText(), type: (member as any).type?.getText() || "any", relation, target });
          }
        });
      });
    }
  });

  // Fallback: regex extract if no properties found
  if (properties.length === 0) {
    const classMatch = source.match(new RegExp(`class\\s+${entityName}\\s*{([\\s\\S]*?)}\\s*`, "im"));
    if (classMatch) {
      const body = classMatch[1];
      const propRegex = /(?:@[\s\S]*?\n\s*)*([A-Za-z0-9_]+)\s*:\s*([^;\n]+);/g;
      let m: RegExpExecArray | null;
      while ((m = propRegex.exec(body)) !== null) {
        properties.push({ name: m[1], type: m[2].trim() });
      }
    }
  }

  let md = `# Entity Diagram: ${entityName}\n\n`;
  md += `**Entity:** ${entityName}\n\n`;

  if (properties.length > 0) {
    md += "## Properties\n\n";
    md += "| Name | Type |\n|---|---|\n";
    properties.forEach((p) => {
      md += `| ${p.name} | ${p.type} |\n`;
    });
    md += "\n";
  } else {
    md += "No properties found.\n\n";
  }

  if (relations.length > 0) {
    md += "## Relations\n\n";
    relations.forEach((r) => {
      md += `- ${r.relation} ${r.name}: ${r.target}\n`;
    });
    md += "\n";
  }

  md += "\n```mermaid\nclassDiagram\n";
  md += `class ${entityName} {\n`;
  properties.forEach((p) => {
    md += `  +${p.name}: ${p.type}\n`;
  });
  md += `}\n`;

  relations.forEach((r) => {
    switch (r.relation) {
      case "OneToMany":
        md += `${entityName} "1" --> "*" ${r.target}\n`;
        break;
      case "ManyToOne":
        md += `${entityName} "*" --> "1" ${r.target}\n`;
        break;
      case "OneToOne":
        md += `${entityName} "1" --> "1" ${r.target}\n`;
        break;
      case "ManyToMany":
        md += `${entityName} "*" --> "*" ${r.target}\n`;
        break;
    }
  });

  md += "```\n";

  return md;
}
