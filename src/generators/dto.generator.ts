import { PropertyInfo } from "../types/types";

export function generateCreateDto(pascalEntity: string, properties: PropertyInfo[]): string {
  let content = `import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";\n`;
  content += `import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, IsDate, IsArray, ArrayNotEmpty } from "class-validator";\n\n`;
  content += `export class Create${pascalEntity}Dto {\n`;

  for (const prop of properties) {
    const decorators: string[] = [];
    prop.isOptional ? decorators.push("@IsOptional()") : decorators.push("@IsNotEmpty()");

    if (prop.type === "string") decorators.push("@IsString()");
    if (prop.type === "number") decorators.push("@IsNumber()");
    if (prop.type === "boolean") decorators.push("@IsBoolean()");
    if (prop.type === "Date") decorators.push("@IsDate()");
    if (prop.type.endsWith("[]")) {
      decorators.push("@IsArray()");
      decorators.push("@ArrayNotEmpty()");
    }

    const apiDecorator = prop.isOptional ? "ApiPropertyOptional" : "ApiProperty";
    const apiOptions = [getApiPropertyType(prop.type)];
    if (prop.description) apiOptions.push(`description: "${prop.description}"`);
    decorators.push(`@${apiDecorator}({ ${apiOptions.join(", ")} })`);

    content += decorators.map(d => `  ${d}`).join("\n") + "\n";
    content += `  ${prop.name}${prop.isOptional ? "?" : ""}: ${prop.type};\n\n`;
  }

  content += `}\n`;
  return content;
}

export function generateUpdateDto(pascalEntity: string, properties: PropertyInfo[]): string {
  let content = `import { ApiPropertyOptional } from "@nestjs/swagger";\n`;
  content += `import { IsOptional, IsString, IsNumber, IsBoolean, IsDate, IsArray } from "class-validator";\n\n`;
  content += `export class Update${pascalEntity}Dto {\n`;

  for (const prop of properties) {
    const decorators = ["@IsOptional()"];
    if (prop.type === "string") decorators.push("@IsString()");
    if (prop.type === "number") decorators.push("@IsNumber()");
    if (prop.type === "boolean") decorators.push("@IsBoolean()");
    if (prop.type === "Date") decorators.push("@IsDate()");
    if (prop.type.endsWith("[]")) decorators.push("@IsArray()");

    const apiOptions = [getApiPropertyType(prop.type)];
    if (prop.description) apiOptions.push(`description: "${prop.description}"`);
    decorators.push(`@ApiPropertyOptional({ ${apiOptions.join(", ")} })`);

    content += decorators.map(d => `  ${d}`).join("\n") + "\n";
    content += `  ${prop.name}?: ${prop.type};\n\n`;
  }

  content += `}\n`;
  return content;
}

function getApiPropertyType(type: string): string {
  if (type.endsWith("[]")) {
    const baseType = type.replace("[]", "");
    const swaggerType = getSwaggerPrimitiveType(baseType);
    return `type: () => [${swaggerType}]`;
  }
  
  const swaggerType = getSwaggerPrimitiveType(type);
  return `type: ${swaggerType}`;
}

function getSwaggerPrimitiveType(type: string): string {
  switch (type) {
    case "string":
      return "String";
    case "number":
      return "Number";
    case "boolean":
      return "Boolean";
    case "Date":
      return "Date";
    default:
      return type;
  }
}