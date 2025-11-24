import * as vscode from "vscode";
import * as fs from "fs";
import { generateErd } from "../generators/er.generator";

export async function generateErdCommand(uri?: vscode.Uri) {
    try {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!targetUri || !targetUri.fsPath.endsWith(".entity.ts")) {
            vscode.window.showWarningMessage("Right-click on a .entity.ts file to generate ERD.");
            return;
        }

        const entityPath = targetUri.fsPath;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace open.");
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const content = fs.readFileSync(entityPath, "utf8");
        if (!/@Entity\(/.test(content)) {
            vscode.window.showWarningMessage("Selected file is not a valid entity.");
            return;
        }

        const match = content.match(/export\s+class\s+(\w+)/);
        if (!match) {
            vscode.window.showWarningMessage("No se pudo detectar la clase en el archivo.");
            return;
        }
        const rootEntityName = match[1];

        await generateErd(rootPath, rootEntityName, 2);

        vscode.window.showInformationMessage("ERD generado correctamente.");
    } catch (err: any) {
        vscode.window.showErrorMessage(`Error generating ERD: ${err.message}`);
    }
}
