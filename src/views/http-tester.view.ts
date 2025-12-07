import * as vscode from "vscode";
import * as fs from "fs";
import { io, Socket } from "socket.io-client"; // Importación para Socket.IO
import { HttpCollection, HttpTesterGenerator } from "../generators/http-tester.generator";

// Interfaz para el estado del Socket Tester
interface SocketTesterState {
  url: string;
  token: string;
  userId: string;
  eventName: string;
  payload: string;
}

export class HttpTesterPanel {
  public static currentPanel: HttpTesterPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _generator = HttpTesterGenerator.getInstance();

  // Propiedades de Socket.IO
  private socket?: Socket;
  private socketChannel: vscode.OutputChannel; // Canal de salida para logs del socket
  private _socketState: SocketTesterState = {
    // Estado inicial del socket
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

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtmlForWebview();
    this._setWebviewMessageListener(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Inicializar el canal de salida del socket
    this.socketChannel = vscode.window.createOutputChannel("Socket Tester Log");
    this.socketChannel.show(true);
  }

  public loadCollections(collections: HttpCollection[]) {
    if (this._panel) {
      this._panel.webview.postMessage({
        command: "loadCollections",
        collections: collections,
      });
    }
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    if (HttpTesterPanel.currentPanel) {
      HttpTesterPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "httpTester",
      "API Tester", // Título general para el panel combinado
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    HttpTesterPanel.currentPanel = new HttpTesterPanel(panel, extensionUri);
  }

  private _getHtmlForWebview(): string {
    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "http-tester.html"
    );
    let html = fs.readFileSync(htmlPath.fsPath, "utf8");

    const rootUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media")
    );

    html = html.replace(/{{root}}/g, rootUri.toString());

    return html;
  }

  // --- Lógica de Socket.IO Helper Methods ---

  private _postSocketLog(
    message: string,
    type: "info" | "error" | "event" = "info"
  ) {
    // Enviar log al Webview
    this._panel.webview.postMessage({ command: "socketLog", message, type });
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
    });
    this.socketChannel.appendLine(`[STATUS] ${status}`);
  }

  // --- Lógica de Conexión Socket.IO ---

  private _connectSocket(state: SocketTesterState) {
    this._disconnectSocket(); // Limpieza previa

    this._updateSocketStatus("Connecting", "connecting");

    // Conexión con opciones de autenticación y query
    this.socket = io(state.url, {
      transports: ["websocket", "polling"],
      auth: state.token ? { token: `Bearer ${state.token}` } : undefined,
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
      this._panel.webview.postMessage({
        command: "error",
        message: "Socket is not connected.",
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
      });
    }
  }

  private _handleSocketMessage(msg: any) {
    const { command, data } = msg;

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
        // Solo necesitamos el nombre del evento y el payload para emitir
        this._emitEvent(data);
        break;
      case "socketGetInitialState":
        // Envía el estado inicial y el último estatus al abrir la pestaña
        this._panel.webview.postMessage({
          command: "socketInitialState",
          state: this._socketState,
          status: this._lastSocketStatus,
        });
        break;
    }
  }

  // --- Manejo de mensajes del Webview (Combinado) ---

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (msg) => {
        try {
          if (msg.command === "sendRequest") {
            // Lógica HTTP
            const result = await this._generator.sendRequest(msg.request);
            webview.postMessage({ command: "response", response: result });
          } else if (msg.command.startsWith("socket")) {
            // Lógica de Socket.IO
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

  public dispose() {
    HttpTesterPanel.currentPanel = undefined;

    this._disconnectSocket(); // Asegurar el cierre del socket al cerrar el panel
    this.socketChannel.dispose(); // Disponer el canal de salida

    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }

    this._panel.dispose();
  }
}
