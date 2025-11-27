import { Project } from "ts-morph";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function logStep(msg: string) {
  process.stdout.write(`\n[WORKFLOW] ${msg}...\n`);
}

export async function generateMermaidString(
  rootPath: string,
  rootEntityName: string,
  depth = 2
): Promise<string> {
  const ENTITIES_PATH = rootPath + "/src/**/*.entity.ts";

  const project = new Project({
    tsConfigFilePath: rootPath + "/tsconfig.json",
  });
  const sourceFiles = project.addSourceFilesAtPaths(ENTITIES_PATH);

  const entities: Record<string, { columns: string[]; relations: string[] }> =
    {};

  for (const file of sourceFiles) {
    const classes = file.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      entities[name] = { columns: [], relations: [] };

      const props = cls.getProperties();
      for (const prop of props) {
        const decorators = prop.getDecorators().map((d) => d.getName());

        if (decorators.includes("Column")) {
          entities[name].columns.push(prop.getName());
        }

        const relDecor = prop
          .getDecorators()
          .find((d) =>
            ["ManyToOne", "OneToMany", "OneToOne", "ManyToMany"].includes(
              d.getName()
            )
          );

        if (relDecor) {
          let relTypeName = "";
          const arg = relDecor.getArguments()[0];

          if (arg) {
            const txt = arg.getText();
            const found = txt.match(/=>\s*([^.)\s]+)/);
            if (found) relTypeName = found[1];
          }

          if (!relTypeName) {
            relTypeName = prop
              .getType()
              .getText()
              .replace(/\[\]$/, "")
              .replace(/Promise<(.+)>/, "$1");
          }

          if (relTypeName && relTypeName !== name) {
            entities[name].relations.push(relTypeName);
          }
        }
      }
    }
  }

  const visited = new Set<string>();
  const queue: Array<{ name: string; level: number }> = [
    { name: rootEntityName, level: 0 },
  ];
  const subEntities: Record<string, (typeof entities)[string]> = {};

  while (queue.length > 0) {
    const { name, level } = queue.shift()!;
    if (visited.has(name) || level > depth) continue;

    visited.add(name);
    if (!entities[name]) continue;

    subEntities[name] = entities[name];

    for (const rel of entities[name].relations) {
      if (entities[rel]) queue.push({ name: rel, level: level + 1 });
    }
  }

  let mermaid = "classDiagram\n";

  if (Object.keys(subEntities).length === 0) {
    mermaid += "class Dummy { id int }\n";
  }

  for (const [entity, data] of Object.entries(subEntities)) {
    mermaid += `class ${entity} {\n`;
    data.columns.forEach((c) => (mermaid += `  + ${c}\n`));
    mermaid += "}\n\n";
  }

  const rootEntity = subEntities[rootEntityName];
  if (rootEntity) {
    rootEntity.relations.forEach((target) => {
      if (subEntities[target]) {
        mermaid += ` ${rootEntityName} --> ${target}\n`;
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
