import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  console.log("✅ NestJS DTO Generator activado");

  let disposable = vscode.commands.registerCommand(
    "nest-dto-generator.generateDto",
    async (uri?: vscode.Uri) => {
      try {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;

        if (!targetUri) {
          vscode.window.showErrorMessage(
            "No hay archivo seleccionado. Haz clic derecho sobre un archivo .entity.ts"
          );
          return;
        }

        const entityPath = targetUri.fsPath;

        if (!entityPath.endsWith(".entity.ts")) {
          vscode.window.showWarningMessage(
            "Este comando solo funciona con archivos .entity.ts"
          );
          return;
        }

        await generateDtoFromEntity(entityPath);
      } catch (error) {
        vscode.window.showErrorMessage(`Error generating DTO: ${error}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

async function generateDtoFromEntity(entityPath: string) {
  if (!fs.existsSync(entityPath)) {
    vscode.window.showErrorMessage(`Archivo no encontrado: ${entityPath}`);
    return;
  }

  const entityContent = fs.readFileSync(entityPath, "utf8");
  const entityName = path.basename(entityPath, ".entity.ts");
  const dtoName = `${entityName.replace(/Entity$/, "")}Dto`;

  const dtoContent = parseEntityAndGenerateDto(entityContent, dtoName);

  const dtoPath = entityPath.replace(".entity.ts", ".dto.ts");

  if (fs.existsSync(dtoPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      `El archivo ${path.basename(dtoPath)} ya existe. ¿Sobrescribir?`,
      "Sí",
      "No"
    );

    if (overwrite !== "Sí") return;
  }

  fs.writeFileSync(dtoPath, dtoContent);
  vscode.window.showInformationMessage(
    `DTO generado: ${path.basename(dtoPath)}`
  );

  const document = await vscode.workspace.openTextDocument(dtoPath);
  await vscode.window.showTextDocument(document);
}

// Convertir nombres con guiones o snake_case a camelCase
function toCamelCase(name: string): string {
  return name
    .replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    .replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

interface PropertyInfo {
  name: string;
  type: string;
  isOptional: boolean;
  description?: string;
  isRelation?: boolean;
  relationType?: string;
}

function parseEntityAndGenerateDto(entityContent: string, dtoName: string): string {
  const lines = entityContent.split("\n");
  const properties: PropertyInfo[] = [];
  let currentComment = "";
  let pendingRelationType: string | undefined;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Comentarios de una línea
    if (trimmedLine.startsWith("//")) {
      currentComment += trimmedLine.substring(2).trim() + " ";
      continue;
    }

    // Comentarios /** ... */
    const multiLineCommentMatch = trimmedLine.match(/\/\*\*(.*?)\*\//);
    if (multiLineCommentMatch) {
      currentComment += multiLineCommentMatch[1].trim() + " ";
      continue;
    }

    // Detectar relaciones
    const relationMatch = trimmedLine.match(/@(ManyToOne|OneToOne)\((?:\(\)\s*=>\s*(\w+))?/);
    if (relationMatch) {
      pendingRelationType = relationMatch[2];
      continue;
    }

    // Saltar líneas vacías
    if (trimmedLine === "") {
      currentComment = "";
      continue;
    }

    // Detectar propiedades
    const propertyMatch = trimmedLine.match(/^(\w+)\??:\s*([^;=]+)(?:\s*=.*?)?;/);
    if (propertyMatch && !trimmedLine.startsWith("@")) {
      let [, propertyName, propertyType] = propertyMatch;

      // Saltar id
      if (propertyName === "id") {
        currentComment = "";
        continue;
      }

      const isOptional = propertyName.endsWith("?");
      propertyName = toCamelCase(propertyName.replace("?", ""));
      propertyType = propertyType.trim();

      if (pendingRelationType) {
        // Crear propiedad de relación como RelacionId
        properties.push({
          name: propertyName + "Id",
          type: "number",
          isOptional,
          description: currentComment.trim() || `${pendingRelationType} ID`,
          isRelation: true,
          relationType: pendingRelationType,
        });
        pendingRelationType = undefined;
      } else {
        properties.push({
          name: propertyName,
          type: propertyType,
          isOptional,
          description: currentComment.trim() || undefined,
        });
      }

      currentComment = "";
    }

    if (
      trimmedLine.startsWith("export class") ||
      trimmedLine.startsWith("@Entity") ||
      trimmedLine.startsWith("@Column") ||
      trimmedLine.startsWith("@Primary")
    ) {
      currentComment = "";
    }
  }

  return generateDtoContent(dtoName, properties);
}

function generateDtoContent(dtoName: string, properties: PropertyInfo[]): string {
  const imports = new Set<string>();
  imports.add("ApiProperty");

  let content = `import { ApiProperty${
    properties.some((p) => p.isOptional) ? ", ApiPropertyOptional" : ""
  } } from '@nestjs/swagger';\n`;

  properties.forEach((prop) => {
    const validators = getValidatorsForType(prop.type, prop.isOptional);
    validators.forEach((v) => imports.add(v));
  });

  const validatorImports = Array.from(imports)
    .filter((imp) => imp.startsWith("Is") || imp === "ArrayNotEmpty")
    .sort();

  if (validatorImports.length > 0) {
    content += `import { ${validatorImports.join(", ")} } from 'class-validator';\n`;
  }

  content += `\nexport class ${dtoName} {\n`;

  for (const prop of properties) {
    const decorators = generateDecorators(prop);
    content += `\n`;
    if (decorators.validators) content += `  ${decorators.validators}\n`;
    content += `  ${decorators.apiProperty}\n`;
    const typeMapping = mapTypeToDto(prop.type);
    content += `  ${prop.name}${prop.isOptional ? "?" : ""}: ${typeMapping.dtoType};\n`;
  }

  content += `}\n`;

  return content;
}

function generateDecorators(prop: PropertyInfo): { apiProperty: string; validators: string } {
  const typeMapping = mapTypeToDto(prop.type);
  const decoratorName = prop.isOptional ? "ApiPropertyOptional" : "ApiProperty";

  let apiProperty = `@${decoratorName}({`;
  const apiOptions: string[] = [];

  if (prop.description) apiOptions.push(`description: '${prop.description.replace(/'/g, "\\'")}'`);
  apiOptions.push(`type: () => ${typeMapping.swaggerType}`);
  if (!prop.isOptional) apiOptions.push(`required: true`);
  if (typeMapping.example) apiOptions.push(`example: ${typeMapping.example}`);

  apiProperty += apiOptions.join(", ") + " })";

  const validators = getValidatorsForType(prop.type, prop.isOptional);
  const validatorsString = validators.map((v) => `@${v}()`).join("\n  ");

  return { apiProperty, validators: validatorsString };
}

function getValidatorsForType(type: string, isOptional: boolean): string[] {
  const validators: string[] = [];
  const isArray = type.endsWith("[]");
  const baseType = isArray ? type.slice(0, -2) : type;

  if (!isOptional) {
    if (isArray) validators.push("ArrayNotEmpty");
    else validators.push("IsNotEmpty");
  } else validators.push("IsOptional");

  if (isArray) validators.push("IsArray");

  if (isArray) {
    if (baseType === "string") validators.push("IsString");
    else if (baseType === "number") validators.push("IsNumber");
    else if (baseType === "boolean") validators.push("IsBoolean");
  } else {
    if (type === "string" || type.includes("string")) validators.push("IsString");
    else if (type === "number" || type.includes("number")) validators.push("IsNumber");
    else if (type === "boolean" || type.includes("boolean")) validators.push("IsBoolean");
    else if (type === "Date") validators.push("IsDate");
  }

  return validators;
}

function mapTypeToDto(type: string): { dtoType: string; swaggerType: string; example?: string } {
  const isArray = type.endsWith("[]");
  const baseType = isArray ? type.slice(0, -2) : type;

  const typeMappings: Record<string, { dtoType: string; swaggerType: string; example?: string }> = {
    string: { dtoType: "string", swaggerType: "String", example: `'example'` },
    number: { dtoType: "number", swaggerType: "Number", example: "1" },
    boolean: { dtoType: "boolean", swaggerType: "Boolean", example: "true" },
    Date: { dtoType: "string", swaggerType: "String", example: `'2023-01-01T00:00:00.000Z'` },
    String: { dtoType: "string", swaggerType: "String", example: `'example'` },
    Number: { dtoType: "number", swaggerType: "Number", example: "1" },
    Boolean: { dtoType: "boolean", swaggerType: "Boolean", example: "true" },
  };

  const mapping = typeMappings[baseType] || { dtoType: "any", swaggerType: "Object" };

  return isArray
    ? { dtoType: `${mapping.dtoType}[]`, swaggerType: mapping.swaggerType, example: mapping.example ? `[${mapping.example}]` : undefined }
    : mapping;
}

export function deactivate() {}
