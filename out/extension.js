"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
function activate(context) {
    console.log("✅ NestJS DTO & CRUD Generator activated");
    const dtoDisposable = vscode.commands.registerCommand("nest-dto-generator.generateDto", async (uri) => {
        try {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage("No file selected. Right-click on a .entity.ts file");
                return;
            }
            if (!targetUri.fsPath.endsWith(".entity.ts")) {
                vscode.window.showWarningMessage("This command only works with .entity.ts files");
                return;
            }
            await generateDto(targetUri.fsPath);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error generating DTO: ${err.message}`);
        }
    });
    const repositoryDisposable = vscode.commands.registerCommand("nest-dto-generator.generateRepository", async (uri) => {
        try {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage("No file selected. Right-click on a .entity.ts file");
                return;
            }
            if (!targetUri.fsPath.endsWith(".entity.ts")) {
                vscode.window.showWarningMessage("This command only works with .entity.ts files");
                return;
            }
            await generateRepository(targetUri.fsPath);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error generating Repository: ${err.message}`);
        }
    });
    const serviceDisposable = vscode.commands.registerCommand("nest-dto-generator.generateService", async (uri) => {
        try {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage("No file selected. Right-click on a .entity.ts file");
                return;
            }
            if (!targetUri.fsPath.endsWith(".entity.ts")) {
                vscode.window.showWarningMessage("This command only works with .entity.ts files");
                return;
            }
            await generateService(targetUri.fsPath);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error generating Service: ${err.message}`);
        }
    });
    const controllerDisposable = vscode.commands.registerCommand("nest-dto-generator.generateController", async (uri) => {
        try {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage("No file selected. Right-click on a .entity.ts or .service.ts file");
                return;
            }
            const fileName = path.basename(targetUri.fsPath);
            let servicePath;
            let pascalEntity;
            let camelEntity;
            if (fileName.endsWith(".entity.ts")) {
                pascalEntity = toPascalCase(fileName.replace(".entity.ts", ""));
                camelEntity = toCamelCase(pascalEntity);
                const moduleFolder = path.dirname(path.dirname(targetUri.fsPath));
                servicePath = path.join(moduleFolder, "services", `${pascalEntity}.service.ts`);
            }
            else if (fileName.endsWith(".service.ts")) {
                servicePath = targetUri.fsPath;
                pascalEntity = toPascalCase(fileName.replace(".service.ts", ""));
                camelEntity = toCamelCase(pascalEntity);
            }
            else {
                vscode.window.showWarningMessage("This command only works with .entity.ts or .service.ts files");
                return;
            }
            if (!fs.existsSync(servicePath)) {
                vscode.window.showErrorMessage(`Service file not found: ${servicePath}`);
                return;
            }
            const serviceContent = fs.readFileSync(servicePath, "utf8");
            const controllerFolder = path.join(path.dirname(servicePath), "../controllers");
            fs.mkdirSync(controllerFolder, { recursive: true });
            const controllerPath = path.join(controllerFolder, `${pascalEntity}.controller.ts`);
            const controllerContent = generateControllerContentFromService(serviceContent, camelEntity, pascalEntity);
            await writeFileSafely(controllerPath, controllerContent, "Controller generated");
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error generating Controller: ${err.message}`);
        }
    });
    const crudDisposable = vscode.commands.registerCommand("nest-dto-generator.generateCrud", async (uri) => {
        try {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage("No file selected. Right-click on a .entity.ts file");
                return;
            }
            if (!targetUri.fsPath.endsWith(".entity.ts")) {
                vscode.window.showWarningMessage("This command only works with .entity.ts files");
                return;
            }
            await generateCrud(targetUri.fsPath);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error generating CRUD: ${err.message}`);
        }
    });
    context.subscriptions.push(dtoDisposable, repositoryDisposable, serviceDisposable, controllerDisposable, crudDisposable);
}
exports.activate = activate;
// Individual command for DTO
async function generateDto(entityPath) {
    const entityContent = fs.readFileSync(entityPath, "utf8");
    const entityName = path.basename(entityPath, ".entity.ts");
    const pascalEntity = toPascalCase(entityName.replace(/\.entity$/i, ""));
    const camelEntity = toCamelCase(pascalEntity);
    const properties = parseEntityProperties(entityContent);
    // Generate Create DTO
    const createDtoContent = generateCreateDtoContent(pascalEntity, properties);
    const createDtoPath = getDtoPath(entityPath, camelEntity, "create");
    await writeFileSafely(createDtoPath, createDtoContent, "Create DTO generated");
    // Generate Update DTO
    const updateDtoContent = generateUpdateDtoContent(pascalEntity, properties);
    const updateDtoPath = getDtoPath(entityPath, camelEntity, "update");
    await writeFileSafely(updateDtoPath, updateDtoContent, "Update DTO generated");
}
// Individual command for Repository
async function generateRepository(entityPath) {
    const entityName = path.basename(entityPath, ".entity.ts");
    const pascalEntity = toPascalCase(entityName.replace(/\.entity$/i, ""));
    const camelEntity = toCamelCase(pascalEntity);
    const moduleFolder = path.dirname(path.dirname(entityPath));
    const repoFolder = path.join(moduleFolder, "repositories");
    fs.mkdirSync(repoFolder, { recursive: true });
    const repoPath = path.join(repoFolder, `${pascalEntity}.repository.ts`);
    const repoContent = generateRepositoryContent(camelEntity, pascalEntity);
    await writeFileSafely(repoPath, repoContent, "Repository generated");
}
// Individual command for Service
async function generateService(entityPath) {
    const entityName = path.basename(entityPath, ".entity.ts");
    const pascalEntity = toPascalCase(entityName.replace(/\.entity$/i, ""));
    const camelEntity = toCamelCase(pascalEntity);
    const moduleFolder = path.dirname(path.dirname(entityPath));
    const serviceFolder = path.join(moduleFolder, "services");
    fs.mkdirSync(serviceFolder, { recursive: true });
    const servicePath = path.join(serviceFolder, `${pascalEntity}.service.ts`);
    const serviceContent = generateServiceContent(camelEntity, pascalEntity);
    await writeFileSafely(servicePath, serviceContent, "Service generated");
}
// Individual command for Controller
async function generateController(entityPath) {
    const entityName = path.basename(entityPath, ".entity.ts");
    const pascalEntity = toPascalCase(entityName.replace(/\.entity$/i, ""));
    const camelEntity = toCamelCase(pascalEntity);
    const moduleFolder = path.dirname(path.dirname(entityPath));
    const serviceFolder = path.join(moduleFolder, "services");
    const servicePath = path.join(serviceFolder, `${pascalEntity}.service.ts`);
    if (!fs.existsSync(servicePath)) {
        vscode.window.showErrorMessage(`Service file not found: ${servicePath}. Generate the service first.`);
        return;
    }
    const serviceContent = fs.readFileSync(servicePath, "utf8");
    const controllerFolder = path.join(moduleFolder, "controllers");
    fs.mkdirSync(controllerFolder, { recursive: true });
    const controllerPath = path.join(controllerFolder, `${pascalEntity}.controller.ts`);
    const controllerContent = generateControllerContentFromService(serviceContent, camelEntity, pascalEntity);
    await writeFileSafely(controllerPath, controllerContent, "Controller generated");
}
// Full CRUD command (generates everything)
async function generateCrud(entityPath) {
    await generateDto(entityPath);
    await generateRepository(entityPath);
    await generateService(entityPath);
    await generateController(entityPath);
    vscode.window.showInformationMessage("✅ Full CRUD generated successfully");
}
// Helper to get DTO path
function getDtoPath(entityPath, camelEntity, type) {
    const moduleFolder = path.dirname(path.dirname(entityPath));
    const dtoFolder = path.join(moduleFolder, "dto", camelEntity);
    fs.mkdirSync(dtoFolder, { recursive: true });
    return path.join(dtoFolder, `${type}-${camelEntity}.dto.ts`);
}
// PascalCase - First letter of each word uppercase
function toPascalCase(str) {
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
        .replace(/^(.)/, (match) => match.toUpperCase());
}
// CamelCase - First letter lowercase, rest like PascalCase
function toCamelCase(str) {
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
        .replace(/^[A-Z]/, (match) => match.toLowerCase());
}
function parseEntityProperties(entityContent) {
    const lines = entityContent.split("\n");
    const properties = [];
    let currentComment = "";
    for (const line of lines) {
        const trimmed = line.trim();
        // Comments
        if (trimmed.startsWith("//")) {
            currentComment += trimmed.substring(2).trim() + " ";
            continue;
        }
        // Relations @ManyToOne/@OneToOne/@ManyToMany
        const relationMatch = trimmed.match(/@(ManyToOne|OneToOne|ManyToMany)\(([^)]*)\)\s*(\w+)?\s*:/);
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
        // Normal properties
        const propMatch = trimmed.match(/^(\w+)\??:\s*([^;]+);/);
        if (propMatch) {
            let [, name, type] = propMatch;
            if (name === "id")
                continue;
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
function generateCreateDtoContent(pascalEntity, properties) {
    let content = `import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";\n`;
    content += `import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, IsDate, IsArray, ArrayNotEmpty } from "class-validator";\n\n`;
    content += `export class Create${pascalEntity}Dto {\n`;
    for (const prop of properties) {
        const decorators = [];
        // In Create DTO, optional properties keep @IsOptional()
        if (prop.isOptional) {
            decorators.push("@IsOptional()");
        }
        else {
            decorators.push("@IsNotEmpty()");
        }
        // Type validations
        if (prop.type === "string")
            decorators.push("@IsString()");
        else if (prop.type === "number")
            decorators.push("@IsNumber()");
        else if (prop.type === "boolean")
            decorators.push("@IsBoolean()");
        else if (prop.type === "Date")
            decorators.push("@IsDate()");
        if (prop.type.endsWith("[]")) {
            decorators.push("@IsArray()");
            decorators.push("@ArrayNotEmpty()");
        }
        const apiDecorator = prop.isOptional
            ? "ApiPropertyOptional"
            : "ApiProperty";
        const apiOptions = [`type: () => ${prop.type.replace("[]", "")}`];
        if (prop.description)
            apiOptions.push(`description: "${prop.description}"`);
        decorators.push(`@${apiDecorator}({ ${apiOptions.join(", ")} })`);
        content += "  " + decorators.join("\n  ") + `\n`;
        content += `  ${prop.name}${prop.isOptional ? "?" : ""}: ${prop.type};\n\n`;
    }
    content += `}\n`;
    return content;
}
function generateUpdateDtoContent(pascalEntity, properties) {
    let content = `import { ApiPropertyOptional } from "@nestjs/swagger";\n`;
    content += `import { IsOptional, IsString, IsNumber, IsBoolean, IsDate, IsArray } from "class-validator";\n\n`;
    content += `export class Update${pascalEntity}Dto {\n`;
    for (const prop of properties) {
        const decorators = [];
        // In Update DTO, all properties are optional
        decorators.push("@IsOptional()");
        // Type validations (only if value is provided)
        if (prop.type === "string")
            decorators.push("@IsString()");
        else if (prop.type === "number")
            decorators.push("@IsNumber()");
        else if (prop.type === "boolean")
            decorators.push("@IsBoolean()");
        else if (prop.type === "Date")
            decorators.push("@IsDate()");
        if (prop.type.endsWith("[]")) {
            decorators.push("@IsArray()");
        }
        const apiOptions = [`type: () => ${prop.type.replace("[]", "")}`];
        if (prop.description)
            apiOptions.push(`description: "${prop.description}"`);
        decorators.push(`@ApiPropertyOptional({ ${apiOptions.join(", ")} })`);
        content += "  " + decorators.join("\n  ") + `\n`;
        content += `  ${prop.name}?: ${prop.type};\n\n`;
    }
    content += `}\n`;
    return content;
}
function generateRepositoryContent(camelEntity, pascalEntity) {
    return `import { Repository, DataSource, UpdateResult, DeleteResult } from "typeorm";
import { Injectable } from "@nestjs/common";
import { ${pascalEntity} } from "../entities/${camelEntity}.entity";
import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";

@Injectable()
export class ${pascalEntity}Repository extends Repository<${pascalEntity}> {
  constructor(private dataSource: DataSource) {
    super(${pascalEntity}, dataSource.createEntityManager());
  }

  async createEntity(dto: Partial<${pascalEntity}>): Promise<${pascalEntity}> {
    const entity = this.create(dto);
    return await this.save(entity);
  }

  async updateEntity(id: number, dto: Partial<${pascalEntity}>): Promise<UpdateResult> {
    return await this.update(id, dto);
  }

  async findAllEntities(page = 1, limit = 10): Promise<PaginatedResponseDto<${pascalEntity}>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.findAndCount({ 
      skip, 
      take: limit 
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneEntity(id: number): Promise<${pascalEntity} | null> {
    return await this.findOne({ where: { id } });
  }
  
  async removeEntity(id: number): Promise<DeleteResult> {
    return await this.delete(id);
  }
}
`;
}
function generateServiceContent(camelEntity, pascalEntity) {
    return `import { Injectable, NotFoundException } from "@nestjs/common";
import { ${pascalEntity}Repository } from "../repositories/${camelEntity}.repository";
import { ${pascalEntity} } from "../entities/${camelEntity}.entity";
import { Create${pascalEntity}Dto } from "../dto/${camelEntity}/create-${camelEntity}.dto";
import { Update${pascalEntity}Dto } from "../dto/${camelEntity}/update-${camelEntity}.dto";
import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";
import { UpdateResult, DeleteResult } from "typeorm";

@Injectable()
export class ${pascalEntity}Service {
  constructor(private readonly repository: ${pascalEntity}Repository) {}

  async create(createDto: Create${pascalEntity}Dto): Promise<${pascalEntity}> {
    return await this.repository.createEntity(createDto);
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedResponseDto<${pascalEntity}>> {
    return await this.repository.findAllEntities(page, limit);
  }

  async findOne(id: number): Promise<${pascalEntity}> {
    const entity = await this.repository.findOneEntity(id);
    if (!entity) {
      throw new NotFoundException(\`${pascalEntity} with ID \${id} not found\`);
    }
    return entity;
  }

  async update(id: number, updateDto: Update${pascalEntity}Dto): Promise<UpdateResult> {
    await this.findOne(id); // Verify existence
    return await this.repository.updateEntity(id, updateDto);
  }

  async remove(id: number): Promise<DeleteResult> {
    await this.findOne(id); // Verify existence
    return await this.repository.removeEntity(id);
  }
}
`;
}
function parseServiceMethods(serviceContent) {
    const lines = serviceContent.split("\n");
    const methods = [];
    let currentMethod = null;
    let braceCount = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed ||
            trimmed.startsWith("import") ||
            trimmed.startsWith("export"))
            continue;
        // Detect method start: [modifiers] name(params): returnType {
        const methodMatch = trimmed.match(/^(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*([^{]+)\s*{/);
        if (methodMatch) {
            const [, name, paramsStr, returnTypeStr] = methodMatch;
            currentMethod = {
                name: name.trim(),
                params: [],
                returnType: returnTypeStr.trim(),
            };
            // Parse params
            if (paramsStr.trim()) {
                const params = paramsStr
                    .split(",")
                    .map((p) => p.trim().match(/^(\w+)(\??):\s*(.+)$/));
                if (params) {
                    currentMethod.params = params.filter(Boolean).map((pm) => {
                        const [, paramName, optional, paramType] = pm;
                        return {
                            name: paramName,
                            type: paramType.trim(),
                            isOptional: optional === "?" || false,
                        };
                    });
                }
            }
            braceCount = 1;
            continue;
        }
        if (currentMethod && braceCount > 0) {
            // Count braces to detect method end
            braceCount +=
                (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
            if (braceCount <= 0) {
                if (currentMethod.name) {
                    methods.push(currentMethod);
                }
                currentMethod = null;
                braceCount = 0;
                continue;
            }
            // Parse params inside method declaration if needed, but since params are in the signature, parse from match
            // Actually, better to parse params from the methodMatch
        }
    }
    // Enhanced param parsing from full content or fallback to common patterns
    // For simplicity, assume standard signatures and parse accordingly
    // In practice, use a more robust parser, but here use regex on the whole content
    const methodRegex = /async\s+(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*{/g;
    let match;
    while ((match = methodRegex.exec(serviceContent)) !== null) {
        const name = match[1];
        const paramsStr = match[2].trim();
        const returnType = match[3].trim();
        const params = [];
        if (paramsStr) {
            const paramMatches = paramsStr
                .split(",")
                .map((p) => p.trim().match(/^(\w+)(?:\s*=\s*(.*))?\s*:\s*(\w+)$/));
            for (const paramMatch of paramMatches.filter(Boolean)) {
                if (paramMatch) {
                    const [, paramName, defaultVal, paramType] = paramMatch;
                    params.push({
                        name: paramName,
                        type: paramType,
                        isOptional: !!defaultVal || paramName.endsWith("?"),
                        defaultValue: defaultVal || undefined,
                    });
                }
            }
        }
        methods.push({ name, params, returnType });
    }
    return methods.filter((m) => m.name &&
        (m.name === "create" ||
            m.name === "findAll" ||
            m.name === "findOne" ||
            m.name === "update" ||
            m.name === "remove"));
}
function generateControllerContentFromService(serviceContent, camelEntity, pascalEntity) {
    const methods = parseServiceMethods(serviceContent);
    // Collect imports dynamically
    const commonImports = [
        "Controller",
        "Get",
        "Post",
        "Body",
        "Param",
        "Patch",
        "Delete",
        "ParseIntPipe",
        "Query",
    ];
    const swaggerImports = [
        "ApiTags",
        "ApiOperation",
        "ApiResponse",
        "ApiQuery",
        "ApiParam",
    ];
    const dtoImportsSet = new Set();
    const typeOrmImportsSet = new Set();
    let needsPaginated = false;
    let needsEntity = false;
    // Add DTO and TypeORM imports based on methods
    for (const method of methods) {
        if (method.name === "create") {
            dtoImportsSet.add(`import { Create${pascalEntity}Dto } from "../dto/${camelEntity}/create-${camelEntity}.dto";`);
            needsEntity = true;
        }
        else if (method.name === "update") {
            dtoImportsSet.add(`import { Update${pascalEntity}Dto } from "../dto/${camelEntity}/update-${camelEntity}.dto";`);
            typeOrmImportsSet.add("UpdateResult");
            needsEntity = true;
        }
        else if (method.name === "remove") {
            typeOrmImportsSet.add("DeleteResult");
            needsEntity = true;
        }
        else if (method.name === "findAll") {
            needsPaginated = true;
        }
        else if (method.name === "findOne") {
            needsEntity = true;
        }
    }
    let content = `import {\n  ${commonImports.join(",\n  ")}\n} from "@nestjs/common";\n\n`;
    content += `import {\n  ${swaggerImports.join(",\n  ")}\n} from "@nestjs/swagger";\n\n`;
    let serviceImport = `import { ${pascalEntity}Service } from "../services/${camelEntity}.service";\n`;
    content += `${serviceImport}`;
    if (needsEntity) {
        let entityImport = `import { ${pascalEntity} } from "../entities/${camelEntity}.entity";\n`;
        content += `${entityImport}`;
    }
    if (needsPaginated) {
        let paginatedImport = `import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";\n`;
        content += `${paginatedImport}`;
    }
    if (dtoImportsSet.size > 0) {
        content += `\n${Array.from(dtoImportsSet).join("\n")}\n`;
    }
    if (typeOrmImportsSet.size > 0) {
        content += `import { ${Array.from(typeOrmImportsSet).join(", ")} } from "typeorm";\n`;
    }
    content += `\n@ApiTags("${pascalEntity}")\n@Controller("${camelEntity}")\nexport class ${pascalEntity}Controller {\n`;
    content += `  constructor(private readonly service: ${pascalEntity}Service) {}\n\n`;
    for (const method of methods) {
        let httpDecorator = "";
        let operationSummary = "";
        let apiResponses = [];
        let apiParamDecorators = [];
        let apiQueryDecorators = [];
        let methodParams = [];
        let callParams = [];
        switch (method.name) {
            case "create":
                httpDecorator = "@Post()";
                operationSummary = `Create a new ${pascalEntity}`;
                apiResponses.push(`@ApiResponse({ status: 201, description: "Entity created", type: ${pascalEntity} })`);
                const createDtoParam = method.params.find((p) => p.type.includes("Create")) || { name: "createDto", type: `Create${pascalEntity}Dto` };
                methodParams.push(`@Body() ${createDtoParam.name}: ${createDtoParam.type}`);
                callParams.push(createDtoParam.name);
                break;
            case "findAll":
                httpDecorator = "@Get()";
                operationSummary = `List all ${pascalEntity} entities`;
                apiResponses.push(`@ApiResponse({ status: 200, description: "List of entities", type: PaginatedResponseDto<${pascalEntity}> })`);
                apiQueryDecorators.push(`@ApiQuery({ name: "page", type: Number, description: "Pagination page", required: false, default: 1 })`);
                apiQueryDecorators.push(`@ApiQuery({ name: "limit", type: Number, description: "Pagination limit", required: false, default: 10 })`);
                const pageParam = method.params.find((p) => p.name === "page") || {
                    name: "page",
                    type: "number",
                    defaultValue: "1",
                };
                const limitParam = method.params.find((p) => p.name === "limit") || {
                    name: "limit",
                    type: "number",
                    defaultValue: "10",
                };
                methodParams.push(`@Query("page", ParseIntPipe) ${pageParam.name} = ${pageParam.defaultValue || 1}`);
                methodParams.push(`@Query("limit", ParseIntPipe) ${limitParam.name} = ${limitParam.defaultValue || 10}`);
                callParams.push(pageParam.name, limitParam.name);
                break;
            case "findOne":
                httpDecorator = "@Get(':id')";
                operationSummary = `Get ${pascalEntity} by id`;
                apiResponses.push(`@ApiResponse({ status: 200, description: "Entity found", type: ${pascalEntity} })`);
                apiParamDecorators.push(`@ApiParam({ name: "id", description: "Entity ID", type: Number })`);
                const idParam = method.params.find((p) => p.name === "id") || {
                    name: "id",
                    type: "number",
                };
                methodParams.push(`@Param("id", ParseIntPipe) ${idParam.name}: number`);
                callParams.push(idParam.name);
                break;
            case "update":
                httpDecorator = "@Patch(':id')";
                operationSummary = `Update ${pascalEntity} by id`;
                apiResponses.push(`@ApiResponse({ status: 200, description: "Entity updated" })`);
                const updateIdParam = method.params.find((p) => p.name === "id") || {
                    name: "id",
                    type: "number",
                };
                apiParamDecorators.push(`@ApiParam({ name: "id", description: "Entity ID", type: Number })`);
                const updateDtoParam = method.params.find((p) => p.type.includes("Update")) || { name: "updateDto", type: `Update${pascalEntity}Dto` };
                methodParams.push(`@Param("id", ParseIntPipe) ${updateIdParam.name}: number`);
                methodParams.push(`@Body() ${updateDtoParam.name}: ${updateDtoParam.type}`);
                callParams.push(updateIdParam.name, updateDtoParam.name);
                break;
            case "remove":
                httpDecorator = "@Delete(':id')";
                operationSummary = `Delete ${pascalEntity} by id`;
                apiResponses.push(`@ApiResponse({ status: 200, description: "Entity deleted" })`);
                const removeIdParam = method.params.find((p) => p.name === "id") || {
                    name: "id",
                    type: "number",
                };
                apiParamDecorators.push(`@ApiParam({ name: "id", description: "Entity ID", type: Number })`);
                methodParams.push(`@Param("id", ParseIntPipe) ${removeIdParam.name}: number`);
                callParams.push(removeIdParam.name);
                break;
        }
        content += `  ${httpDecorator}\n`;
        if (apiQueryDecorators.length > 0) {
            apiQueryDecorators.forEach((dec) => (content += `  ${dec}\n`));
        }
        if (apiParamDecorators.length > 0) {
            apiParamDecorators.forEach((dec) => (content += `  ${dec}\n`));
        }
        content += `  @ApiOperation({ summary: "${operationSummary}" })\n`;
        apiResponses.forEach((resp) => (content += `  ${resp}\n`));
        content += `  ${method.name}(${methodParams.join(", ")}): Promise<${method.returnType}> {\n`;
        content += `    return this.service.${method.name}(${callParams.join(", ")});\n`;
        content += `  }\n\n`;
    }
    content += `}\n`;
    return content;
}
async function writeFileSafely(filePath, content, message) {
    if (fs.existsSync(filePath)) {
        const overwrite = await vscode.window.showWarningMessage(`The file ${path.basename(filePath)} already exists. Overwrite?`, "Yes", "No");
        if (overwrite !== "Yes")
            return;
    }
    fs.writeFileSync(filePath, content, "utf8");
    vscode.window.showInformationMessage(`${message}: ${path.basename(filePath)}`);
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map