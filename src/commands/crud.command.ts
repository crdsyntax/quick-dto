import * as vscode from "vscode";
import * as path from "path";
import { generateDtoCommand } from "./dto.command";
import { generateRepositoryCommand } from "./repository.command";
import { generateServiceCommand } from "./service.command";
import { generateControllerCommand } from "./controller.command";
import { ensureModuleRegisters } from "../utils/module.util";


export async function generateCrudCommand(uri?: vscode.Uri) {
  try {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri || !targetUri.fsPath.endsWith(".entity.ts")) {
      vscode.window.showWarningMessage("Please right-click on a .entity.ts file");
      return;
    }

    await generateDtoCommand(targetUri);
    await generateRepositoryCommand(targetUri);
    await generateServiceCommand(targetUri);
    try {
      const moduleFolder = path.dirname(path.dirname(targetUri.fsPath));
      ensureModuleRegisters(moduleFolder, targetUri.fsPath, { registerRepository: true });
      ensureModuleRegisters(moduleFolder, targetUri.fsPath, { registerService: true });
    } catch (e) {
      
    }

    await generateControllerCommand(targetUri);
    try {
      const moduleFolder = path.dirname(path.dirname(targetUri.fsPath));
      ensureModuleRegisters(moduleFolder, targetUri.fsPath, { registerController: true });
    } catch (e) {
      
    }

    vscode.window.showInformationMessage("Full CRUD generated successfully!");
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error generating CRUD: ${err.message}`);
  }
}