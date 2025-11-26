import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { toCamelCase, toPascalCase } from "../utils/case.util";
import { writeFileSafely } from "../utils/file.utils";
import { ensureModuleRegisters } from "../utils/module.util";
import { generateRepositoryContent } from "../generators/repository.generator";

export async function generateRepositoryCommand(uri?: vscode.Uri) {
  try {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showWarningMessage("Right-click on a .entity.ts or .schema.ts file");
      return;
    }

    const filePath = targetUri.fsPath;
    const fileContent = fs.readFileSync(filePath, "utf8");

    const isTypeORM = fileContent.includes("@Entity");
    const isMongoose = fileContent.includes("@Schema");

    if (!isTypeORM && !isMongoose) {
      vscode.window.showErrorMessage("No TypeORM or Mongoose entity detected");
      return;
    }

    const repoType: "TypeORM" | "Mongoose" = isTypeORM ? "TypeORM" : "Mongoose";

    const entityName = path.basename(filePath)
      .replace(".entity.ts", "")
      .replace(".schema.ts", "");
    const pascalEntity = toPascalCase(entityName);
    const camelEntity = toCamelCase(entityName);

    const moduleFolder = path.dirname(path.dirname(filePath));
    const repoFolder = path.join(moduleFolder, "repositories");
    fs.mkdirSync(repoFolder, { recursive: true });

    const repoPath = path.join(repoFolder, `${camelEntity}.repository.ts`);
    const content = generateRepositoryContent(camelEntity, pascalEntity, repoType);

    await writeFileSafely(repoPath, content, "Repository generated");

    try {
      ensureModuleRegisters(moduleFolder, filePath, { registerRepository: true });
    } catch {}

  } catch (err: any) {
    vscode.window.showErrorMessage(`Error generating Repository: ${err.message}`);
  }
}
