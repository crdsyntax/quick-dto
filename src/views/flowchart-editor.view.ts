import * as vscode from "vscode";
import { FlowchartData, FlowchartMessage } from "../types/flowchart-types";

export class FlowchartEditorPanel {
  public static currentPanel: FlowchartEditorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _currentData: FlowchartData;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    initialData: FlowchartData
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;
    this._currentData = initialData;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: FlowchartMessage | any) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    initialData: FlowchartData
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (FlowchartEditorPanel.currentPanel) {
      FlowchartEditorPanel.currentPanel._panel.reveal(column);
      FlowchartEditorPanel.currentPanel._update(initialData);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "flowchartEditor",
      "Flowchart Editor",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    FlowchartEditorPanel.currentPanel = new FlowchartEditorPanel(
      panel,
      extensionUri,
      context,
      initialData
    );
    FlowchartEditorPanel.currentPanel._update(initialData);
  }

  public dispose(): void {
    FlowchartEditorPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _handleMessage(message: FlowchartMessage | any): void {
    switch (message.type) {
      case "save":
        this._saveData(message.data);
        break;
      case "export":
        if (message.format && message.content) {
          this._exportDiagram(message.format, message.content);
        }
        break;
      case "error":
        vscode.window.showErrorMessage(message.message);
        break;
      case "info":
        vscode.window.showInformationMessage(message.message);
        break;
      case "ready":
        this._sendInitialData();
        break;
    }
  }

  private _sendInitialData(): void {
    this._panel.webview.postMessage({
      type: 'loadData',
      data: this._currentData
    });
  }

  private _saveData(data: FlowchartData): void {
    this._currentData = data;
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || "default";
    const key = `flowchart.data.${workspaceName}`;
    this._context.globalState.update(key, data);
  }

  private async _exportDiagram(format: string, content: string): Promise<void> {
    const filters: Record<string, string[]> = format === "svg" 
      ? { "SVG Image": ["svg"] } 
      : { "JSON File": ["json"] };

    const uri = await vscode.window.showSaveDialog({
      filters,
      defaultUri: vscode.Uri.file(`flowchart-${new Date().toISOString().slice(0, 10)}.${format}`),
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
      vscode.window.showInformationMessage(`Diagrama exportado: ${uri.fsPath}`);
    }
  }

  private _update(data: FlowchartData): void {
    this._currentData = data;
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const baseUri = vscode.Uri.joinPath(this._extensionUri, "media", "flowchart-editor-react", "dist", "assets");
    
    // In a real scenario, we'd need to find the actual filenames which might have hashes
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(baseUri, "index.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(baseUri, "index.css"));

    const initialDataJson = JSON.stringify(this._currentData);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flowchart Editor</title>
    <link rel="stylesheet" href="${styleUri}">
    <script>
      window.initialData = ${initialDataJson};
    </script>
</head>
<body>
    <div id="root"></div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export default FlowchartEditorPanel;
