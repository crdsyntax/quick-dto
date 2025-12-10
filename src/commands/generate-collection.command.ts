import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  HttpTesterGenerator,
  HttpCollection,
} from "../generators/http-tester.generator";
import { HttpTesterPanel } from "../views/http-tester.view";

/**
 * Busca un DTO por import real
 */
function resolveDtoPath(
  dtoName: string,
  controllerPath: string,
  controllerCode: string
): string | null {
  const importRegex = new RegExp(
    `import\\s+{[^}]*\\b${dtoName}\\b[^}]*}\\s+from\\s+['"]([^'"]+)['"]`,
    "g"
  );

  const match = importRegex.exec(controllerCode);
  if (!match) {
    return null;
  }

  const importPath = match[1];
  const controllerDir = path.dirname(controllerPath);

  // Ruta directa
  let dtoFilePath = path.resolve(controllerDir, importPath + ".ts");
  if (fs.existsSync(dtoFilePath)) {
    return dtoFilePath;
  }

  // index.ts
  dtoFilePath = path.resolve(controllerDir, importPath, "index.ts");
  if (fs.existsSync(dtoFilePath)) {
    return dtoFilePath;
  }

  return null;
}

/**
 * Fallback heurístico para encontrar archivos DTO
 */
function findDtoFile(dtoName: string, controllerPath: string): string | null {
  const controllerDir = path.dirname(controllerPath);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    return null;
  }

  // Rutas típicas
  const possiblePaths = [
    path.join(controllerDir, `${dtoName}.ts`),
    path.join(controllerDir, `${dtoName.toLowerCase()}.ts`),

    path.join(controllerDir, "..", "dto", `${dtoName}.ts`),
    path.join(controllerDir, "..", "dto", `${dtoName.toLowerCase()}.ts`),

    path.join(controllerDir, "dto", `${dtoName}.ts`),
    path.join(controllerDir, "dto", `${dtoName.toLowerCase()}.ts`),

    path.join(controllerDir, "..", "dtos", `${dtoName}.ts`),
    path.join(controllerDir, "dtos", `${dtoName}.ts`),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8");
    }
  }

  // Búsqueda profunda
  try {
    const files = findFilesRecursive(workspaceRoot, `${dtoName}.ts`);
    if (files.length > 0) {
      return fs.readFileSync(files[0], "utf8");
    }
  } catch {}

  return null;
}

/**
 * Busca archivos recursivamente (controlado)
 */
function findFilesRecursive(
  dir: string,
  filename: string,
  maxDepth: number = 5,
  currentDepth: number = 0
): string[] {
  if (currentDepth > maxDepth) return [];

  const results: string[] = [];
  let files: string[] = [];

  try {
    files = fs.readdirSync(dir);
  } catch {
    return results;
  }

  for (const file of files) {
    const filePath = path.join(dir, file);

    if (file === "node_modules" || file.startsWith(".")) continue;

    try {
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        results.push(
          ...findFilesRecursive(filePath, filename, maxDepth, currentDepth + 1)
        );
      } else if (file.toLowerCase() === filename.toLowerCase()) {
        results.push(filePath);
      }
    } catch {}
  }

  return results;
}

/**
 * Extraer nombres de DTO:
 * - importaciones
 * - parámetros de métodos
 */
function extractDtoNames(controllerCode: string): string[] {
  const dtoNames: string[] = [];

  // Import de DTOs
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"][^'"]+['"]/g;
  let match;

  while ((match = importRegex.exec(controllerCode)) !== null) {
    const names = match[1]
      .split(",")
      .map((i) => i.trim())
      .filter((i) => /Dto$/i.test(i));

    for (const name of names) {
      if (!dtoNames.includes(name)) dtoNames.push(name);
    }
  }

  // Parámetros con DTO en @Body()
  const paramRegex = /@Body\s*\(\)\s+\w+:\s*(\w+)/g;

  while ((match = paramRegex.exec(controllerCode)) !== null) {
    const dtoName = match[1];
    if (/Dto$/i.test(dtoName) && !dtoNames.includes(dtoName)) {
      dtoNames.push(dtoName);
    }
  }

  return dtoNames;
}

/**
 * Comando principal
 */
export async function generateCollectionsFromControllerCommand(
  context: vscode.ExtensionContext,
  fileUri: vscode.Uri
) {
  if (!fileUri || !fileUri.fsPath) {
    vscode.window.showErrorMessage("No se pudo obtener la ruta del archivo.");
    return;
  }

  try {
    const controllerCode = fs.readFileSync(fileUri.fsPath, "utf8");

    const baseUrl = await vscode.window.showInputBox({
      prompt: "Introduce la URL Base del API (ej: http://localhost:3000)",
      value: vscode.workspace
        .getConfiguration("nest-tools")
        .get("defaultBaseUrl", "http://localhost:3000"),
      ignoreFocusOut: true,
    });

    if (!baseUrl) {
      vscode.window.showWarningMessage("Operación cancelada.");
      return;
    }

    const dtoNames = extractDtoNames(controllerCode);

    const dtoContents: Record<string, string> = {};

    for (const dtoName of dtoNames) {
      let dtoContent: string | null = null;

      // 1) Intentar resolver por import
      const realPath = resolveDtoPath(dtoName, fileUri.fsPath, controllerCode);

      if (realPath && fs.existsSync(realPath)) {
        dtoContent = fs.readFileSync(realPath, "utf8");
      } else {
        // 2) fallback heurístico
        dtoContent = findDtoFile(dtoName, fileUri.fsPath);
      }

      if (dtoContent) {
        dtoContents[dtoName] = dtoContent;
        console.log("✓ DTO encontrado:", dtoName);
      } else {
        console.warn("✗ DTO no encontrado:", dtoName);
      }
    }

    const collections: HttpCollection[] =
      HttpTesterGenerator.generateCollectionsFromController(
        controllerCode,
        baseUrl,
        dtoContents
      );

    if (collections.length === 0) {
      vscode.window.showWarningMessage(
        "No se detectaron endpoints con @ApiOperation."
      );
      return;
    }

    HttpTesterPanel.createOrShow(context.extensionUri, context);

    setTimeout(() => {
      HttpTesterPanel.currentPanel?.loadCollections(collections);
      vscode.window.showInformationMessage(
        `✅ ${collections.length} colección(es) generada(s).`
      );
    }, 300);
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `❌ Error al generar colecciones: ${error.message}`
    );
  }

 function generateDummyFromDto(dtoSource: string): any {
    const result: any = {};

    // Busca propiedades:  <decorators> <type> <name>: <type>;
    const propertyRegex =
      /(?:@\w+[^\n]*\n)*\s*(?:public|private|protected)?\s*(\w+)\s*:\s*([\w\[\]\|<>{}]+)\s*;/g;

    let match;

    while ((match = propertyRegex.exec(dtoSource)) !== null) {
      const name = match[1];
      let type = match[2].trim();

      result[name] = mapTypeToDummy(type);
    }

    return result;
  }

  /**
   * Mapea tipo a dummy
   */
  function mapTypeToDummy(type: string): any {
    // Remueve generics
    type = type.replace(/<.*?>/g, "");

    // Arrays
    if (type.endsWith("[]") || type === "Array") {
      return [];
    }

    // Booleanos
    if (type === "boolean") {
      return false;
    }

    // Strings
    if (type === "string") {
      return "";
    }

    // Números
    if (type === "number" || type === "int" || type === "float") {
      return 0;
    }

    // UUID → string
    if (type === "UUID") {
      return "";
    }

    // Date / DateString
    if (type === "Date" || type === "DateString") {
      return "";
    }

    // Objetos complejos (otros DTOs)
    if (/Dto$/i.test(type) || /^[A-Z]/.test(type)) {
      return {};
    }

    // fallback
    return null;
  }
}
