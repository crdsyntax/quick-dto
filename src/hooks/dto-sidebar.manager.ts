import * as vscode from 'vscode';
import { ImportManager } from '../utils/dto-import.util';
import { WebviewMessage } from '../types/dto-sidebar.types';

export class DtoSidebarManager {
  public static async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.command) {
      case "insertSnippet":
        if (msg.snippet && msg.imports) {
          await this.insertSnippetAndEnsureImports(msg.snippet, msg.imports);
        }
        break;
      case "showWarning":
        if (msg.text) {
          vscode.window.showWarningMessage(msg.text);
        }
        break;
    }
  }

  private static async insertSnippetAndEnsureImports(
    snippet: string,
    imports: any
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor to insert DTO property.');
      return;
    }

    await editor.edit((eb) => {
      const sel = editor.selection;
      eb.insert(sel.active, '\n' + snippet + '\n');
    });

    await ImportManager.ensureImports(editor.document, imports);
  }
}
