import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function handleCreateProject(uri?: vscode.Uri) {
    const framework = await vscode.window.showQuickPick(['React', 'NestJS'], {
        placeHolder: 'Selecciona el framework'
    });
    if (!framework) return;

    const folderName = await vscode.window.showInputBox({
        prompt: `Nombre de la carpeta para ${framework}`,
        validateInput: text => !text.match(/^[a-z0-9-_]+$/i) ? 'Nombre inválido' : null
    });
    if (!folderName) return;

    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Crear proyecto aquí',
        canSelectFiles: false,
        canSelectFolders: true,
        defaultUri: uri
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (!fileUri || !fileUri[0]) return;

    const targetPath = fileUri[0].fsPath;
    const projectFullDir = path.join(targetPath, folderName);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Creando proyecto ${framework}: ${folderName}`,
        cancellable: false
    }, async (progress) => {
        
        progress.report({ message: "Iniciando descarga de plantillas..." });

        let command = '';
        if (framework === 'React') {
            command = `npm create vite@latest ${folderName} -- --template react-ts`;
        } else if (framework === 'NestJS') {
            command = `npx @nestjs/cli new ${folderName} --package-manager npm`;
        }

        try {
            await execPromise(command, { cwd: targetPath });

            progress.report({ message: "Proyecto creado. Abriendo carpeta..." });

            const folderUri = vscode.Uri.file(projectFullDir);
            await vscode.commands.executeCommand('vscode.openFolder', folderUri, false);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Error al crear el proyecto: ${error.message}`);
        }
    });
}