import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  HttpTesterGenerator,
  HttpCollection,
} from "../generators/http-tester.generator";
import { HttpTesterPanel } from "../views/http-tester.view";
import { loadConfig, createMatchPath } from "tsconfig-paths";

/**
 * Resolver DTO considerando paths relativos y alias de tsconfig
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
  if (!match) return null;

  const importPath = match[1];
  const controllerDir = path.dirname(controllerPath);

  let dtoFilePath = path.resolve(controllerDir, importPath + ".ts");
  if (fs.existsSync(dtoFilePath)) return dtoFilePath;

  dtoFilePath = path.resolve(controllerDir, importPath, "index.ts");
  if (fs.existsSync(dtoFilePath)) return dtoFilePath;

  // Resolver alias usando tsconfig.json
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot && importPath.startsWith("@")) {
    try {
      const config = loadConfig(workspaceRoot);
      if (config.resultType === "success") {
        const matchPath = createMatchPath(config.absoluteBaseUrl, config.paths);
        const resolved = matchPath(importPath);
        if (resolved && fs.existsSync(resolved)) return resolved;
      }
    } catch {}
  }

  return null;
}

/**
 * Extracción de DTOs: importaciones y parámetros @Body
 */
function extractDtoNames(controllerCode: string): string[] {
  const dtoNames: string[] = [];
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"][^'"]+['"]/gs;
  let match;

  while ((match = importRegex.exec(controllerCode)) !== null) {
    const names = match[1]
      .split(",")
      .map((i) => i.trim())
      .filter((i) => /Dto$/i.test(i));
    names.forEach((n) => {
      if (!dtoNames.includes(n)) dtoNames.push(n);
    });
  }

  const paramRegex = /@Body\s*\(\)\s+\w+:\s*(\w+)/g;
  while ((match = paramRegex.exec(controllerCode)) !== null) {
    const dtoName = match[1];
    if (/Dto$/i.test(dtoName) && !dtoNames.includes(dtoName))
      dtoNames.push(dtoName);
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
  const editor = vscode.window.activeTextEditor;
  if (!editor || !fileUri?.fsPath) {
    vscode.window.showErrorMessage(
      "No se pudo obtener la información del archivo."
    );
    return;
  }

  try {
    const fullCode =
      editor.document.uri.fsPath === fileUri.fsPath
        ? editor.document.getText()
        : fs.readFileSync(fileUri.fsPath, "utf8");

    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    const selectedText = hasSelection ? editor.document.getText(selection) : "";

    const baseUrl = await vscode.window.showInputBox({
      prompt: "Introduce la URL Base del API (ej: http://localhost:3000)",
      value: vscode.workspace
        .getConfiguration("nest-tools")
        .get("defaultBaseUrl", "http://localhost:3000"),
      ignoreFocusOut: true,
    });
    if (!baseUrl)
      return vscode.window.showWarningMessage("Operación cancelada.");

    // --- Extracción de DTOs del archivo completo ---
    const dtoNames = extractDtoNames(fullCode);
    const dtoContents: Record<string, string> = {};

    for (const dtoName of dtoNames) {
      let dtoContent: string | null = null;
      const realPath = resolveDtoPath(dtoName, fileUri.fsPath, fullCode);
      if (realPath && fs.existsSync(realPath))
        dtoContent = fs.readFileSync(realPath, "utf8");

      if (dtoContent) dtoContents[dtoName] = dtoContent;
      else console.warn("✗ DTO no encontrado:", dtoName);
    }

    // --- Generar todas las colecciones ---
    let allCollections: HttpCollection[] =
      HttpTesterGenerator.generateCollectionsFromController(
        fullCode,
        baseUrl,
        dtoContents
      );
    let finalCollections: HttpCollection[] = allCollections;

    // --- Filtrado si hay selección ---
    if (hasSelection) {
      const routeRegex =
        /@(Get|Post|Put|Delete|Patch|Options|Head)\(['"]?([^'")]+)['"]?\)\s*[\r\n\s]*?(?:async\s+)?(\w+)\s*\(/gi;

      const matches = Array.from(selectedText.matchAll(routeRegex));
      if (matches.length > 0) {
        const selectedFunctionNames = matches.map((m) => m[3]);
        finalCollections = allCollections.filter((c) =>
          selectedFunctionNames.some((fn) => c.name.includes(fn))
        );
      }
    }

    if (finalCollections.length === 0) {
      return vscode.window.showWarningMessage(
        hasSelection
          ? "No se pudo generar ninguna colección para la selección. Asegúrate de incluir métodos con decoradores de ruta (@Get, @Post, etc.)."
          : "No se detectaron endpoints en este controlador."
      );
    }

    const panel = HttpTesterPanel.createOrShow(context.extensionUri, context);
    setTimeout(() => {
      panel.loadCollections(finalCollections);
      if (finalCollections.length === 1 && hasSelection)
        panel.loadCollection(finalCollections[0]);
      vscode.window.showInformationMessage(
        `✅ ${finalCollections.length} colección(es) generada(s).`
      );
    }, 500);

    // --- Funciones auxiliares de dummy ---
    function generateDummyFromDto(dtoSource: string): any {
      const result: any = {};
      const propertyRegex =
        /(?:@\w+[^\n]*\n)*\s*(?:public|private|protected)?\s*(\w+)\s*:\s*([\w\[\]\|<>{}\s,]+)\s*;/g;
      let match;
      while ((match = propertyRegex.exec(dtoSource)) !== null) {
        const name = match[1];
        const type = match[2].trim();
        result[name] = mapTypeToDummy(type);
      }
      return result;
    }

    function mapTypeToDummy(type: string): any {
      type = type.replace(/<.*?>/g, "");
      if (type.endsWith("[]") || type === "Array") return [];
      if (type === "boolean") return false;
      if (type === "string" || type === "UUID") return "";
      if (type === "number" || type === "int" || type === "float") return 0;
      if (type === "Date" || type === "DateString") return "";
      if (/Dto$/i.test(type) || /^[A-Z]/.test(type)) return {};
      return null;
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `❌ Error al generar colecciones: ${error.message}`
    );
  }
}
