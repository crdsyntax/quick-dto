import * as vscode from "vscode";
import {
  generateErdData,
  generateErdDataForEntities,
} from "../generators/er.generator";
import { SavedDiagramState, SavedPositions } from "../types/erd-types";

export class EntityVisualizer {
  public static currentPanel: EntityVisualizer | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _entityName: string = "";
  private _rootPath: string = "";

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "ready":
            this._sendInitialData();
            break;
          case "saveState":
            this._saveState(message.state);
            break;
          case "error":
            vscode.window.showErrorMessage(message.message);
            break;
          case "copyToClipboard":
            vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage("Markdown copiado al portapapeles");
            break;
        }
      },
      null,
      this._disposables,
    );
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    entityName: string,
    rootPath: string,
    context: vscode.ExtensionContext,
    entityList?: string[],
    strict: boolean = false,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Generate ERD data with progress indicator
    let erdData;
    try {
      erdData = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating ERD",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Analyzing entities..." });
          if (entityList && entityList.length > 0) {
            return await generateErdDataForEntities(
              rootPath,
              entityList,
              strict,
            );
          } else {
            return await generateErdData(rootPath, entityName);
          }
        },
      );
    } catch (err) {
      console.error("ERD generation error:", err);
      vscode.window.showErrorMessage(
        "No se pudo generar el diagrama. Verifica que existan archivos .entity.ts en src/ o un archivo schema.prisma.",
      );
      return;
    }

    const entityCount =
      erdData?.entities && Object.keys(erdData.entities).length;
    if (!entityCount) {
      vscode.window.showWarningMessage(
        "No se encontraron entidades para mostrar. Revisa la carpeta seleccionada en Entity View.",
      );
      return;
    }

    if (EntityVisualizer.currentPanel) {
      EntityVisualizer.currentPanel._panel.reveal(column);
      EntityVisualizer.currentPanel._update(erdData, entityName, rootPath);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "entityVisualizer",
      `ERD: ${entityName}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      },
    );

    EntityVisualizer.currentPanel = new EntityVisualizer(
      panel,
      extensionUri,
      context,
    );
    EntityVisualizer.currentPanel._update(erdData, entityName, rootPath);
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

  private _erdData: any;

  private _update(erdData: any, entityName: string, rootPath: string) {
    this._entityName = entityName;
    this._rootPath = rootPath;
    this._erdData = erdData;
    this._panel.title = `ERD: ${entityName}`;

    this._panel.webview.html = this._getHtmlForWebview();
    
    // Si el webview ya estaba cargado, enviamos los datos inmediatamente
    this._sendInitialData();
  }

  private _sendInitialData() {
    if (this._erdData) {
      const savedState = this._loadState();
      this._panel.webview.postMessage({
        type: 'setData',
        data: this._erdData,
        savedState: savedState
      });
    }
  }

  private _saveState(state: SavedDiagramState) {
    const key = `erd.state.${this._entityName}`;
    this._context.globalState.update(key, state);
  }

  private _loadState(): SavedDiagramState {
    const key = `erd.state.${this._entityName}`;
    return this._context.globalState.get(key, { positions: {}, relations: {} });
  }

  private _getHtmlForWebview() {
    const webview = this._panel.webview;

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "erd-visualizer-react", "dist", "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "erd-visualizer-react", "dist", "assets", "index.css")
    );

    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ER Diagram</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; img-src ${cspSource} data:; connect-src *;">
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div id="root"></div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
  }
}
