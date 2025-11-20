import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { toCamelCase, toPascalCase } from "../utils/case.util";
import { writeFileSafely } from "../utils/file.utils";
import { generateRepositoryContent } from "../generators/repository.generator";


export async function generateRepositoryCommand(uri?: vscode.Uri) {
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
    const repoFolder = path.join(moduleFolder, "repositories");
    fs.mkdirSync(repoFolder, { recursive: true });

    const repoPath = path.join(repoFolder, `${pascalEntity}.repository.ts`);
    const content = generateRepositoryContent(camelEntity, pascalEntity);

    await writeFileSafely(repoPath, content, "Repository generated");
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error generating Repository: ${err.message}`);
  }
}