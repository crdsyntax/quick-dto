import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  buildResponseInterfaces,
  findModuleFolder,
} from "../generators/response-interfa.generator";

export async function generateResponseInterfaceCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const text = editor.document.getText(selection);

  if (!text.trim()) {
    vscode.window.showErrorMessage("Selecciona una función completa.");
    return;
  }

  const responsePayload = buildResponseInterfaces(text);
  if (!responsePayload) {
    vscode.window.showErrorMessage("No pude encontrar un return con objeto.");
    return;
  }

  const moduleFolder = findModuleFolder(editor.document.uri.fsPath);
  if (!moduleFolder) {
    vscode.window.showErrorMessage("No se pudo detectar el módulo dentro de src.");
    return;
  }

  const typesFolder = path.join(moduleFolder, "types");
  if (!fs.existsSync(typesFolder)) {
    fs.mkdirSync(typesFolder);
  }

  const filePath = path.join(
    typesFolder,
    `${responsePayload.interfaceName}.interfaces.ts`
  );

  fs.writeFileSync(filePath, responsePayload.content, "utf8");

  const openDoc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(openDoc);
  vscode.window.showInformationMessage("Interfaces generadas correctamente.");
}

