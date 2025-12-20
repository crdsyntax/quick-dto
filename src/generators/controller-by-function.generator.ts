import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  body: string;
  httpMethod: string;
  route: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  decorator: string;
}

export interface ModuleInfo {
  className: string;
  camelName: string;
  modulePath: string;
}

export function parseFunction(functionText: string): FunctionInfo | null {
  const functionPatterns = [
    /async\s+(\w+)\(\s*(\w+)\s*:\s*number\s*\)\s*:\s*Promise<(\w+)>\s*\{[^}]*findOne[^}]*NotFoundException[^}]*\}/s,
    /async\s+(\w+)\(\s*\)\s*:\s*Promise<(\w+)\[\]>\s*\{[^}]*findAll[^}]*\}/s,
    /async\s+(\w+)\(\s*(\w+)\s*:\s*(\w+Dto)\s*\)\s*:\s*Promise<(\w+)>\s*\{[^}]*create[^}]*\}/s,
    /async\s+(\w+)\(\s*(\w+)\s*:\s*number\s*,\s*(\w+)\s*:\s*(\w+Dto)\s*\)\s*:\s*Promise<(\w+)>\s*\{[^}]*update[^}]*\}/s,
    /async\s+(\w+)\(\s*(\w+)\s*:\s*number\s*\)\s*:\s*Promise<(\w+)>\s*\{[^}]*remove[^}]*\}/s,
    /async\s+(\w+)\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*\{([^}]+)\}/,

    
    /(?:public|private|protected|async|\s)*\s*(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*\{[^}]*\}/s,
    /(?:public|private|protected|async|\s)*(\w+)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_<>\[\]]+)\s*\{[^}]*\}/s,
    /(\w+)\s*=\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*=>\s*\{[^}]*\}/s,
    /(?:public|private|protected|async|\s)*(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*=>\s*[^;]+;/s,
    /(?:async\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*\{/s,
    /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*(void|any|unknown|[\w<>[\]]+)\s*\{[^}]*\}/s,
    /(?:async\s+)?(\w+)\s*\(\s*({[^}]+}|[^)]*)\s*\)\s*:\s*Promise<([^>]+)>\s*\{/s,
    /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{[^}]*\}/s,
    /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*Observable<([^>]+)>\s*\{[^}]*\}/s,
    /(?:async\s+)?(\w+)\s*\([^)]*\)\s*:\s*Promise<[^>]+>\s*\{[^}]*(save|update|remove|find|findOne|query)[^}]*\}/s,
    /(?:public|private|protected|async|\s)*(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*\{[\s\S]*?\}/,
    /(?:public|private|protected|async|\s)*(\w+)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_<>\[\]]+)\s*\{[\s\S]*?\}/,
    /(?:public|private|protected|async|\s)*(\w+)\s*\(([^)]*)\)\s*\{[\s\S]*?\}/,
    /(\w+)\s*=\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*=>\s*\{[\s\S]*?\}/,
    /(\w+)\s*=\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_<>\[\]]+)\s*=>\s*[^;]+;/,
    /(?:async\s+)?(\w+)<[^>]+>\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*\{[\s\S]*?\}/,
    /(?:async\s+)?(\w+)\s*\(\s*({[\s\S]+?}|[^)]*)\s*\)\s*:\s*Promise<([^>]+)>\s*\{/,
    /@\w+\([\s\S]*?\)\s*(?:public|private|protected|async|\s)*(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>\s*\{/,
    /(?:async\s+)?(\w+)\s*\([^)]*\)\s*:\s*Promise<[^>]+>\s*\{[\s\S]*(find|findOne|query|save|update|remove)[\s\S]*?\}/,
    /get\s+(\w+)\s*\(\)\s*\{[\s\S]*?\}/,
    /set\s+(\w+)\s*\(([^)]*)\)\s*\{[\s\S]*?\}/,
  ];

  for (const pattern of functionPatterns) {
    const match = functionText.match(pattern);
    if (match) {
      return inferFunctionInfo(match, functionText);
    }
  }

  return null;
}

function inferFunctionInfo(
  match: RegExpMatchArray,
  functionText: string
): FunctionInfo {
  const functionName = match[1];
  const parametersText = match[2] || "";
  const returnType = match[3] || "any";
  const body = match[4] || "";

  const httpInfo = inferHttpMethod(functionName, body);
  const parameters = parseParameters(parametersText, httpInfo.httpMethod);

  const semanticReturn = inferSemanticReturn(body);

  return {
    name: functionName,
    parameters,
    returnType:
      semanticReturn !== "unknown"
        ? mapSemanticToTs(semanticReturn, returnType)
        : returnType,
    body,
    httpMethod: httpInfo.httpMethod,
    route: httpInfo.route,
  };
}

function inferHttpMethod(
  functionName: string,
  body: string
): { httpMethod: string; route: string } {
  const lowerName = functionName.toLowerCase();

  if (
    lowerName.includes("findone") ||
    lowerName.includes("getbyid") ||
    lowerName.includes("findbyid")
  ) {
    return { httpMethod: "Get", route: ":id" };
  }
  if (
    lowerName.includes("findall") ||
    lowerName.includes("getall") ||
    lowerName.includes("list")
  ) {
    return { httpMethod: "Get", route: "" };
  }
  if (
    lowerName.includes("create") ||
    lowerName.includes("add") ||
    lowerName.includes("insert")
  ) {
    return { httpMethod: "Post", route: "" };
  }
  if (
    lowerName.includes("update") ||
    lowerName.includes("modify") ||
    lowerName.includes("edit")
  ) {
    return { httpMethod: "Patch", route: ":id" };
  }
  if (
    lowerName.includes("remove") ||
    lowerName.includes("delete") ||
    lowerName.includes("destroy")
  ) {
    return { httpMethod: "Delete", route: ":id" };
  }

  if (
    body.includes(".create(") ||
    body.includes(".save(") ||
    body.includes(".insert(")
  ) {
    return { httpMethod: "Post", route: "" };
  }
  if (body.includes(".update(") || body.includes(".modify(")) {
    return { httpMethod: "Patch", route: ":id" };
  }
  if (body.includes(".remove(") || body.includes(".delete(")) {
    return { httpMethod: "Delete", route: ":id" };
  }
  if (body.includes(".findOne(") || body.includes(".findById(")) {
    return { httpMethod: "Get", route: ":id" };
  }
  if (body.includes(".find(") || body.includes(".findAll(")) {
    return { httpMethod: "Get", route: "" };
  }

  return { httpMethod: "Get", route: "" };
}

function parseParameters(
  parametersText: string,
  httpMethod: string
): ParameterInfo[] {
  if (!parametersText.trim()) return [];

  const parameters: ParameterInfo[] = [];
  const paramPairs = parametersText.split(",").map((p) => p.trim());

  for (const param of paramPairs) {
    const [name, type] = param.split(":").map((s) => s.trim());
    if (name && type) {
      let decorator = "";

      if (type.includes("Dto") && httpMethod === "Post") {
        decorator = "Body()";
      } else if (type.includes("Dto") && httpMethod === "Patch") {
        decorator = "Body()";
      } else if (name === "id" && type === "number") {
        decorator = "Param('id')";
      } else if (type === "number") {
        decorator = "Param('" + name + "')";
      } else if (type === "string") {
        decorator = "Query('" + name + "')";
      } else {
        decorator = "Body()";
      }

      parameters.push({
        name,
        type,
        decorator,
      });
    }
  }

  return parameters;
}

export async function getModuleInfo(
  currentFilePath: string
): Promise<ModuleInfo | null> {
  const dir = path.dirname(currentFilePath);
  const fileName = path.basename(currentFilePath);

  let entityName = fileName
    .replace(".service.ts", "")
    .replace(".entity.ts", "")
    .replace(".ts", "");

  if (!fileName.includes(".service.")) {
    const files = fs.readdirSync(dir);
    const serviceFile = files.find((f) => f.includes(".service."));
    if (serviceFile) {
      entityName = serviceFile.replace(".service.ts", "");
    }
  }

  if (!entityName) {
    return null;
  }

  const className = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  const camelName = entityName.charAt(0).toLowerCase() + entityName.slice(1);

  return {
    className,
    camelName,
    modulePath: dir,
  };
}

export async function getOrCreateControllerFile(
  moduleInfo: ModuleInfo
): Promise<string> {
  function findModuleRoot(startDir: string): string | null {
    let dir = startDir;
    while (true) {
      try {
        const files = fs.readdirSync(dir);
        if (files.some((f) => f.endsWith(".module.ts"))) return dir;
      } catch (e) {
        
        }
      const parent = path.dirname(dir);
      if (!parent || parent === dir) break;
      dir = parent;
    }
    return null;
  }

  const moduleRoot = findModuleRoot(moduleInfo.modulePath) || moduleInfo.modulePath;

  const controllerPath = path.join(
    moduleRoot,
    "controllers",
    `${moduleInfo.camelName}.controller.ts`
  );
  const controllerDir = path.dirname(controllerPath);

  if (!fs.existsSync(controllerDir)) {
    fs.mkdirSync(controllerDir, { recursive: true });
  }

  if (!fs.existsSync(controllerPath)) {
    const controllerContent = generateControllerTemplate(moduleInfo);
    fs.writeFileSync(controllerPath, controllerContent, "utf8");
  }

  return controllerPath;
}

function generateControllerTemplate(moduleInfo: ModuleInfo): string {
  return `import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ${moduleInfo.className}Service } from '../services/${moduleInfo.camelName}.service';
import { ${moduleInfo.className} } from '../entities/${moduleInfo.camelName}.entity';

@ApiTags('${moduleInfo.className}')
@Controller('${moduleInfo.camelName}')
export class ${moduleInfo.className}Controller {
  constructor(private readonly service: ${moduleInfo.className}Service) {}
}
`;
}

export function generateEndpoint(
  functionInfo: FunctionInfo,
  moduleInfo: ModuleInfo
): string {
  const parameters = functionInfo.parameters
    .map((p) => `${p.decorator} ${p.name}: ${p.type}`)
    .join(", ");

  const methodName = functionInfo.name;
  const serviceCall = `this.service.${methodName}(${functionInfo.parameters
    .map((p) => p.name)
    .join(", ")})`;

  let responseType = "any";
  if (functionInfo.returnType.includes("[]")) {
    responseType = `[${moduleInfo.className}]`;
  } else if (functionInfo.returnType === moduleInfo.className) {
    responseType = moduleInfo.className;
  } else if (functionInfo.returnType.includes("PaginatedResponseDto")) {
    responseType = `PaginatedResponseDto<${moduleInfo.className}>`;
  }

  let swaggerDecorators = "";

  swaggerDecorators += `  @ApiOperation({ summary: "${getSummary(
    functionInfo,
    moduleInfo
  )}" })\n`;

  functionInfo.parameters.forEach((param) => {
    if (param.decorator.includes("Param")) {
      const paramName = param.decorator.includes("('")
        ? param.decorator.split("'")[1]
        : param.name;
      swaggerDecorators += `  @ApiParam({ name: "${paramName}", type: Number })\n`;
    } else if (param.decorator.includes("Query")) {
      swaggerDecorators += `  @ApiQuery({ name: "${param.name}", required: false, type: ${param.type} })\n`;
    }
  });

  swaggerDecorators += `  @ApiResponse({ status: 200, type: ${responseType} })\n`;
  if (
    ["Get", "Patch", "Delete"].includes(functionInfo.httpMethod) &&
    functionInfo.route.includes(":id")
  ) {
    swaggerDecorators += `  @ApiResponse({ status: 404, description: "${moduleInfo.className} not found" })\n`;
  }

  return `
  @${functionInfo.httpMethod}("${functionInfo.route}")
${swaggerDecorators}  ${methodName}(${parameters}): Promise<${functionInfo.returnType}> {
    return ${serviceCall};
  }`;
}

function getSummary(
  functionInfo: FunctionInfo,
  moduleInfo: ModuleInfo
): string {
  const method = functionInfo.httpMethod.toLowerCase();
  const entity = moduleInfo.className;

  switch (method) {
    case "get":
      return functionInfo.route === ":id"
        ? `Get ${entity} by ID`
        : `Get all ${entity} entities`;
    case "post":
      return `Create a new ${entity}`;
    case "put":
    case "patch":
      return `Update ${entity} by ID`;
    case "delete":
      return `Delete ${entity} by ID`;
    default:
      return `${functionInfo.name} ${entity}`;
  }
}

export async function addEndpointToController(
  controllerPath: string,
  endpoint: string
) {
  const content = fs.readFileSync(controllerPath, "utf8");

  const lastBraceIndex = content.lastIndexOf("}");
  if (lastBraceIndex === -1) {
    throw new Error(
      "No se pudo encontrar el cierre de la clase en el controlador"
    );
  }

  const newContent =
    content.slice(0, lastBraceIndex) +
    endpoint +
    "\n}" +
    content.slice(lastBraceIndex + 1);

  fs.writeFileSync(controllerPath, newContent, "utf8");

  const doc = await vscode.workspace.openTextDocument(controllerPath);
  await vscode.window.showTextDocument(doc);
}

function inferSemanticReturn(body: string): string {
  const b = body.toLowerCase();

  if (b.includes("findone")) return "single-entity";
  if (b.includes("find(") || b.includes("findall")) return "entity-list";
  if (b.includes("create(") || b.includes("save(") || b.includes("insert("))
    return "created-entity";
  if (b.includes("update(") || b.includes("preload(")) return "updated-entity";
  if (
    b.includes("remove(") ||
    b.includes("delete(") ||
    b.includes("softdelete(")
  )
    return "delete-result";
  if (
    b.includes("queryrunner") ||
    b.includes("transaction") ||
    b.includes("manager.")
  ) {
    return "composed-result";
  }
  if (/return\s+{/.test(b)) return "custom-object";
  if (b.includes("map(") || b.includes("reduce(") || b.includes("transform")) {
    return "mapped-data";
  }

  return "unknown";
}

function mapSemanticToTs(semantic: string, original: string): string {
  switch (semantic) {
    case "single-entity":
      return original.includes("[]") ? original.replace("[]", "") : original;

    case "entity-list":
      return original.endsWith("[]") ? original : original + "[]";

    case "created-entity":
    case "updated-entity":
      return original;

    case "delete-result":
      return "DeleteResult | void";

    case "custom-object":
      return "any";

    case "mapped-data":
      return original;

    case "composed-result":
      return "any";

    default:
      return original;
  }
}
