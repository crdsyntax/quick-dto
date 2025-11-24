import { Project } from "ts-morph";
import * as fs from "fs";
import { execSync } from "child_process";

export async function generateErd(
    rootPath: string,
    rootEntityName: string,
    depth = 2
) {
    const ENTITIES_PATH = rootPath + "/src/**/*.entity.ts";
    const OUTPUT_MERMAID = rootPath + "/diagram.mmd";
    const OUTPUT_IMAGE = rootPath + "/diagram.png";

    const project = new Project({
        tsConfigFilePath: rootPath + "/tsconfig.json",
    });
    const sourceFiles = project.addSourceFilesAtPaths(ENTITIES_PATH);

    const entities: Record<string, { columns: string[]; relations: string[] }> =
        {};

    for (const file of sourceFiles) {
        const cls = file.getClasses()[0];
        if (!cls) continue;

        const name = cls.getName();
        if (!name) continue;
        entities[name] = { columns: [], relations: [] };

        const props = cls.getProperties();
        for (const prop of props) {
            const decorators = prop.getDecorators().map((d) => d.getName());

            if (decorators.includes("Column")) {
                entities[name].columns.push(prop.getName());
            }

            if (
                decorators.includes("ManyToOne") ||
                decorators.includes("OneToMany") ||
                decorators.includes("OneToOne") ||
                decorators.includes("ManyToMany")
            ) {
                const decorator = prop
                    .getDecorators()
                    .find((d) =>
                        ["ManyToOne", "OneToMany", "OneToOne", "ManyToMany"].includes(
                            d.getName()
                        )
                    );

                let relTypeName = "";

                if (decorator) {
                    const arg = decorator.getArguments()[0]?.getText();
                    if (arg) {
                        const match = arg.match(/=>\s*(\w+)/);
                        if (match) relTypeName = match[1];
                    }
                }

                if (!relTypeName) {
                    relTypeName = prop
                        .getType()
                        .getText()
                        .replace("[]", "")
                        .replace("Promise<", "")
                        .replace(">", "");
                }

                if (relTypeName) entities[name].relations.push(relTypeName);
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
            queue.push({ name: rel, level: level + 1 });
        }
    }

    let mermaid = "classDiagram\n";

    for (const [entity, data] of Object.entries(subEntities)) {
        mermaid += ` class ${entity} {\n`;
        data.columns.forEach((c) => (mermaid += ` + ${c}\n`));
        mermaid += " }\n\n";
    }

    for (const [entity, data] of Object.entries(subEntities)) {
        data.relations.forEach((target) => {
            if (subEntities[target]) {
                mermaid += ` ${entity} --> ${target}\n`;
            }
        });
    }

    fs.writeFileSync(OUTPUT_MERMAID, mermaid);
    execSync(`mmdc -i ${OUTPUT_MERMAID} -o ${OUTPUT_IMAGE}`);
}
