// src/commands/generateController.ts
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { toCamelCase, toPascalCase } from "../utils/case.util";
import { writeFileSafely } from "../utils/file.utils";
import { generateControllerContentFromService } from "../generators/controller.generator";


export async function generateControllerCommand(uri?: vscode.Uri) {
  try {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showErrorMessage("No file selected");
      return;
    }

    const fileName = path.basename(targetUri.fsPath);
    let servicePath: string;
    let pascalEntity: string;
    let camelEntity: string;

    if (fileName.endsWith(".entity.ts")) {
      pascalEntity = toPascalCase(fileName.replace(".entity.ts", ""));
      camelEntity = toCamelCase(pascalEntity);
      const moduleFolder = path.dirname(path.dirname(targetUri.fsPath));
      servicePath = path.join(moduleFolder, "services", `${pascalEntity}.service.ts`);
    } else if (fileName.endsWith(".service.ts")) {
      servicePath = targetUri.fsPath;
      pascalEntity = toPascalCase(fileName.replace(".service.ts", ""));
      camelEntity = toCamelCase(pascalEntity);
    } else {
      vscode.window.showWarningMessage("Use on .entity.ts or .service.ts file");
      return;
    }

    if (!fs.existsSync(servicePath)) {
      vscode.window.showErrorMessage(`Service not found: ${path.basename(servicePath)}\nGenerate the service first.`);
      return;
    }

    const serviceContent = fs.readFileSync(servicePath, "utf8");
    const controllerFolder = path.join(path.dirname(servicePath), "../controllers");
    fs.mkdirSync(controllerFolder, { recursive: true });

    const controllerPath = path.join(controllerFolder, `${pascalEntity}.controller.ts`);
    const content = generateControllerContentFromService(serviceContent, camelEntity, pascalEntity);

    await writeFileSafely(controllerPath, content, "Controller generated");
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error generating Controller: ${err.message}`);
  }
}