import * as vscode from "vscode";
import * as fs from "fs";
import { io, Socket } from "socket.io-client";
import {
  HttpCollection,
  HttpTesterGenerator,
} from "../generators/http-tester.generator";
import { loadSidebarHtml } from "./http-tester-sidebar/helpers/webview.helpers";
import {
  buildSocketClientOptions,
  parseSocketPayload,
} from "./http-tester-sidebar/helpers/socket.helpers";
import {
  filterCollectionsByType,
  isValidHttpCollection,
  mergeCollections,
  normalizeCollections,
} from "./http-tester-sidebar/helpers/collection.helpers";
import {
  detectSwaggerUrls,
  loadOpenApiJson,
  resolveOpenApiBaseUrl,
} from "./http-tester-sidebar/helpers/swagger.helpers";
import {
  SocketStatus,
  SocketTesterState,
  WebviewMessage,
} from "./http-tester-sidebar/types";

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
    // Desactivado a petición del usuario (evita poblar el panel de salida inferior)
    this.socketChannel = { appendLine: () => {}, dispose: () => {} } as any;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    this._setWebviewMessageListener(webviewView.webview);

    // Load collections and global token initially
    this.refreshCollections();
    this._sendGlobalToken();
  }

  public refreshCollections() {
    const collections = this._loadGlobalCollections();
    this.loadCollections(collections);
  }

  private _loadGlobalCollections(): HttpCollection[] {
    return this._context.globalState.get<HttpCollection[]>(
      "httpTester.collections",
      [],
    );
  }

  private _sendGlobalToken() {
    if (this._view) {
      const token = this._context.globalState.get<string>(
        "httpTester.globalToken",
        "",
      );
      this._view.webview.postMessage({
        command: "loadGlobalToken",
        token: token,
      });
    }
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
    return loadSidebarHtml(this._extensionUri, webview);
  }

  // --- Socket.IO Helper Methods ---

  private _postSocketLog(
    message: string,
    type: "info" | "error" | "event" = "info",
  ) {
    if (this._view) {
      this._view.webview.postMessage({ command: "socketLog", message, type });
    }
    this.socketChannel.appendLine(`[${type.toUpperCase()}] ${message}`);
  }

  private _updateSocketStatus(
    status: "Connected" | "Connecting" | "Disconnected",
    className: string,
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

    this.socket = io(state.url, buildSocketClientOptions(state));

    this.socket.on("connect", () => {
      this._updateSocketStatus("Connected", "connected");
      this._postSocketLog(`Connected to ${state.url}`, "info");

      if (state.userId) {
        this.socket?.emit("join", state.userId);
      }

      this.socket?.onAny((event, ...args) => {
        this._postSocketLog(
          `Event: ${event}\nPayload: ${JSON.stringify(args, null, 2)}`,
          "event",
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
      const payloadObject = parseSocketPayload(data.payload);

      this.socket.emit(data.eventName, payloadObject);
      this._postSocketLog(
        `Emitted: ${data.eventName}\nPayload: ${data.payload}`,
        "info",
      );
    } catch (err: any) {
      this._postSocketLog(
        `Payload Error: Invalid JSON - ${err.message}`,
        "error",
      );
      if (this._view) {
        this._view.webview.postMessage({
          command: "error",
          message: `Invalid JSON Payload: ${err.message}`,
        });
      }
    }
  }

  private _handleSocketMessage(msg: WebviewMessage) {
    const { command } = msg;
    const data = (msg as { data?: unknown }).data;

    if (data && command === "socketStateUpdate" && typeof data === "object") {
      this._socketState = {
        ...this._socketState,
        ...(data as Partial<SocketTesterState>),
      };
    }

    switch (command) {
      case "socketConnect":
        this._connectSocket(this._socketState);
        break;
      case "socketDisconnect":
        this._disconnectSocket();
        break;
      case "socketEmit": {
        if (
          data &&
          typeof data === "object" &&
          typeof (data as { eventName?: unknown }).eventName === "string" &&
          typeof (data as { payload?: unknown }).payload === "string"
        ) {
          this._emitEvent(data as { eventName: string; payload: string });
        }
        break;
      }
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
      async (msg: WebviewMessage) => {
        try {
          if (msg.command === "sendRequest") {
            // Abrir el HTTP Tester Panel en el editor
            const { HttpTesterPanel } = require("./http-tester.view");
            const panel = HttpTesterPanel.createOrShow(
              this._extensionUri,
              this._context,
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
              this._context,
            );

            // Cargar la colección en el panel del editor
            setTimeout(() => {
              // Send only the single collection to load into the form
              panel._panel.webview.postMessage({
                command: "loadCollection",
                collection: msg.collection,
              });
            }, 1000);
          } else if (msg.command === "saveCollection") {
            const currentCollections = this._loadGlobalCollections();
            const newCollection = msg.collection as HttpCollection;
            const updatedCollections = mergeCollections(currentCollections, [
              newCollection,
            ]);

            const { HttpTesterPanel } = require("./http-tester.view");
            await HttpTesterPanel.saveCollections(
              this._context,
              updatedCollections,
            );
            vscode.window.showInformationMessage(
              `Colección '${newCollection.name}' guardada`,
            );
          } else if (msg.command === "importSwagger" && typeof msg.url === "string") {
            await this._handleImportSwagger(msg.url);
          } else if (msg.command === "detectSwagger") {
            const urls = await detectSwaggerUrls(
              vscode.workspace.workspaceFolders,
            );
            if (urls.length === 0) {
              vscode.window.showWarningMessage(
                "No se detectaron URLs de Swagger automáticamente. Intenta ingresar una manualmente.",
              );
              webview.postMessage({
                command: "stopLoading",
              });
              return;
            }

            const selectedUrl = await vscode.window.showQuickPick(urls, {
              placeHolder: "Selecciona la URL de Swagger detectada",
              title: "Importar desde Swagger",
            });

            if (selectedUrl) {
              await this._handleImportSwagger(selectedUrl);
            }

            webview.postMessage({
              command: "stopLoading",
            });
          } else if (
            msg.command === "importJson" &&
            (msg.type === "http" || msg.type === "socket")
          ) {
            await this._handleImportJson(msg.type);
          } else if (
            msg.command === "exportJson" &&
            Array.isArray(msg.collections)
          ) {
            await this._handleExportJson(msg.collections as HttpCollection[]);
          } else if (
            msg.command === "updateGlobalToken" ||
            msg.command === "saveGlobalToken"
          ) {
            await this._context.globalState.update(
              "httpTester.globalToken",
              msg.token as string,
            );
            if (msg.command === "updateGlobalToken") {
              vscode.window.showInformationMessage("Token Global actualizado");
            }
            const { HttpTesterPanel } = require("./http-tester.view");
            HttpTesterPanel.panels.forEach((panel: any) => {
              panel._panel.webview.postMessage({
                command: "loadGlobalToken",
                token: msg.token,
              });
            });
            if (this._view) {
              this._view.webview.postMessage({
                command: "loadGlobalToken",
                token: msg.token,
              });
            }
          } else if (msg.command === "saveGlobalRefreshToken") {
            await this._context.globalState.update(
              "httpTester.globalRefreshToken",
              msg.token as string,
            );
            const { HttpTesterPanel } = require("./http-tester.view");
            HttpTesterPanel.panels.forEach((panel: any) => {
              panel._panel.webview.postMessage({
                command: "loadGlobalRefreshToken",
                token: msg.token,
              });
            });
          } else if (msg.command === "copyToClipboard" && typeof msg.text === "string") {
            await vscode.env.clipboard.writeText(msg.text);
            vscode.window.showInformationMessage("Copiado al portapapeles");
          } else if (msg.command === "clearCollections") {
            const isAll = !msg.type;
            const filterType = typeof msg.type === "string" ? msg.type : undefined;
            const confirmMsg = isAll 
              ? "¿Estás seguro de que deseas eliminar TODAS las colecciones? Esta acción no se puede deshacer."
              : `¿Estás seguro de que deseas eliminar TODAS las colecciones de tipo ${
                  filterType?.toUpperCase() ?? "?"
                }? Esta acción no se puede deshacer.`;

            const confirmVal = await vscode.window.showWarningMessage(
              confirmMsg,
              { modal: true },
              "Eliminar Todo",
            );
            if (confirmVal === "Eliminar Todo") {
              const currentCollections = this._loadGlobalCollections();
              const updatedCollections = isAll
                ? []
                : currentCollections.filter((c) => c.type !== filterType);
              const { HttpTesterPanel } = require("./http-tester.view");
              await HttpTesterPanel.saveCollections(
                this._context,
                updatedCollections,
              );
              vscode.window.showInformationMessage(
                isAll
                  ? "Todas las colecciones han sido eliminadas"
                  : `Colecciones de tipo ${filterType?.toUpperCase() ?? "?"} eliminadas`,
              );
            }
          } else if (
            msg.command === "deleteCollection" &&
            typeof msg.name === "string" &&
            typeof msg.type === "string"
          ) {
            const confirmVal = await vscode.window.showWarningMessage(
              `¿Estás seguro de que deseas eliminar la colección '${msg.name}' (${msg.type.toUpperCase()})?`,
              { modal: true },
              "Eliminar",
            );
            if (confirmVal === "Eliminar") {
              const currentCollections = this._loadGlobalCollections();
              const updatedCollections = currentCollections.filter(
                (c) => !(c.name === msg.name && c.type === msg.type),
              );
              const { HttpTesterPanel } = require("./http-tester.view");
              await HttpTesterPanel.saveCollections(
                this._context,
                updatedCollections,
              );
              vscode.window.showInformationMessage(
                `Colección '${msg.name}' eliminada`,
              );
            }
          } else if (msg.command === "showToast" && typeof msg.message === "string") {
            vscode.window.showInformationMessage(msg.message);
          } else if (msg.command === "ready") {
            this.refreshCollections();
            this._sendGlobalToken();
          } else if (typeof msg.command === "string" && msg.command.startsWith("socket")) {
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
      this._disposables,
    );
  }

  private async _handleImportJson(type: "http" | "socket") {
    try {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Importar JSON",
        filters: {
          "JSON files": ["json"],
        },
      });

      if (!fileUri || fileUri.length === 0) {
        return;
      }

      const fileContent = fs.readFileSync(fileUri[0].fsPath, "utf8");
      const parsed = JSON.parse(fileContent);
      const collections = normalizeCollections(parsed);

      if (collections.length === 0) {
        vscode.window.showErrorMessage(
          "El archivo JSON no contiene colecciones válidas.",
        );
        return;
      }

      const filteredCollections = filterCollectionsByType(collections, type);
      if (filteredCollections.length === 0) {
        vscode.window.showWarningMessage(
          `No se encontraron colecciones de tipo "${type}" en el archivo.`,
        );
        return;
      }

      const currentCollections = this._loadGlobalCollections();
      const updatedCollections = mergeCollections(
        currentCollections,
        filteredCollections,
      );

      const { HttpTesterPanel } = require("./http-tester.view");
      await HttpTesterPanel.saveCollections(this._context, updatedCollections);

      vscode.window.showInformationMessage(
        `✅ ${filteredCollections.length} colección(es) importada(s) y guardada(s).`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al importar JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
        `✅ ${collections.length} colección(es) exportada(s) exitosamente a ${fileUri.fsPath}`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al exportar JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private _detectSwaggerUrls(): Promise<string[]> {
    return detectSwaggerUrls(vscode.workspace.workspaceFolders);
  }

  private async _handleImportSwagger(urlOrPath: string) {
    try {
      const openApiJson = await loadOpenApiJson(urlOrPath);
      const baseUrl = resolveOpenApiBaseUrl(urlOrPath);

      const collections = HttpTesterGenerator.generateCollectionsFromOpenApi(
        openApiJson,
        baseUrl,
      );

      if (collections.length === 0) {
        vscode.window.showWarningMessage(
          "No se pudieron generar colecciones desde el JSON de Swagger proporcionado.",
        );
        return;
      }

      const currentCollections = this._loadGlobalCollections();
      const updatedCollections = mergeCollections(
        currentCollections,
        collections,
      );

      const { HttpTesterPanel } = require("./http-tester.view");
      await HttpTesterPanel.saveCollections(this._context, updatedCollections);

      vscode.window.showInformationMessage(
        `✅ ${collections.length} peticiones importadas y guardadas desde Swagger.`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Error al importar Swagger: ${message}`);
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
