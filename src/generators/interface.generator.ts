import { PropertyInfo } from "../types/types";

export function generateInterface(pascalEntity: string, properties: PropertyInfo[]): string {
    let content = `export interface I${pascalEntity} {\n`;

    for (const prop of properties) {
        const type = getInterfaceType(prop.type);
        const optional = prop.isOptional ? "?" : "";
        content += `  ${prop.name}${optional}: ${type};\n`;
    }

    content += `}\n`;
    return content;
}

function getInterfaceType(type: string): string {
    // Map types if necessary, but usually TS types from entity are compatible
    // We might want to handle specific cases if needed, similar to DTO generator
    return type;
}
