import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  HttpTesterGenerator,
  HttpCollection,
} from "../generators/http-tester.generator";
import { HttpTesterPanel } from "../views/http-tester.view";

/**
 * Encuentra y lee el contenido de un archivo DTO
 */
function findDtoFile(dtoName: string, controllerPath: string): string | null {
  const controllerDir = path.dirname(controllerPath);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    return null;
  }

  // Posibles ubicaciones del DTO
  const possiblePaths = [
    // En el mismo directorio
    path.join(controllerDir, `${dtoName}.ts`),
    path.join(controllerDir, `${dtoName.toLowerCase()}.ts`),
    // En carpeta dto del mismo módulo
    path.join(controllerDir, "..", "dto", `${dtoName}.ts`),
    path.join(controllerDir, "..", "dto", `${dtoName.toLowerCase()}.ts`),
    path.join(controllerDir, "dto", `${dtoName}.ts`),
    path.join(controllerDir, "dto", `${dtoName.toLowerCase()}.ts`),
    // En carpeta dtos
    path.join(controllerDir, "..", "dtos", `${dtoName}.ts`),
    path.join(controllerDir, "dtos", `${dtoName}.ts`),
  ];

  // Buscar el archivo
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8");
    }
  }

  // Búsqueda recursiva en el workspace
  try {
    const files = findFilesRecursive(workspaceRoot, `${dtoName}.ts`);
    if (files.length > 0) {
      return fs.readFileSync(files[0], "utf8");
    }
  } catch (error) {
    console.error("Error searching for DTO:", error);
  }

  return null;
}

/**
 * Busca archivos recursivamente
 */
function findFilesRecursive(
  dir: string,
  filename: string,
  maxDepth: number = 5,
  currentDepth: number = 0
): string[] {
  if (currentDepth > maxDepth) {
    return [];
  }

  const results: string[] = [];

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      // Skip node_modules and hidden directories
      if (file === "node_modules" || file.startsWith(".")) {
        continue;
      }

      try {
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          results.push(
            ...findFilesRecursive(
              filePath,
              filename,
              maxDepth,
              currentDepth + 1
            )
          );
        } else if (file.toLowerCase() === filename.toLowerCase()) {
          results.push(filePath);
        }
      } catch (error) {
        // Skip files we can't access
        continue;
      }
    }
  } catch (error) {
    // Skip directories we can't access
  }

  return results;
}

/**
 * Extrae los nombres de DTOs del código del controlador
 */
function extractDtoNames(controllerCode: string): string[] {
  const dtoNames: string[] = [];

  // Buscar imports de DTOs
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(controllerCode)) !== null) {
    const imports = match[1].split(",").map((i) => i.trim());
    for (const imp of imports) {
      if (imp.includes("Dto") || imp.includes("DTO")) {
        dtoNames.push(imp);
      }
    }
  }

  // Buscar en los parámetros de los métodos - CORREGIDO para extraer el TIPO, no la variable
  // Patrón: @Body() variableName: TipoDto
  const paramRegex = /@Body\s*\(\)\s+\w+:\s*(\w+)/g;
  while ((match = paramRegex.exec(controllerCode)) !== null) {
    const dtoTypeName = match[1];
    if (
      (dtoTypeName.includes("Dto") || dtoTypeName.includes("DTO")) &&
      !dtoNames.includes(dtoTypeName)
    ) {
      dtoNames.push(dtoTypeName);
    }
  }

  return dtoNames;
}

/**
 * Comando para generar colecciones HTTP a partir de un archivo controlador de NestJS.
 * @param context Contexto de la extensión.
 * @param fileUri URI del archivo controlador seleccionado.
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

    // 1. Pedir la URL Base al usuario
    const baseUrl = await vscode.window.showInputBox({
      prompt: "Introduce la URL Base del API (ej: http://localhost:3000)",
      value: vscode.workspace
        .getConfiguration("nest-tools")
        .get("defaultBaseUrl", "http://localhost:3000"),
      ignoreFocusOut: true,
    });

    if (!baseUrl) {
      vscode.window.showWarningMessage(
        "Operación cancelada. Se requiere una URL base."
      );
      return;
    }

    // 2. Extraer nombres de DTOs del controlador
    const dtoNames = extractDtoNames(controllerCode);

    // 3. Buscar y leer los archivos de DTOs
    const dtoContents: Record<string, string> = {};

    for (const dtoName of dtoNames) {
      const dtoContent = findDtoFile(dtoName, fileUri.fsPath);
      if (dtoContent) {
        dtoContents[dtoName] = dtoContent;
        console.log(`✓ DTO encontrado: ${dtoName}`);
      } else {
        console.warn(`✗ DTO no encontrado: ${dtoName}`);
      }
    }

    if (Object.keys(dtoContents).length > 0) {
      vscode.window.showInformationMessage(
        `📄 ${
          Object.keys(dtoContents).length
        } DTO(s) encontrado(s) y analizado(s).`
      );
    }

    // 4. Generar colecciones
    const collections: HttpCollection[] =
      HttpTesterGenerator.generateCollectionsFromController(
        controllerCode,
        baseUrl,
        dtoContents
      );

    if (collections.length === 0) {
      vscode.window.showWarningMessage(
        "No se detectaron endpoints con @ApiOperation en este controlador. Asegúrate de que usas @ApiOperation."
      );
      return;
    }

    // 5. Abrir/Mostrar el Webview del HTTP Tester
    HttpTesterPanel.createOrShow(context.extensionUri, context);

    // 6. Enviar las colecciones al Webview
    setTimeout(() => {
      HttpTesterPanel.currentPanel?.loadCollections(collections);
      vscode.window.showInformationMessage(
        `✅ ${collections.length} colección(es) generada(s) y cargada(s).`
      );
    }, 500);
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `❌ Error al generar colecciones: ${error.message}`
    );
  }
}
