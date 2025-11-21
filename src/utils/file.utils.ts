import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export async function writeFileSafely(filePath: string, content: string, successMessage: string) {
  if (fs.existsSync(filePath)) {
    const choice = await vscode.window.showWarningMessage(
      `${path.basename(filePath)} already exists. Overwrite?`,
      "Yes", "No"
    );
    if (choice !== "Yes") return;
  }

  fs.writeFileSync(filePath, content, "utf8");
  vscode.window.showInformationMessage(`${successMessage}: ${path.basename(filePath)}`);

  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}