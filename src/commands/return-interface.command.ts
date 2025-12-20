import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { generateInterfaceFromReturn } from "../generators/return-interface.generator";
import { writeFileSafely } from "../utils/file.utils";

export async function generateReturnInterfaceCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
    }

    const document = editor.document;
    const position = editor.selection.active;

    const text = document.getText();
    const lines = text.split("\n");
    let startLine = position.line;
    let endLine = position.line;

    while (startLine >= 0) {
        const line = lines[startLine];
        if (line.match(/async\s+function\s+\w+|public\s+async\s+\w+|private\s+async\s+\w+|\w+\s*\([^)]*\)\s*\{/)) {
            break;
        }
        startLine--;
    }

    if (startLine < 0) {
        vscode.window.showErrorMessage("Could not find function start");
        return;
    }

    let braceCount = 0;
    let foundStart = false;
    let functionCode = "";

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        functionCode += line + "\n";
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;

        if (braceCount > 0) foundStart = true;
        if (foundStart && braceCount === 0) {
            endLine = i;
            break;
        }
    }

    // Extract function name
    const startLineText = lines[startLine];
    const nameMatch = startLineText.match(/(?:function\s+|public\s+|private\s+|protected\s+|async\s+)*(\w+)\s*\(/);
    const functionName = nameMatch ? nameMatch[1] : "Unknown";

    try {
        const interfaceContent = generateInterfaceFromReturn(functionCode, functionName);

        const interfaceName = `I${capitalize(functionName)}Response`;

        // Ask user for interface name
        const userInterfaceName = await vscode.window.showInputBox({
            prompt: "Enter interface name",
            value: interfaceName
        });

        if (!userInterfaceName) return;

        // Adjust interface name in content
        const finalContent = interfaceContent.replace(`interface I${capitalize(functionName)}Response`, `interface ${userInterfaceName}`);

        const dir = path.dirname(document.uri.fsPath);
        const interfacesDir = path.join(dir, "../interfaces");
        fs.mkdirSync(interfacesDir, { recursive: true });

        await writeFileSafely(
            path.join(interfacesDir, `${toKebabCase(userInterfaceName)}.ts`),
            finalContent,
            "Interface generated"
        );

    } catch (err: any) {
        vscode.window.showErrorMessage(`Error generating interface: ${err.message}`);
    }
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function toKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
