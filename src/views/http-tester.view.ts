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
  path: string;
  transports?: ("websocket" | "polling")[];
}

export class HttpTesterPanel {
  // Cambiar a un array para manejar múltiples paneles
  public static panels: HttpTesterPanel[] = [];
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _generator = HttpTesterGenerator.getInstance();
  private static _context: vscode.ExtensionContext;
  private static readonly COLLECTIONS_STORAGE_KEY = "httpTester.collections";
  private static readonly LAST_REQUEST_STORAGE_KEY = "httpTester.lastRequest";

  private socket?: Socket;
  private socketChannel: vscode.OutputChannel;
  private listenChannel: vscode.OutputChannel;
  private _socketState: SocketTesterState = {
    url: "http://localhost:3000",
    token: "",
    userId: "",
    eventName: "",
    payload: "{\n  \n}",
    path: "",
    transports: ["polling", "websocket"],
  };

  private _lastSocketStatus: { text: string; class: string } = {
    text: "Disconnected",
    class: "disconnected",
  };

  private _listenedEvents: Set<string> = new Set();
  private _globalToken: string = "";
  private _isRepeating: boolean = false;

  // ID único para cada panel
  private readonly _id: string;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Cargar token global inicial
    this._globalToken = HttpTesterPanel._context?.globalState.get<string>("httpTester.globalToken", "") || "";

    // Configurar el panel
    this._panel.title = `API Tester ${HttpTesterPanel.panels.length + 1}`;
    this._panel.webview.html = this._getHtmlForWebview(this._id);
    this._setWebviewMessageListener(this._panel.webview);

    // Manejar el cierre del panel
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Inicializar los canales de salida del socket desactivados a petición del usuario (evita poblar el panel de salida inferior)
    this.socketChannel = { appendLine: () => {}, dispose: () => {} } as any;
    this.listenChannel = { appendLine: () => {}, dispose: () => {} } as any;

    // Añadir a la lista de paneles activos
    HttpTesterPanel.panels.push(this);

    // Cargar colecciones
    this._loadAndSendCollections();
    this._sendGlobalToken();
  }

  private _sendGlobalToken() {
    this._panel.webview.postMessage({
      command: "loadGlobalToken",
      token: this._globalToken,
      panelId: this._id,
    });
  }

  public loadCollections(collections: HttpCollection[]) {
    if (this._panel) {
      this._panel.webview.postMessage({
        command: "loadCollections",
        collections: collections,
      });
    }
  }

  public syncCollections(collections: HttpCollection[]) {
    if (this._panel) {
      this._panel.webview.postMessage({
        command: "initializeCollections",
        collections: collections,
        panelId: this._id,
      });
    }
  }

  public loadCollection(collection: HttpCollection) {
    if (this._panel) {
      this._panel.webview.postMessage({
        command: "loadCollection",
        collection: collection,
      });
    }
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    context?: vscode.ExtensionContext,
    title?: string
  ): HttpTesterPanel {
    // Store context if provided
    if (context) {
      HttpTesterPanel._context = context;
    }

    const panel = vscode.window.createWebviewPanel(
      "httpTester",
      title || `API Tester ${HttpTesterPanel.panels.length + 1}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    return new HttpTesterPanel(panel, extensionUri);
  }

  public static createNewTab(
    extensionUri: vscode.Uri,
    context?: vscode.ExtensionContext
  ) {
    this.createOrShow(
      extensionUri,
      context,
      `API Tester ${this.panels.length + 1}`
    );
  }

  public static showAllPanels() {
    HttpTesterPanel.panels.forEach((panel, index) => {
      panel._panel.reveal();
    });
  }

  public static getPanelCount(): number {
    return HttpTesterPanel.panels.length;
  }

  private _getHtmlForWebview(panelId: string): string {
    const webview = this._panel.webview;

    // Obtener URIs locales de los recursos compilados de Vite
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "http-tester-react", "dist", "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "http-tester-react", "dist", "assets", "index.css")
    );

    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <!-- Content Security Policy -->
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; connect-src *;">
          <title>API Tester</title>
          <link rel="stylesheet" href="${styleUri}">
        </head>
        <body class="bg-[#050505] text-[#d1d1d1] min-h-screen font-mono">
          <div id="root"></div>
          
          <script>
            // Inyectar el ID del panel globalmente para que el hook lo use
            window.vscodePanelId = "${panelId}";
          </script>
          <script src="${scriptUri}"></script>
        </body>
      </html>`;
  }

  // --- Lógica de Socket.IO Helper Methods ---

  private _postSocketLog(
    message: string,
    type: "info" | "error" | "event" = "info"
  ) {
    // Enviar log al Webview con ID del panel
    this._panel.webview.postMessage({
      command: "socketLog",
      message,
      type,
      panelId: this._id,
    });
    // Enviar log al canal de salida de VS Code
    this.socketChannel.appendLine(`[${type.toUpperCase()}] ${message}`);
  }

  private _updateSocketStatus(
    status: "Connected" | "Connecting" | "Disconnected",
    className: string
  ) {
    this._lastSocketStatus = { text: status, class: className };
    this._panel.webview.postMessage({
      command: "socketStatus",
      status: status,
      className: className,
      panelId: this._id,
    });
    this.socketChannel.appendLine(`[STATUS] ${status}`);
  }

  // --- Lógica de Conexión Socket.IO ---

  private _connectSocket(state: SocketTesterState) {
    this._disconnectSocket(); // Limpieza previa

    this._updateSocketStatus("Connecting", "connecting");

    // Conexión con opciones de autenticación y query
    this.socket = io(state.url, {
      transports: state.transports || ["websocket", "polling"],
      path: state.path || "/socket.io",
      auth: state.token ? { token: state.token } : undefined,
      query: state.userId ? { userId: state.userId } : undefined,
    });

    this.socket.on("connect", () => {
      this._updateSocketStatus("Connected", "connected");
      this._postSocketLog(`Connected to ${state.url}`, "info");

      // Lógica para unirse a un room si hay userId
      if (state.userId) {
        this.socket?.emit("join", state.userId);
      }

      // Listener de cualquier evento recibido
      this.socket?.onAny((event, ...args) => {
        if (this._listenedEvents.has(event)) {
          return; // Ignore events that are specifically listened to
        }
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
      this._listenedEvents.clear();
    }
  }

  private _emitEvent(data: { eventName: string; payload: string }) {
    if (!this.socket || !this.socket.connected) {
      this._postSocketLog("Socket is not connected.", "error");
      this._panel.webview.postMessage({
        command: "error",
        message: "Socket is not connected.",
        panelId: this._id,
      });
      return;
    }

    try {
      // Parsear el payload o usar objeto vacío si está vacío
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
      this._panel.webview.postMessage({
        command: "error",
        message: `Invalid JSON Payload: ${err.message}`,
        panelId: this._id,
      });
    }
  }

  private _listenSocketEvent(eventName: string) {
    if (!this.socket || !this.socket.connected) {
      this._postSocketLog("Socket is not connected.", "error");
      this._panel.webview.postMessage({
        command: "error",
        message: "Socket is not connected.",
        panelId: this._id,
      });
      return;
    }

    this._listenedEvents.add(eventName);
    this.socket.off(eventName); // Evitar duplicados
    this.socket.on(eventName, (...args) => {
      this._panel.webview.postMessage({
        command: "socketListenLog",
        eventName: eventName,
        message: `${JSON.stringify(args, null, 2)}`,
        panelId: this._id,
      });
      this.listenChannel.appendLine(`[LISTEN - ${eventName}] ${JSON.stringify(args)}`);
    });
    this._postSocketLog(`Listening to event: ${eventName}`, "info");
  }

  private _handleSocketMessage(msg: any) {
    const { command, data, panelId } = msg;

    // Verificar que el mensaje sea para este panel
    if (panelId && panelId !== this._id) {
      return;
    }

    // Actualiza el estado local cada vez que el usuario interactúa
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
      case "socketListen":
        this._listenSocketEvent(data.eventName);
        break;
      case "socketGetInitialState":
        // Envía el estado inicial y el último estatus al abrir la pestaña
        this._panel.webview.postMessage({
          command: "socketInitialState",
          state: this._socketState,
          status: this._lastSocketStatus,
          panelId: this._id,
        });
        break;
    }
  }

  // --- Manejo de mensajes del Webview (Combinado) ---

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (msg) => {
        try {
          // Verificar si el mensaje es para este panel
          if (msg.panelId && msg.panelId !== this._id) {
            return;
          }

          if (msg.command === "sendRequest") {
            const result = await this._generator.sendRequest(msg.request);
            webview.postMessage({
              command: "response",
              response: result,
              panelId: this._id,
            });
          } else if (msg.command === "repeatRequest") {
            const repeatCount = msg.repeatCount || 1;
            const delay = msg.delay || 0;
            const results = [];
            this._isRepeating = true;

            const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

            for (let i = 0; i < repeatCount; i++) {
              if (!this._isRepeating) break;

              try {
                if (i > 0 && delay > 0) {
                  await sleep(delay);
                }

                if (!this._isRepeating) break;

                const result = await this._generator.sendRequest(msg.request);
                results.push({
                  iteration: i + 1,
                  success: true,
                  response: result,
                });

                webview.postMessage({
                  command: "repeatProgress",
                  current: i + 1,
                  total: repeatCount,
                  response: result,
                  panelId: this._id,
                });
              } catch (error) {
                results.push({
                  iteration: i + 1,
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            this._isRepeating = false;
            webview.postMessage({
              command: "repeatComplete",
              results: results,
              totalRequests: repeatCount,
              panelId: this._id,
            });
          } else if (msg.command === "stopRepeatedRequests") {
            this._isRepeating = false;
            vscode.window.showInformationMessage("Peticiones repetidas detenidas");
          } else if (msg.command === "saveCollection") {
            const currentCollections = this._loadCollections();
            const newCollection = msg.collection;

            const existsIndex = currentCollections.findIndex(
              (c) => c.name === newCollection.name && c.type === newCollection.type
            );

            if (existsIndex !== -1) {
              currentCollections[existsIndex] = newCollection;
            } else {
              currentCollections.push(newCollection);
            }

            await HttpTesterPanel.saveCollections(HttpTesterPanel._context, currentCollections);
            vscode.window.showInformationMessage(`Colección '${newCollection.name}' guardada`);
          } else if (msg.command === "importJson") {
            await this._handleImportJson(msg.type);
          } else if (msg.command === "exportJson") {
            await this._handleExportJson(msg.type, msg.collections);
          } else if (msg.command === "saveCollections") {
            await this._saveCollections(msg.collections);
          } else if (msg.command === "deleteCollection") {
            const confirmVal = await vscode.window.showWarningMessage(
              `¿Estás seguro de que deseas eliminar la colección '${msg.name}' (${msg.type.toUpperCase()})?`,
              { modal: true },
              "Eliminar"
            );
            if (confirmVal === "Eliminar") {
              const currentCollections = this._loadCollections();
              const updatedCollections = currentCollections.filter(
                (c) => !(c.name === msg.name && c.type === msg.type)
              );
              await HttpTesterPanel.saveCollections(HttpTesterPanel._context, updatedCollections);
              vscode.window.showInformationMessage(`Colección '${msg.name}' eliminada`);
            }
          } else if (msg.command === "clearCollections") {
            const isAll = !msg.type;
            const confirmMsg = isAll 
              ? "¿Estás seguro de que deseas eliminar TODAS las colecciones? Esta acción no se puede deshacer."
              : `¿Estás seguro de que deseas eliminar TODAS las colecciones de tipo ${msg.type.toUpperCase()}? Esta acción no se puede deshacer.`;

            const confirmVal = await vscode.window.showWarningMessage(
              confirmMsg,
              { modal: true },
              "Eliminar Todo"
            );
            if (confirmVal === "Eliminar Todo") {
              const currentCollections = this._loadCollections();
              const updatedCollections = isAll 
                ? [] 
                : currentCollections.filter((c) => c.type !== msg.type);
              await HttpTesterPanel.saveCollections(HttpTesterPanel._context, updatedCollections);
              vscode.window.showInformationMessage(
                isAll ? "Todas las colecciones han sido eliminadas" : `Colecciones de tipo ${msg.type.toUpperCase()} eliminadas`
              );
            }
          } else if (msg.command === "showToast") {
            vscode.window.showInformationMessage(msg.message);
          } else if (msg.command === "saveLastRequest") {
            await HttpTesterPanel._context?.globalState.update(
              HttpTesterPanel.LAST_REQUEST_STORAGE_KEY,
              msg.request
            );
          } else if (msg.command === "saveGlobalToken") {
            this._globalToken = msg.token || "";
            await HttpTesterPanel._context?.globalState.update(
              "httpTester.globalToken",
              this._globalToken
            );
            // Sync all panels
            HttpTesterPanel.panels.forEach((p) => {
              p._globalToken = this._globalToken;
              p._panel.webview.postMessage({
                command: "loadGlobalToken",
                token: this._globalToken,
              });
            });
          } else if (msg.command === "importSwagger") {
            await this._handleImportSwagger(msg.url);
          } else if (msg.command === "detectSwagger") {
            const urls = await this._detectSwaggerUrls();
            if (urls.length === 0) {
              vscode.window.showWarningMessage(
                "No se detectaron URLs de Swagger automáticamente. Intenta ingresar una manualmente."
              );
              webview.postMessage({
                command: "stopLoading",
                panelId: this._id,
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
              panelId: this._id,
            });
          } else if (msg.command.startsWith("socket")) {
            this._handleSocketMessage(msg);
          } else if (msg.command === "getPanelId") {
            // Responder con el ID del panel
            webview.postMessage({
              command: "panelId",
              panelId: this._id,
            });
          }
        } catch (err) {
          webview.postMessage({
            command: "error",
            message: err instanceof Error ? err.message : String(err),
            panelId: this._id,
          });
        }
      },
      null,
      this._disposables
    );
  }

  private async _detectSwaggerUrls(): Promise<string[]> {
    const urls: string[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    for (const folder of workspaceFolders) {
      // 1. Try to find .env files for PORT
      const envFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, "**/.env")
      );
      let port = "3000";
      for (const envFile of envFiles) {
        try {
          const content = fs.readFileSync(envFile.fsPath, "utf8");
          const portMatch = content.match(/^PORT=(\d+)/m);
          if (portMatch) {
            port = portMatch[1];
            break;
          }
        } catch (e) {}
      }

      // 2. Try to find Swagger setup paths
      const swaggerFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, "**/src/**/*.ts")
      );
      let swaggerPath = "api/doc";
      for (const swaggerFile of swaggerFiles) {
        try {
          const content = fs.readFileSync(swaggerFile.fsPath, "utf8");
          const setupMatch = content.match(
            /SwaggerModule\.setup\(\s*["']([^"']+)["']/
          );
          if (setupMatch) {
            swaggerPath = setupMatch[1];
            break;
          }
        } catch (e) {}
      }

      // Add common combinations
      urls.push(`http://localhost:${port}/${swaggerPath}-json`);
      urls.push(`http://localhost:${port}/api-json`);
      urls.push(`http://localhost:${port}/swagger-json`);

      // 3. Search for local Swagger/OpenAPI files
      const localSwaggerFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, "**/{swagger,openapi,api-docs}*.{json,yaml,yml}")
      );
      for (const file of localSwaggerFiles) {
        urls.push(file.fsPath);
      }
    }

    return [...new Set(urls)];
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

      let collections: HttpCollection[];
      try {
        const parsed = JSON.parse(fileContent);

        if (Array.isArray(parsed)) {
          collections = parsed;
        } else {
          collections = [parsed];
        }

        const validCollections = collections.filter((col) => {
          return col.name && col.type && col.url;
        });

        if (validCollections.length === 0) {
          vscode.window.showErrorMessage(
            "El archivo JSON no contiene colecciones válidas."
          );
          return;
        }

        const filteredCollections = validCollections.filter(
          (col) => col.type === type
        );

        if (filteredCollections.length === 0) {
          vscode.window.showWarningMessage(
            `No se encontraron colecciones de tipo "${type}" en el archivo.`
          );
          return;
        }

        this._panel.webview.postMessage({
          command: "importedCollections",
          collections: filteredCollections,
          type: type,
          panelId: this._id,
        });
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

  public static async saveCollections(context: vscode.ExtensionContext, collections: HttpCollection[]) {
    await context.globalState.update(this.COLLECTIONS_STORAGE_KEY, collections);

    // Sync all open panels
    this.panels.forEach((panel) => {
      panel.syncCollections(collections);
    });

    // Refresh Sidebar
    try {
      const { HttpTesterSidebarProvider } = require("./http-tester-sidebar");
      if (HttpTesterSidebarProvider.instance) {
        HttpTesterSidebarProvider.instance.refreshCollections();
      }
    } catch (error) {
      console.error("Error refreshing sidebar:", error);
    }
  }

  private async _saveCollections(collections: HttpCollection[]) {
    if (!HttpTesterPanel._context) {
      console.error("Extension context not available for saving collections");
      return;
    }
    await HttpTesterPanel.saveCollections(HttpTesterPanel._context, collections);
  }

  private _loadCollections(): HttpCollection[] {
    if (!HttpTesterPanel._context) {
      console.error("Extension context not available for loading collections");
      return [];
    }
    const collections = HttpTesterPanel._context.globalState.get<
      HttpCollection[]
    >(HttpTesterPanel.COLLECTIONS_STORAGE_KEY, []);
    return collections;
  }

  private _loadAndSendCollections() {
    const collections = this._loadCollections();
    const lastRequest = HttpTesterPanel._context?.globalState.get<any>(
      HttpTesterPanel.LAST_REQUEST_STORAGE_KEY,
      null
    );

    this._panel.webview.postMessage({
      command: "initializeCollections",
      collections: collections,
      lastRequest: lastRequest,
      panelId: this._id,
    });
  }

  private async _handleExportJson(
    type: "http" | "socket",
    collections: HttpCollection[]
  ) {
    try {
      const filteredCollections = collections.filter(
        (col) => col.type === type
      );

      if (filteredCollections.length === 0) {
        vscode.window.showWarningMessage(
          `No hay colecciones de tipo "${type}" para exportar.`
        );
        return;
      }

      const fileUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${type}-collections.json`),
        filters: {
          "JSON files": ["json"],
        },
      });

      if (!fileUri) {
        return;
      }

      const jsonContent = JSON.stringify(filteredCollections, null, 2);
      fs.writeFileSync(fileUri.fsPath, jsonContent, "utf8");

      vscode.window.showInformationMessage(
        `✅ ${filteredCollections.length} colección(es) exportada(s) exitosamente.`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al exportar JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async _handleImportSwagger(urlOrPath: string) {
    try {
      let openApiJson: any;

      if (urlOrPath.startsWith("http")) {
        const axios = require("axios");
        const response = await axios.get(urlOrPath);
        openApiJson = response.data;
      } else {
        const content = fs.readFileSync(urlOrPath, "utf8");
        if (urlOrPath.endsWith(".yaml") || urlOrPath.endsWith(".yml")) {
          const yaml = require("js-yaml");
          openApiJson = yaml.load(content);
        } else {
          openApiJson = JSON.parse(content);
        }
      }

      const baseUrl = urlOrPath.startsWith("http") 
        ? new URL(urlOrPath).origin 
        : "http://localhost:3000";

      const collections = HttpTesterGenerator.generateCollectionsFromOpenApi(
        openApiJson,
        baseUrl
      );

      if (collections.length === 0) {
        vscode.window.showWarningMessage(
          "No se pudieron generar colecciones desde el JSON de Swagger proporcionado."
        );
        return;
      }

      this._panel.webview.postMessage({
        command: "importedCollections",
        collections: collections,
        type: "http",
        panelId: this._id,
      });

      vscode.window.showInformationMessage(
        `✅ ${collections.length} peticiones importadas desde Swagger.`
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Error al importar Swagger: ${error.message}`
      );
    }
  }

  public dispose() {
    // Remover este panel de la lista
    const index = HttpTesterPanel.panels.indexOf(this);
    if (index > -1) {
      HttpTesterPanel.panels.splice(index, 1);
    }

    this._disconnectSocket();
    this.socketChannel.dispose();
    this.listenChannel.dispose();

    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }

    this._panel.dispose();
  }
}
