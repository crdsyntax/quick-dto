import * as vscode from 'vscode';
import * as path from 'path';
import { generateDiagram } from '../generators/diagram.generator';

export async function registerDiagramCommand(uri?: vscode.Uri) {
    const entityUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!entityUri) {
        vscode.window.showErrorMessage('Open a NestJS entity file first.');
        return;
    }

    const entityFilePath = entityUri.fsPath;

    try {
        const diagramContent = await generateDiagram(entityFilePath);

        const outFile = path.join(path.dirname(entityFilePath), 'diagram.md');

        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(outFile),
            Buffer.from(diagramContent, 'utf8')
        );

        const doc = await vscode.workspace.openTextDocument(outFile);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage('Diagram generated successfully!');
    } catch (err: any) {
        vscode.window.showErrorMessage(`Error generating diagram: ${err.message || err}`);
    }
}
