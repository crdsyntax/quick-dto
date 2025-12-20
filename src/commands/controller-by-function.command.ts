import * as vscode from "vscode";

export async function generateControllerEndpoint() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No hay editor activo");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText.trim()) {
    vscode.window.showErrorMessage("No hay texto seleccionado");
    return;
  }

  try {
    await generateControllerEndpointFromSelection(
      selectedText,
      editor.document.fileName
    );
    vscode.window.showInformationMessage(
      "Endpoint generado exitosamente en el controlador"
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Error al generar endpoint: ${error}`);
  }
}

async function generateControllerEndpointFromSelection(
  selectedText: string,
  currentFilePath: string
) {
  const {
    parseFunction,
    getModuleInfo,
    getOrCreateControllerFile,
    generateEndpoint,
    addEndpointToController,
  } = await import("../generators/controller-by-function.generator");

  const functionInfo = parseFunction(selectedText);
  if (!functionInfo) {
    throw new Error("No se pudo analizar la función seleccionada");
  }

  const moduleInfo = await getModuleInfo(currentFilePath);
  if (!moduleInfo) {
    throw new Error("No se pudo determinar la entidad del módulo");
  }

  const endpoint = generateEndpoint(functionInfo, moduleInfo);
  const controllerPath = await getOrCreateControllerFile(moduleInfo);
  await addEndpointToController(controllerPath, endpoint);
}
