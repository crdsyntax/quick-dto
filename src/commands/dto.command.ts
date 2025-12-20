import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { toCamelCase, toPascalCase } from "../utils/case.util";
import { parseEntityProperties } from "../generators/parser/entity.parser";
import {
  generateCreateDto,
  generateUpdateDto,
} from "../generators/dto.generator";
import { writeFileSafely } from "../utils/file.utils";

export async function generateDtoCommand(uri?: vscode.Uri) {
  try {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;

    if (!targetUri) {
      vscode.window.showWarningMessage("No active file or URI provided.");
      return;
    }

    const entityPath = targetUri.fsPath;

    const isEntity = entityPath.endsWith(".entity.ts");
    const isSchema = entityPath.endsWith(".schema.ts");

    if (!isEntity && !isSchema) {
      vscode.window.showWarningMessage(
        "Please right-click on a **.entity.ts** (TypeORM) or **.schema.ts** (Mongoose) file."
      );
      return;
    }

    const entityContent = fs.readFileSync(entityPath, "utf8");

    const extensionToRemove = isEntity ? ".entity.ts" : ".schema.ts";

    const entityName = path.basename(entityPath, extensionToRemove);

    const pascalEntity = toPascalCase(entityName);
    const camelEntity = toCamelCase(pascalEntity);

    const properties = parseEntityProperties(entityContent);

    const createDtoContent = generateCreateDto(pascalEntity, properties);
    const updateDtoContent = generateUpdateDto(pascalEntity, properties);

    const dtoFolder = path.join(
      path.dirname(path.dirname(entityPath)),
      "dto",
      camelEntity
    );
    fs.mkdirSync(dtoFolder, { recursive: true });

    await writeFileSafely(
      path.join(dtoFolder, `create-${camelEntity}.dto.ts`),
      createDtoContent,
      "Create DTO generated"
    );

    await writeFileSafely(
      path.join(dtoFolder, `update-${camelEntity}.dto.ts`),
      updateDtoContent,
      "Update DTO generated"
    );

    vscode.window.showInformationMessage(
      `DTOs para ${pascalEntity} generados exitosamente.`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error generating DTO: ${err.message}`);
  }
}
