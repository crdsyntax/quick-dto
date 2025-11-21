import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { toCamelCase, toPascalCase } from "../utils/case.util";
import { parseEntityProperties } from "../generators/parser/entity.parser";
import { generateInterface } from "../generators/interface.generator";
import { writeFileSafely } from "../utils/file.utils";

export async function generateInterfaceCommand(uri?: vscode.Uri) {
    try {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!targetUri || !targetUri.fsPath.endsWith(".entity.ts")) {
            vscode.window.showWarningMessage("Please right-click on a .entity.ts file");
            return;
        }

        const entityPath = targetUri.fsPath;
        const entityContent = fs.readFileSync(entityPath, "utf8");
        const entityName = path.basename(entityPath, ".entity.ts");
        const pascalEntity = toPascalCase(entityName);
        const camelEntity = toCamelCase(pascalEntity);

        const properties = parseEntityProperties(entityContent);

        const interfaceContent = generateInterface(pascalEntity, properties);

        const moduleDir = path.dirname(path.dirname(entityPath));
        const interfaceFolder = path.join(moduleDir, "interfaces");
        fs.mkdirSync(interfaceFolder, { recursive: true });

        await writeFileSafely(
            path.join(interfaceFolder, `${camelEntity}.interface.ts`),
            interfaceContent,
            "Interface generated"
        );

    } catch (err: any) {
        vscode.window.showErrorMessage(`Error generating Interface: ${err.message}`);
    }
}
