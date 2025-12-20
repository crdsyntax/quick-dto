import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { toCamelCase, toPascalCase } from "../utils/case.util";
import { generateServiceContent } from "../generators/service.generator";
import { writeFileSafely } from "../utils/file.utils";
import { ensureModuleRegisters } from "../utils/module.util";

export async function generateServiceCommand(uri?: vscode.Uri) {
  try {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri || (!targetUri.fsPath.endsWith(".entity.ts") && !targetUri.fsPath.endsWith(".schema.ts"))) {
      vscode.window.showWarningMessage("Please right-click on a .entity.ts or .schema.ts file");
      return;
    }

    const entityPath = targetUri.fsPath;

    const rawName = path.basename(entityPath, ".ts");
    const cleanName = rawName.replace(".entity", "").replace(".schema", "");

    const pascalEntity = toPascalCase(cleanName);
    const camelEntity = toCamelCase(cleanName);

    const isMongoose = entityPath.endsWith(".schema.ts");

    const moduleFolder = path.dirname(path.dirname(entityPath));
    const serviceFolder = path.join(moduleFolder, "services");
    fs.mkdirSync(serviceFolder, { recursive: true });

    const servicePath = path.join(serviceFolder, `${camelEntity}.service.ts`);
    const content = generateServiceContent(camelEntity, pascalEntity, entityPath, isMongoose);

    await writeFileSafely(servicePath, content, "Service generated");

    try {
      ensureModuleRegisters(moduleFolder, entityPath, { registerService: true });
    } catch (e) {}

  } catch (err: any) {
    vscode.window.showErrorMessage(`Error generating Service: ${err.message}`);
  }
}
