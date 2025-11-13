import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  console.log("✅ NestJS DTO & CRUD Generator activado");

  const dtoDisposable = vscode.commands.registerCommand(
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

        if (!targetUri.fsPath.endsWith(".entity.ts")) {
          vscode.window.showWarningMessage(
            "Este comando solo funciona con archivos .entity.ts"
          );
          return;
        }

        await generateDto(targetUri.fsPath);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error generando DTO: ${err.message}`);
      }
    }
  );

  const crudDisposable = vscode.commands.registerCommand(
    "nest-dto-generator.generateCrud",
    async (uri?: vscode.Uri) => {
      try {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!targetUri) {
          vscode.window.showErrorMessage(
            "No hay archivo seleccionado. Haz clic derecho sobre un archivo .entity.ts"
          );
          return;
        }

        if (!targetUri.fsPath.endsWith(".entity.ts")) {
          vscode.window.showWarningMessage(
            "Este comando solo funciona con archivos .entity.ts"
          );
          return;
        }

        await generateCrud(targetUri.fsPath);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error generando CRUD: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(dtoDisposable, crudDisposable);
}

async function generateDto(entityPath: string) {
  const entityContent = fs.readFileSync(entityPath, "utf8");
  const entityName = path.basename(entityPath, ".entity.ts");
  const dtoName = `${entityName.replace(/Entity$/, "")}Dto`;

  const properties = parseEntityProperties(entityContent);
  const dtoContent = generateDtoContent(dtoName, properties);

  // Carpeta dto al mismo nivel que el módulo
  const folder = path.dirname(entityPath);
  const dtoFolder = path.join(folder, "..", "dto");
  fs.mkdirSync(dtoFolder, { recursive: true });

  const dtoPath = path.join(dtoFolder, `${dtoName}.ts`);
  await writeFileSafely(dtoPath, dtoContent, "DTO generado");
}

async function generateCrud(entityPath: string) {
  const entityContent = fs.readFileSync(entityPath, "utf8");
  const entityName = path.basename(entityPath, ".entity.ts");
  const pascalEntity = entityName.replace(/\.entity$/i, "");
  const camelEntity = toCamelCase(pascalEntity);

  // Carpeta base del módulo (fuera de entities)
  const moduleFolder = path.dirname(path.dirname(entityPath));
  const repoFolder = path.join(moduleFolder, "repositories");
  const serviceFolder = path.join(moduleFolder, "services");

  fs.mkdirSync(repoFolder, { recursive: true });
  fs.mkdirSync(serviceFolder, { recursive: true });

  // Repository
  const repoPath = path.join(repoFolder, `${pascalEntity}.repository.ts`);
  const repoContent = generateRepositoryContent(camelEntity, pascalEntity);
  await writeFileSafely(repoPath, repoContent, "Repository generado");

  // Service
  const servicePath = path.join(serviceFolder, `${pascalEntity}.service.ts`);
  const serviceContent = generateServiceContent(camelEntity, pascalEntity);
  await writeFileSafely(servicePath, serviceContent, "Service generado");
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (match) => match.toLowerCase());
}

interface PropertyInfo {
  name: string;
  type: string;
  isOptional: boolean;
  isRelationId?: boolean;
  description?: string;
}

function parseEntityProperties(entityContent: string): PropertyInfo[] {
  const lines = entityContent.split("\n");
  const properties: PropertyInfo[] = [];
  let currentComment = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Comentarios
    if (trimmed.startsWith("//")) {
      currentComment += trimmed.substring(2).trim() + " ";
      continue;
    }

    // Relaciones @ManyToOne/@OneToOne/@ManyToMany
    const relationMatch = trimmed.match(
      /@(ManyToOne|OneToOne|ManyToMany)\(([^)]*)\)\s*(\w+)?\s*:/
    );
    if (relationMatch) {
      const [, , , name] = relationMatch;
      const propName = toCamelCase((name || "relation") + "Id");
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

    // Propiedades normales
    const propMatch = trimmed.match(/^(\w+)\??:\s*([^;]+);/);
    if (propMatch) {
      let [, name, type] = propMatch;
      if (name === "id") continue;

      const camelName = toCamelCase(name);
      properties.push({
        name: camelName,
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

function generateDtoContent(
  dtoName: string,
  properties: PropertyInfo[]
): string {
  let content = `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';\n`;
  content += `import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, IsDate, IsArray, ArrayNotEmpty } from 'class-validator';\n\n`;
  content += `export class ${dtoName} {\n`;

  for (const prop of properties) {
    const decorators: string[] = [];

    if (prop.isOptional) decorators.push("@IsOptional()");
    else decorators.push("@IsNotEmpty()");

    if (prop.type === "string") decorators.push("@IsString()");
    else if (prop.type === "number") decorators.push("@IsNumber()");
    else if (prop.type === "boolean") decorators.push("@IsBoolean()");
    else if (prop.type === "Date") decorators.push("@IsDate()");

    if (prop.type.endsWith("[]")) {
      decorators.push("@IsArray()");
      decorators.push("@ArrayNotEmpty()");
    }

    const apiDecorator = prop.isOptional
      ? "ApiPropertyOptional"
      : "ApiProperty";
    const apiOptions = [`type: () => ${prop.type.replace("[]", "")}`];
    if (prop.description) apiOptions.push(`description: '${prop.description}'`);
    decorators.push(`@${apiDecorator}({ ${apiOptions.join(", ")} })`);

    content += "  " + decorators.join("\n  ") + `\n`;
    content += `  ${prop.name}${prop.isOptional ? "?" : ""}: ${prop.type};\n\n`;
  }

  content += `}\n`;
  return content;
}

function generateRepositoryContent(
  pascalEntity: string,
  camelEntity: string
): string {
  return `import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ${pascalEntity} } from '../entities/${camelEntity}.entity';
import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";

@Injectable()
export class ${pascalEntity}Repository extends Repository<${pascalEntity}> {
  constructor(private dataSource: DataSource) {
    super(${pascalEntity}, dataSource.createEntityManager());
  }

  async createEntity(dto: any): Promise<${pascalEntity}> {
    const entity = this.create(dto);
    return await this.save(entity);
  }

  async updateEntity(id: number, dto: any): Promise<${pascalEntity}> {
    await this.update(id, dto);
    return this.findOne({ where: { id } });
  }

  async findAllEntities(skip = 0, take = 10): Promise<PaginatedResponseDto<T>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.repo.findAndCount({ skip, take: limit });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
`;
}

function generateServiceContent(
  pascalEntity: string,
  camelEntity: string
): string {
  return `import { Injectable } from '@nestjs/common';
import { ${pascalEntity}Repository } from '../repository/${camelEntity}.repository';
import { ${pascalEntity} } from '../entities/${camelEntity}.entity';

@Injectable()
export class ${pascalEntity}Service {
  constructor(private readonly repository: ${pascalEntity}Repository) {}

  async create(dto: any): Promise<${pascalEntity}> {
    return this.repository.createEntity(dto);
  }

  async update(id: number, dto: any): Promise<${pascalEntity}> {
    return this.repository.updateEntity(id, dto);
  }

  async findAll(page = 1, limit = 10): Promise<${pascalEntity}[]> {
    const skip = (page - 1) * limit;
    return this.repository.findAllEntities(skip, limit);
  }

  async findOne(id: number): Promise<${pascalEntity}> {
    return this.repository.findOne({ where: { id } });
  }
}
`;
}

async function writeFileSafely(
  filePath: string,
  content: string,
  message: string
) {
  if (fs.existsSync(filePath)) {
    const overwrite = await vscode.window.showWarningMessage(
      `El archivo ${path.basename(filePath)} ya existe. ¿Sobrescribir?`,
      "Sí",
      "No"
    );
    if (overwrite !== "Sí") return;
  }
  fs.writeFileSync(filePath, content, "utf8");
  vscode.window.showInformationMessage(
    `${message}: ${path.basename(filePath)}`
  );
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}

export function deactivate() {}
