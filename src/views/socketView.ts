import * as vscode from "vscode";
import * as path from "path";
import { io, Socket } from "socket.io-client";

interface SocketTesterState {
  url: string;
  token: string;
  userId: string;
  eventName: string;
  payload: string;
}

// Interfaz para Webview con soporte de persistencia (aunque WebviewView lo maneja internamente)
// Esto ayuda a TypeScript a validar getState/setState
interface PersistentWebview extends vscode.Webview {
    getState(): any;
    setState(state: any): void;
}


export class SocketTesterViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "socketTesterView";
  private _view?: vscode.WebviewView;
  private socket?: Socket;
  private channel: vscode.OutputChannel;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.channel = vscode.window.createOutputChannel("Socket Tester Log");
    this.channel.show(true);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const persistentWebview = webviewView.webview as PersistentWebview;

    const savedState = persistentWebview.getState() as
      | SocketTesterState
      | undefined;

    webviewView.webview.html = this._getHtmlForWebview(
      persistentWebview,
      savedState
    );

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "saveState":
          persistentWebview.setState(data.state);
          break;
        case "connect":
          this.connect(data.url, data.token, data.userId);
          break;
        case "disconnect":
          this.disconnect();
          break;
        case "emit":
          this.emitEvent(data.eventName, data.payload);
          break;
      }
    });
  }

  private async connect(
    url: string,
    token: string | undefined,
    userId: string | undefined
  ) {
    this.disconnect();
    this.channel.appendLine(`[Socket] Intentando conectar a: ${url}`);
    this._updateStatus("Connecting...", "connecting");

    this.socket = io(url, {
      transports: ["websocket", "polling"],
      auth: token ? { token: `Bearer ${token}` } : undefined,
    });

    this.socket.on("connect", () => {
      this.channel.appendLine(`[Socket] Conectado: ${this.socket!.id}`);
      this._updateStatus(`Conectado (${this.socket!.id})`, "connected");
      if (userId) {
        this.socket!.emit("join", userId);
        this.channel.appendLine(`[Socket] Se unió al room ${userId}`);
      }
    });

    this.socket.on("disconnect", (reason) => {
      this.channel.appendLine(`[Socket] Desconectado: ${reason}`);
      this._updateStatus("Disconnected", "disconnected");
    });

    this.socket.onAny((event, ...args) => {
      this.channel.appendLine(`[Recibido] ${event}: ${JSON.stringify(args)}`);
    });

    this.socket.on("connect_error", (err) => {
      this.channel.appendLine(`[Error] Falló la conexión: ${err.message}`);
      this._updateStatus("Connection Error", "error");
      this.disconnect();
    });
  }

  private disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
      this.channel.appendLine("[Socket] Desconectado manualmente");
    }
    this._updateStatus("Disconnected", "disconnected");
  }

  private emitEvent(eventName: string, payloadStr: string) {
    if (!this.socket || !this.socket.connected) {
      vscode.window.showWarningMessage("El socket no está conectado.");
      return;
    }

    let payload = {};
    try {
      payload = payloadStr ? JSON.parse(payloadStr) : {};
    } catch (err: any) {
      vscode.window.showErrorMessage(
        "Error parseando JSON del payload: " + err.message
      );
      return;
    }

    this.socket.emit(eventName, payload);
    this.channel.appendLine(
      `[Emitido] ${eventName}: ${JSON.stringify(payload)}`
    );
  }

  // --- Métodos de utilidad ---

  private _updateStatus(
    statusText: string,
    statusClass:
      | "disconnected"
      | "connected"
      | "error"
      | "connecting" = "connecting"
  ) {
    this._view?.webview.postMessage({
      type: "statusUpdate",
      text: statusText,
      class: statusClass,
    });
  }

  // 3. RECIBIR EL ESTADO EN EL HTML GENERATOR
  private _getHtmlForWebview(
    webview: vscode.Webview, // El tipo puede ser Webview aquí, ya que no llama a getState/setState
    savedState?: SocketTesterState
  ): string {
    // Generar URIs para los recursos estáticos
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    const nonce = getNonce();

    // VALORES RESTAURADOS O POR DEFECTO
    const defaultUrl = savedState?.url || "http://localhost:3000";
    const defaultToken = savedState?.token || "";
    const defaultUserId = savedState?.userId || "";
    const defaultEventName = savedState?.eventName || "return:notification";
    const defaultPayload = savedState?.payload || "{\n  \n}";

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Socket Tester</title>
                
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                
                <style>
                    /* Estilos simples en línea para el estado */
                    .status-box { 
                        padding: 4px; 
                        border-radius: 3px; 
                        font-weight: bold; 
                        text-align: center;
                        color: var(--vscode-editor-foreground);
                        margin-bottom: 10px;
                    }
                    .disconnected { background-color: var(--vscode-editorGroupHeader-tabsBackground); }
                    .connected { background-color: var(--vscode-terminal-ansiGreen); color: var(--vscode-editor-background); }
                    .error { background-color: var(--vscode-terminal-ansiRed); color: var(--vscode-editor-background); }
                    .connecting { background-color: var(--vscode-terminal-ansiYellow); color: var(--vscode-editor-background); }
                    
                    /* Estilos para VS Code */
                    input, textarea { 
                        width: 100%; 
                        margin-bottom: 5px; 
                        box-sizing: border-box; 
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        color: var(--vscode-input-foreground);
                    }
                    button { 
                        width: 49%; 
                        margin: 2px 0; 
                        padding: 5px;
                    }
                    .flex-container { display: flex; justify-content: space-between; }
                </style>
            </head>
            <body>
                <h3>Socket Connection</h3>
                <div class="status-box disconnected" id="status">Disconnected</div>
                
                <hr>

                <label for="url">URL:</label>
                <input type="text" id="url" value="${defaultUrl}" placeholder="e.g., http://server.com">

                <label for="token">Token (Bearer):</label>
                <input type="text" id="token" value="${defaultToken}" placeholder="Opcional">
                
                <label for="userId">User ID (Room):</label>
                <input type="text" id="userId" value="${defaultUserId}" placeholder="Opcional">

                <div class="flex-container">
                    <button id="connectBtn">🔌 Conectar</button>
                    <button id="disconnectBtn" disabled>🛑 Desconectar</button>
                </div>
                
                <hr>

                <h3>Emit Event</h3>
                <label for="eventName">Event Name:</label>
                <input type="text" id="eventName" value="${defaultEventName}">

                <label for="payload">Payload (JSON):</label>
                <textarea id="payload" rows="3" placeholder='{"key": "value"}'>${defaultPayload}</textarea>
                
                <button id="emitBtn" style="width: 100%;" disabled>📤 Emitir</button>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    const statusDiv = document.getElementById('status');
                    const connectBtn = document.getElementById('connectBtn');
                    const disconnectBtn = document.getElementById('disconnectBtn');
                    const emitBtn = document.getElementById('emitBtn');

                    // Elementos de entrada
                    const urlInput = document.getElementById('url');
                    const tokenInput = document.getElementById('token');
                    const userIdInput = document.getElementById('userId');
                    const eventNameInput = document.getElementById('eventName');
                    const payloadInput = document.getElementById('payload');


                    // 4. FUNCIÓN PARA GUARDAR EL ESTADO
                    function saveState() {
                        const state = {
                            url: urlInput.value,
                            token: tokenInput.value,
                            userId: userIdInput.value,
                            eventName: eventNameInput.value,
                            payload: payloadInput.value
                        };
                        vscode.postMessage({ type: 'saveState', state: state });
                    }

                    // 5. ADJUNTAR LA FUNCIÓN saveState A LOS CAMBIOS
                    urlInput.onchange = saveState;
                    tokenInput.onchange = saveState;
                    userIdInput.onchange = saveState;
                    eventNameInput.onchange = saveState;
                    payloadInput.onchange = saveState;

                    // Habilita/Deshabilita botones según el estado
                    function updateButtons(state) {
                        const isConnected = state === 'connected';
                        connectBtn.disabled = isConnected;
                        disconnectBtn.disabled = !isConnected;
                        emitBtn.disabled = !isConnected;
                    }

                    // Oyente de mensajes desde la extensión (para actualizar el estado)
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'statusUpdate') {
                            statusDiv.textContent = message.text;
                            statusDiv.className = 'status-box ' + message.class;
                            updateButtons(message.class);
                        }
                    });

                    connectBtn.onclick = () => {
                        saveState(); 
                        vscode.postMessage({
                            type: 'connect',
                            url: urlInput.value,
                            token: tokenInput.value,
                            userId: userIdInput.value
                        });
                    };

                    disconnectBtn.onclick = () => {
                        vscode.postMessage({ type: 'disconnect' });
                    };

                    emitBtn.onclick = () => {
                        saveState();
                        vscode.postMessage({
                            type: 'emit',
                            eventName: eventNameInput.value,
                            payload: payloadInput.value
                        });
                    };
                </script>
            </body>
            </html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}