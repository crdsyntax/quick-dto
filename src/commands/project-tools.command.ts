import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateNestModules, patchAppModule } from '../templates/nestjs-modules.template';
import {
  generateReactFiles,
  NEST_EXTRA_DEPS_CMD,
  REACT_EXTRA_DEPS_CMD,
} from '../templates/react-crud.template';

const execPromise = promisify(exec);
const EXEC_TIMEOUT_MS = 10 * 60 * 1000;

function writeFilesRecursively(rootDir: string, files: Record<string, string>): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}

async function openOrAddToWorkspace(folderUri: vscode.Uri): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const hasWorkspaceFile = !!vscode.workspace.workspaceFile;

  if (folders.length === 0 && !hasWorkspaceFile) {
    await vscode.commands.executeCommand('vscode.openFolder', folderUri, false);
    return;
  }

  const alreadyAdded = folders.some((f) => f.uri.toString() === folderUri.toString());
  if (!alreadyAdded) {
    vscode.workspace.updateWorkspaceFolders(folders.length, null, { uri: folderUri });
  }
}

export async function handleCreateProject(uri?: vscode.Uri) {
  const framework = await vscode.window.showQuickPick(['React', 'NestJS'], {
    placeHolder: 'Selecciona el framework',
  });
  if (!framework) return;

  const isFullTemplate =
    (
      await vscode.window.showQuickPick(
        [
          {
            label: 'Proyecto vacío',
            description: 'Solo el scaffold base del framework',
          },
          framework === 'React'
            ? {
                label: 'CRUD completo',
                description:
                  'Login + users/roles/permissions, capa de servicios con axios, componentes Tailwind',
              }
            : {
                label: 'CRUD completo',
                description:
                  'Módulos users/roles/permissions/auth: controller, dto (request/response), repository, service, helpers, types',
              },
        ],
        { placeHolder: 'Selecciona la plantilla' }
      )
    )?.label === 'CRUD completo';

  const folderName = await vscode.window.showInputBox({
    prompt: `Nombre de la carpeta para ${framework}`,
    validateInput: (text) =>
      !text.match(/^[a-z][a-z0-9-_]*$/)
        ? 'Debe iniciar con letra minúscula y contener solo letras, números, guiones o guiones bajos'
        : null,
  });
  if (!folderName) return;

  const fileUri = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Crear proyecto aquí',
    canSelectFiles: false,
    canSelectFolders: true,
    defaultUri: uri ?? vscode.workspace.workspaceFolders?.[0]?.uri,
  });
  if (!fileUri || !fileUri[0]) return;

  const targetPath = fileUri[0].fsPath;
  const projectFullDir = path.join(targetPath, folderName);

  if (fs.existsSync(projectFullDir)) {
    vscode.window.showErrorMessage(
      `La carpeta '${folderName}' ya existe en ${targetPath}. Elige otro nombre o destino.`
    );
    return;
  }

  let command = '';
  if (framework === 'React') {
    command = `npm create vite@latest ${folderName} -- --template react-ts`;
  } else {
    command = `npx @nestjs/cli new ${folderName} --package-manager npm --skip-git`;
  }

  const created = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Creando proyecto ${framework}: ${folderName}`,
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Ejecutando scaffold base...' });
        await execPromise(command, {
          cwd: targetPath,
          timeout: EXEC_TIMEOUT_MS,
          maxBuffer: 16 * 1024 * 1024,
        });

        if (isFullTemplate) {
          progress.report({ message: 'Generando módulos y componentes...' });

          if (framework === 'NestJS') {
            writeFilesRecursively(projectFullDir, generateNestModules());
            patchAppModule(path.join(projectFullDir, 'src', 'app.module.ts'), fs);
          } else {
            writeFilesRecursively(projectFullDir, generateReactFiles());
          }

          progress.report({
            message: 'Instalando dependencias adicionales...',
          });
          await execPromise(framework === 'NestJS' ? NEST_EXTRA_DEPS_CMD : REACT_EXTRA_DEPS_CMD, {
            cwd: projectFullDir,
            timeout: EXEC_TIMEOUT_MS,
            maxBuffer: 16 * 1024 * 1024,
          });
        }

        return true;
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error al crear el proyecto: ${error.message}${
            error.stderr ? `\n${String(error.stderr).slice(0, 500)}` : ''
          }`
        );
        return false;
      }
    }
  );

  if (!created) return;

  await openOrAddToWorkspace(vscode.Uri.file(projectFullDir));
}
