import * as vscode from "vscode";
import * as fs from "fs";
import { io, Socket } from "socket.io-client";
import {
  HttpCollection,
  HttpTesterGenerator,
} from "../generators/http-tester.generator";

interface SocketTesterState {
  url: string;
  token: string;
  userId: string;
  eventName: string;
  payload: string;
}

export class HttpTesterSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "httpTesterView";
  public static instance: HttpTesterSidebarProvider | undefined;
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _generator = HttpTesterGenerator.getInstance();
  private _disposables: vscode.Disposable[] = [];

  // Socket.IO properties
  private socket?: Socket;
  private socketChannel: vscode.OutputChannel;
  private _socketState: SocketTesterState = {
    url: "http://localhost:3000",
    token: "",
    userId: "",
    eventName: "message",
    payload: "{\n  \n}",
  };

  private _lastSocketStatus: { text: string; class: string } = {
    text: "Disconnected",
    class: "disconnected",
  };

  constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;
    HttpTesterSidebarProvider.instance = this;
    this.socketChannel = vscode.window.createOutputChannel("Socket Tester Log");
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    this._setWebviewMessageListener(webviewView.webview);

    // Load collections initially
    this.refreshCollections();
  }

  public refreshCollections() {
    const collections = this._loadGlobalCollections();
    this.loadCollections(collections);
  }

  private _loadGlobalCollections(): HttpCollection[] {
    return this._context.globalState.get<HttpCollection[]>(
      "httpTester.collections",
      []
    );
  }

  public loadCollections(collections: HttpCollection[]) {
    if (this._view) {
      this._view.webview.postMessage({
        command: "loadCollections",
        collections: collections,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "http-tester-sidebar.html"
    );
    let html = fs.readFileSync(htmlPath.fsPath, "utf8");

    const rootUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media")
    );

    html = html.replace(/{{root}}/g, rootUri.toString());

    return html;
  }

  // --- Socket.IO Helper Methods ---

  private _postSocketLog(
    message: string,
    type: "info" | "error" | "event" = "info"
  ) {
    if (this._view) {
      this._view.webview.postMessage({ command: "socketLog", message, type });
    }
    this.socketChannel.appendLine(`[${type.toUpperCase()}] ${message}`);
  }

  private _updateSocketStatus(
    status: "Connected" | "Connecting" | "Disconnected",
    className: string
  ) {
    this._lastSocketStatus = { text: status, class: className };
    if (this._view) {
      this._view.webview.postMessage({
        command: "socketStatus",
        status: status,
        className: className,
      });
    }
    this.socketChannel.appendLine(`[STATUS] ${status}`);
  }

  // --- Socket.IO Connection Logic ---

  private _connectSocket(state: SocketTesterState) {
    this._disconnectSocket();

    this._updateSocketStatus("Connecting", "connecting");

    this.socket = io(state.url, {
      transports: ["websocket", "polling"],
      auth: state.token ? { token: `Bearer ${state.token}` } : undefined,
      query: state.userId ? { userId: state.userId } : undefined,
    });

    this.socket.on("connect", () => {
      this._updateSocketStatus("Connected", "connected");
      this._postSocketLog(`Connected to ${state.url}`, "info");

      if (state.userId) {
        this.socket?.emit("join", state.userId);
      }

      this.socket?.onAny((event, ...args) => {
        this._postSocketLog(
          `Event: ${event}\nPayload: ${JSON.stringify(args, null, 2)}`,
          "event"
        );
      });
    });

    this.socket.on("disconnect", (reason) => {
      this._updateSocketStatus("Disconnected", "disconnected");
      this._postSocketLog(`Disconnected: ${reason}`, "error");
    });

    this.socket.on("connect_error", (err) => {
      this._updateSocketStatus("Disconnected", "disconnected");
      this._postSocketLog(`Connection Error: ${err.message}`, "error");
      this.socket?.close();
    });
  }

  private _disconnectSocket() {
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
      this._updateSocketStatus("Disconnected", "disconnected");
      this._postSocketLog("Disconnected by user", "info");
    }
  }

  private _emitEvent(data: { eventName: string; payload: string }) {
    if (!this.socket || !this.socket.connected) {
      this._postSocketLog("Socket is not connected.", "error");
      if (this._view) {
        this._view.webview.postMessage({
          command: "error",
          message: "Socket is not connected.",
        });
      }
      return;
    }

    try {
      let payloadObject;
      const trimmedPayload = data.payload.trim();

      if (trimmedPayload) {
        payloadObject = JSON.parse(trimmedPayload);
      } else {
        payloadObject = {};
      }

      this.socket.emit(data.eventName, payloadObject);
      this._postSocketLog(
        `Emitted: ${data.eventName}\nPayload: ${data.payload}`,
        "info"
      );
    } catch (err: any) {
      this._postSocketLog(
        `Payload Error: Invalid JSON - ${err.message}`,
        "error"
      );
      if (this._view) {
        this._view.webview.postMessage({
          command: "error",
          message: `Invalid JSON Payload: ${err.message}`,
        });
      }
    }
  }

  private _handleSocketMessage(msg: any) {
    const { command, data } = msg;

    if (data && command === "socketStateUpdate") {
      this._socketState = { ...this._socketState, ...data };
    }

    switch (command) {
      case "socketConnect":
        this._connectSocket(this._socketState);
        break;
      case "socketDisconnect":
        this._disconnectSocket();
        break;
      case "socketEmit":
        this._emitEvent(data);
        break;
      case "socketGetInitialState":
        if (this._view) {
          this._view.webview.postMessage({
            command: "socketInitialState",
            state: this._socketState,
            status: this._lastSocketStatus,
          });
        }
        break;
    }
  }

  // --- Webview Message Handling ---

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (msg) => {
        try {
          if (msg.command === "sendRequest") {
            // Abrir el HTTP Tester Panel en el editor
            const { HttpTesterPanel } = require("./http-tester.view");
            const panel = HttpTesterPanel.createOrShow(
              this._extensionUri,
              this._context
            );

            // Enviar la petición al panel del editor
            setTimeout(() => {
              panel._panel.webview.postMessage({
                command: "loadRequest",
                request: msg.request,
              });
            }, 1000);
          } else if (msg.command === "openInEditor") {
            // Abrir colección en el editor
            const { HttpTesterPanel } = require("./http-tester.view");
            const panel = HttpTesterPanel.createOrShow(
              this._extensionUri,
              this._context
            );

            // Cargar la colección en el panel del editor
            setTimeout(() => {
              // Send only the single collection to load into the form
              panel._panel.webview.postMessage({
                command: "loadCollection",
                collection: msg.collection,
              });
            }, 1000);
          } else if (msg.command === "importJson") {
            // Handle JSON import
            await this._handleImportJson(msg.type);
          } else if (msg.command === "exportJson") {
            // Handle JSON export
            await this._handleExportJson(msg.collections);
          } else if (msg.command === "ready") {
            this.refreshCollections();
          } else if (msg.command.startsWith("socket")) {
            this._handleSocketMessage(msg);
          }
        } catch (err) {
          webview.postMessage({
            command: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      },
      null,
      this._disposables
    );
  }

  private async _handleImportJson(type: "http" | "socket") {
    try {
      // Show file picker
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Importar JSON",
        filters: {
          "JSON files": ["json"],
        },
      });

      if (!fileUri || fileUri.length === 0) {
        return; // User cancelled
      }

      // Read the file
      const fileContent = fs.readFileSync(fileUri[0].fsPath, "utf8");

      // Parse JSON
      let collections: HttpCollection[];
      try {
        const parsed = JSON.parse(fileContent);

        // Check if it's an array or a single object
        if (Array.isArray(parsed)) {
          collections = parsed;
        } else {
          collections = [parsed];
        }

        // Validate that all collections have the required fields
        const validCollections = collections.filter((col) => {
          return col.name && col.type && col.url;
        });

        if (validCollections.length === 0) {
          vscode.window.showErrorMessage(
            "El archivo JSON no contiene colecciones válidas."
          );
          return;
        }

        // Filter by type if needed
        const filteredCollections = validCollections.filter(
          (col) => col.type === type
        );

        if (filteredCollections.length === 0) {
          vscode.window.showWarningMessage(
            `No se encontraron colecciones de tipo "${type}" en el archivo.`
          );
          return;
        }

        // --- PERSISTENCE UPDATE ---
        // Get existing Global State collections
        const currentCollections = this._loadGlobalCollections();

        // Merge new collections (avoid duplicates by name+type)
        filteredCollections.forEach((newCol) => {
          const existsIndex = currentCollections.findIndex(
            (c) => c.name === newCol.name && c.type === newCol.type
          );
          if (existsIndex !== -1) {
            // Update existing? Or skip? Let's update/overwrite
            currentCollections[existsIndex] = newCol;
          } else {
            currentCollections.push(newCol);
          }
        });

        // Save back to Global State
        await this._context.globalState.update(
          "httpTester.collections",
          currentCollections
        );

        // Refresh UI
        this.refreshCollections();

        vscode.window.showInformationMessage(
          `✅ ${filteredCollections.length} colección(es) importada(s) y guardada(s).`
        );
      } catch (parseError) {
        vscode.window.showErrorMessage(
          `Error al parsear el archivo JSON: ${
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
          }`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al importar JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async _handleExportJson(collections: HttpCollection[]) {
    try {
      // Show save dialog
      const fileUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file("collections.json"),
        filters: {
          "JSON files": ["json"],
        },
        saveLabel: "Exportar",
      });

      if (!fileUri) {
        return; // User cancelled
      }

      // Convert collections to JSON
      const jsonContent = JSON.stringify(collections, null, 2);

      // Write to file
      fs.writeFileSync(fileUri.fsPath, jsonContent, "utf8");

      vscode.window.showInformationMessage(
        `✅ ${collections.length} colección(es) exportada(s) exitosamente a ${fileUri.fsPath}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al exportar JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  public dispose() {
    this._disconnectSocket();
    this.socketChannel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }
}
