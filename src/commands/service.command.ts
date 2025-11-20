import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { toCamelCase, toPascalCase } from "../utils/case.util";
import { generateServiceContent } from "../generators/service.generator";
import { writeFileSafely } from "../utils/file.utils";


export async function generateServiceCommand(uri?: vscode.Uri) {
  try {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri || !targetUri.fsPath.endsWith(".entity.ts")) {
      vscode.window.showWarningMessage("Please right-click on a .entity.ts file");
      return;
    }

    const entityPath = targetUri.fsPath;
    const entityName = path.basename(entityPath, ".entity.ts");
    const pascalEntity = toPascalCase(entityName);
    const camelEntity = toCamelCase(entityName);

    const moduleFolder = path.dirname(path.dirname(entityPath));
    const serviceFolder = path.join(moduleFolder, "services");
    fs.mkdirSync(serviceFolder, { recursive: true });

    const servicePath = path.join(serviceFolder, `${pascalEntity}.service.ts`);
    const content = generateServiceContent(camelEntity, pascalEntity);

    await writeFileSafely(servicePath, content, "Service generated");
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error generating Service: ${err.message}`);
  }
}