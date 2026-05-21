import { Project } from "ts-morph";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  EntityData,
  EntityField,
  EntityRelation,
  ErdDiagramData,
} from "../types/erd-types";
import { findPrismaSchema, parsePrismaSchema } from "./parser/prisma.parser";

function logStep(msg: string) {
  process.stdout.write(`\n[WORKFLOW] ${msg}...\n`);
}

/**
 * Generate structured ERD data from TypeORM entities or Prisma schema
 */
export async function generateErdData(
  rootPath: string,
  rootEntityName: string,
  depth = 2
): Promise<ErdDiagramData> {
  // Check for Prisma first
  const prismaSchemaPath = findPrismaSchema(rootPath);
  if (prismaSchemaPath) {
    const content = Array.isArray(prismaSchemaPath)
      ? prismaSchemaPath.map((p) => fs.readFileSync(p, "utf8")).join("\n")
      : fs.readFileSync(prismaSchemaPath, "utf8");
    const entities = parsePrismaSchema(content);
    
    // Filtering logic similar to TypeORM
    const visited = new Set<string>();
    const queue: Array<{ name: string; level: number }> = [
      { name: rootEntityName, level: 0 },
    ];
    const subEntities: Record<string, EntityData> = {};

    while (queue.length > 0) {
      const { name, level } = queue.shift()!;
      if (visited.has(name) || level > depth) continue;

      visited.add(name);
      if (!entities[name]) continue;

      subEntities[name] = entities[name];

      for (const rel of entities[name].relations) {
        if (entities[rel.targetEntity]) {
          queue.push({ name: rel.targetEntity, level: level + 1 });
        }
      }
    }

    return {
      entities: subEntities,
      rootEntity: rootEntityName,
    };
  }

  // Fallback to TypeORM
  const ENTITIES_PATH = rootPath + "/src/**/*.entity.ts";

  const project = new Project({
    tsConfigFilePath: rootPath + "/tsconfig.json",
  });
  const sourceFiles = project.addSourceFilesAtPaths(ENTITIES_PATH);

  const entities: Record<string, EntityData> = {};

  for (const file of sourceFiles) {
    const classes = file.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      const entityData: EntityData = {
        name,
        fields: [],
        relations: [],
      };

      const props = cls.getProperties();
      for (const prop of props) {
        const decorators = prop.getDecorators().map((d) => d.getName());
        const propName = prop.getName();
        let propType = prop
          .getType()
          .getText(prop)
          .replace(/["']?import\(".*"\)\.?["']?/g, "")
          .replace(/\[\]$/, "")
          .replace(/Promise<(.+)>/, "$1");

        if (propType.includes(".")) {
          propType = propType.split(".").pop()!;
        }

        const typeObj = prop.getType();
        const isEnum =
          typeObj.isEnum() ||
          (typeObj.isArray() && typeObj.getArrayElementType()?.isEnum());

        const relDecor = prop
          .getDecorators()
          .find((d) =>
            ["ManyToOne", "OneToMany", "OneToOne", "ManyToMany"].includes(
              d.getName()
            )
          );

        const isRelation = !!relDecor;

        const isPrimary = decorators.some(
          (d) => d === "PrimaryGeneratedColumn" || d === "PrimaryColumn"
        );

        const isNullable =
          prop.hasQuestionToken() ||
          (decorators.some((d) => d === "Column") &&
            prop.getDecorators().some((d) => {
              const args = d.getArguments();
              return args.some((arg) =>
                arg.getText().includes("nullable: true")
              );
            }));

        entityData.fields.push({
          name: propName,
          type: propType,
          isPrimary,
          isNullable,
          isEnum: !!isEnum,
          isRelation,
          decorators,
        });

        if (relDecor) {
          let relTypeName = "";
          const arg = relDecor.getArguments()[0];

          if (arg) {
            const txt = arg.getText();
            const found = txt.match(/=>\s*([^.)\s]+)/);
            if (found) relTypeName = found[1];
          }

          if (!relTypeName) {
            relTypeName = propType;
          }

          if (relTypeName && relTypeName !== name) {
            entityData.relations.push({
              type: relDecor.getName() as any,
              targetEntity: relTypeName,
              propertyName: propName,
            });
          }
        }
      }

      entities[name] = entityData;
    }
  }

  const visited = new Set<string>();
  const queue: Array<{ name: string; level: number }> = [
    { name: rootEntityName, level: 0 },
  ];
  const subEntities: Record<string, EntityData> = {};

  while (queue.length > 0) {
    const { name, level } = queue.shift()!;
    if (visited.has(name) || level > depth) continue;

    visited.add(name);
    if (!entities[name]) continue;

    subEntities[name] = entities[name];

    for (const rel of entities[name].relations) {
      if (entities[rel.targetEntity]) {
        queue.push({ name: rel.targetEntity, level: level + 1 });
      }
    }
  }

  return {
    entities: subEntities,
    rootEntity: rootEntityName,
  };
}

export async function generateErdDataForEntities(
  rootPath: string,
  entityNames: string[],
  strict = false
): Promise<ErdDiagramData> {
  // Check for Prisma first
  const prismaSchemaPath = findPrismaSchema(rootPath);
  if (prismaSchemaPath) {
    const content = Array.isArray(prismaSchemaPath)
      ? prismaSchemaPath.map((p) => fs.readFileSync(p, "utf8")).join("\n")
      : fs.readFileSync(prismaSchemaPath, "utf8");
    const entities = parsePrismaSchema(content);


    const subEntities: Record<string, EntityData> = {};
    const entitiesToInclude = new Set<string>(entityNames);

    if (!strict) {
      for (const name of entityNames) {
        const entity = entities[name];
        if (entity) {
          for (const rel of entity.relations) {
            if (entities[rel.targetEntity]) {
              entitiesToInclude.add(rel.targetEntity);
            }
          }
        }
      }
    }

    for (const name of entitiesToInclude) {
      if (entities[name]) {
        subEntities[name] = entities[name];
      }
    }

    return {
      entities: subEntities,
      rootEntity: entityNames[0] || "",
    };
  }

  // Fallback to TypeORM
  const ENTITIES_PATH = rootPath + "/src/**/*.entity.ts";

  const project = new Project({
    tsConfigFilePath: rootPath + "/tsconfig.json",
  });
  const sourceFiles = project.addSourceFilesAtPaths(ENTITIES_PATH);

  const entities: Record<string, EntityData> = {};

  for (const file of sourceFiles) {
    const classes = file.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      const entityData: EntityData = {
        name,
        fields: [],
        relations: [],
      };

      const props = cls.getProperties();
      for (const prop of props) {
        const decorators = prop.getDecorators().map((d) => d.getName());
        const propName = prop.getName();
        let propType = prop
          .getType()
          .getText(prop)
          .replace(/["']?import\(".*"\)\.?["']?/g, "")
          .replace(/\[\]$/, "")
          .replace(/Promise<(.+)>/, "$1");

        if (propType.includes(".")) {
          propType = propType.split(".").pop()!;
        }

        const typeObj = prop.getType();
        const isEnum =
          typeObj.isEnum() ||
          (typeObj.isArray() && typeObj.getArrayElementType()?.isEnum());

        const relDecor = prop
          .getDecorators()
          .find((d) =>
            ["ManyToOne", "OneToMany", "OneToOne", "ManyToMany"].includes(
              d.getName()
            )
          );

        const isRelation = !!relDecor;

        const isPrimary = decorators.some(
          (d) => d === "PrimaryGeneratedColumn" || d === "PrimaryColumn"
        );

        const isNullable =
          prop.hasQuestionToken() ||
          (decorators.some((d) => d === "Column") &&
            prop.getDecorators().some((d) => {
              const args = d.getArguments();
              return args.some((arg) =>
                arg.getText().includes("nullable: true")
              );
            }));

        entityData.fields.push({
          name: propName,
          type: propType,
          isPrimary,
          isNullable,
          isEnum: !!isEnum,
          isRelation,
          decorators,
        });

        if (relDecor) {
          let relTypeName = "";
          const arg = relDecor.getArguments()[0];

          if (arg) {
            const txt = arg.getText();
            const found = txt.match(/=>\s*([^.)\s]+)/);
            if (found) relTypeName = found[1];
          }

          if (!relTypeName) {
            relTypeName = propType;
          }

          if (relTypeName && relTypeName !== name) {
            entityData.relations.push({
              type: relDecor.getName() as any,
              targetEntity: relTypeName,
              propertyName: propName,
            });
          }
        }
      }

      entities[name] = entityData;
    }
  }

  // Filter requested entities AND their direct relations (unless strict)
  const subEntities: Record<string, EntityData> = {};
  const entitiesToInclude = new Set<string>(entityNames);

  if (!strict) {
    for (const name of entityNames) {
      const entity = entities[name];
      if (entity) {
        for (const rel of entity.relations) {
          if (entities[rel.targetEntity]) {
            entitiesToInclude.add(rel.targetEntity);
          }
        }
      }
    }
  }

  for (const name of entitiesToInclude) {
    if (entities[name]) {
      subEntities[name] = entities[name];
    }
  }

  return {
    entities: subEntities,
    rootEntity: entityNames[0] || "",
  };
}

export async function generateMermaidString(
  rootPath: string,
  rootEntityName: string,
  depth = 2
): Promise<string> {
  const erdData = await generateErdData(rootPath, rootEntityName, depth);
  const { entities } = erdData;

  let mermaid = "classDiagram\n";

  if (Object.keys(entities).length === 0) {
    // Show the root entity even if it has no relations
    mermaid += `class ${rootEntityName} {\n`;
    mermaid += "  No fields detected\n";
    mermaid += "}\n";
    return mermaid.trim();
  }

  // Generate class definitions
  for (const [entityName, data] of Object.entries(entities)) {
    mermaid += `class ${entityName} {\n`;

    if (data.fields.length === 0) {
      mermaid += "  (no fields)\n";
    } else {
      data.fields.forEach((field) => {
        const prefix = field.isPrimary ? "🔑 " : "+ ";
        const nullable = field.isNullable ? "?" : "";
        mermaid += `  ${prefix}${field.name}${nullable} : ${field.type}\n`;
      });
    }

    mermaid += "}\n\n";
  }

  // Generate ALL relationships (not just from root)
  const addedRelations = new Set<string>();

  for (const [entityName, data] of Object.entries(entities)) {
    data.relations.forEach((rel) => {
      if (entities[rel.targetEntity]) {
        // Create unique key to avoid duplicate relations
        const relKey = `${entityName}-${rel.targetEntity}-${rel.propertyName}`;
        const reverseKey = `${rel.targetEntity}-${entityName}-${rel.propertyName}`;

        if (!addedRelations.has(relKey) && !addedRelations.has(reverseKey)) {
          addedRelations.add(relKey);

          // Use different arrow styles based on relation type
          let arrow = "-->";
          switch (rel.type) {
            case "OneToMany":
              arrow = "-->";
              break;
            case "ManyToOne":
              arrow = "-->";
              break;
            case "OneToOne":
              arrow = "-->";
              break;
            case "ManyToMany":
              arrow = "-->";
              break;
          }

          mermaid += `${entityName} ${arrow} ${rel.targetEntity} : ${rel.type}\n`;
        }
      }
    });
  }

  return mermaid.trim();
}

export async function generateErd(
  rootPath: string,
  rootEntityName: string,
  depth = 2
) {
  logStep("Verificando dependencias de Mermaid");

  try {
    execSync("npx mmdc -V", { stdio: "ignore" });
  } catch {
    logStep("Instalando @mermaid-js/mermaid-cli");
    execSync("npm install -D @mermaid-js/mermaid-cli", { stdio: "inherit" });
  }

  logStep("Inicializando proyecto y escaneo de entidades");

  const ERD_DIR = path.join(rootPath, "src", "erd");

  if (!fs.existsSync(ERD_DIR)) fs.mkdirSync(ERD_DIR, { recursive: true });

  const OUTPUT_MERMAID = path.join(ERD_DIR, "diagram.mmd");
  const OUTPUT_IMAGE = path.join(ERD_DIR, "diagram.png");

  logStep("Parseando entidades y resolviendo grafo");
  const mermaidContent = await generateMermaidString(
    rootPath,
    rootEntityName,
    depth
  );

  logStep("Generando archivo Mermaid");
  fs.writeFileSync(OUTPUT_MERMAID, mermaidContent);

  logStep("Renderizando imagen final");

  execSync(
    `npx mmdc -i "${OUTPUT_MERMAID}" -o "${OUTPUT_IMAGE}" --width 1600 --height 1200`,
    {
      stdio: "inherit",
    }
  );

  logStep("Proceso completado");
}
