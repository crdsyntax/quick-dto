import * as vscode from "vscode";
import { generateMermaidString } from "../generators/er.generator";
import * as path from "path";

export class EntityVisualizer {
  public static currentPanel: EntityVisualizer | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    entityName: string,
    rootPath: string
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Generate Mermaid content
    const mermaidContent = await generateMermaidString(rootPath, entityName);

    if (EntityVisualizer.currentPanel) {
      EntityVisualizer.currentPanel._panel.reveal(column);
      EntityVisualizer.currentPanel._update(mermaidContent, entityName);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "entityVisualizer",
      `ERD: ${entityName}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    EntityVisualizer.currentPanel = new EntityVisualizer(panel, extensionUri);
    EntityVisualizer.currentPanel._update(mermaidContent, entityName);
  }

  public dispose() {
    EntityVisualizer.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(mermaidContent: string, title: string) {
    this._panel.title = `ERD: ${title}`;
    this._panel.webview.html = this._getHtmlForWebview(mermaidContent);
  }

  private _getHtmlForWebview(mermaidContent: string) {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ER Diagram</title>
            <script type="module">
                import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
                mermaid.initialize({ startOnLoad: true, theme: 'dark' });
            </script>
            <style>
                body {
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .mermaid {
                    width: 100%;
                    text-align: center;
                }
                .controls {
                    margin-bottom: 20px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="controls">
                <button onclick="location.reload()">Refresh Diagram</button>
            </div>
            <div class="mermaid">
                ${mermaidContent}
            </div>
        </body>
        </html>`;
  }
}
