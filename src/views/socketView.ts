import * as vscode from "vscode";
import * as path from "path";
import { io, Socket } from "socket.io-client";

interface SocketTesterState {
  url: string;
  token: string;
  userId: string;
  eventName: string;
  payload: string;
  activeTab: string;
}

export class SocketTesterViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "socketTesterView";
  private _view?: vscode.WebviewView;
  private socket?: Socket;
  private channel: vscode.OutputChannel;

  // Estado persistente en la extensión
  private _state: SocketTesterState = {
    url: "http://localhost:3000",
    token: "",
    userId: "",
    eventName: "return:notification",
    payload: "{\n  \n}",
    activeTab: "emit",
  };

  private _lastStatus: { text: string; class: string } = {
    text: "Disconnected",
    class: "disconnected",
  };

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

    // Usar el estado guardado en la clase
    webviewView.webview.html = this._getHtmlForWebview(
      webviewView.webview,
      this._state
    );

    // Restaurar estado visual si ya está conectado
    if (this.socket && this.socket.connected) {
      this._updateStatus(this._lastStatus.text, this._lastStatus.class as any);
    }

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "saveState":
          this._state = { ...this._state, ...data.state };
          break;
        case "connect":
          this._state.url = data.url;
          this._state.token = data.token;
          this._state.userId = data.userId;
          this.connect(data.url, data.token, data.userId);
          break;
        case "disconnect":
          this.disconnect();
          break;
        case "emit":
          this._state.eventName = data.eventName;
          this._state.payload = data.payload;
          this.emitEvent(data.eventName, data.payload);
          break;
        case "clearLogs":
          // No action needed on backend, logs are client-side mostly
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
      this._logToWebview(`Connected to ${url}`, "success");
      if (userId) {
        this.socket!.emit("join", userId);
        this.channel.appendLine(`[Socket] Se unió al room ${userId}`);
        this._logToWebview(`Joined room: ${userId}`, "info");
      }
    });

    this.socket.on("disconnect", (reason) => {
      this.channel.appendLine(`[Socket] Desconectado: ${reason}`);
      this._updateStatus("Disconnected", "disconnected");
      this._logToWebview(`Disconnected: ${reason}`, "error");
    });

    this.socket.onAny((event, ...args) => {
      this.channel.appendLine(`[Recibido] ${event}: ${JSON.stringify(args)}`);
      this._logToWebview(
        `Received '${event}': ${JSON.stringify(args)}`,
        "info"
      );
    });

    this.socket.on("connect_error", (err) => {
      this.channel.appendLine(`[Error] Falló la conexión: ${err.message}`);
      this._updateStatus("Connection Error", "error");
      this._logToWebview(`Connection Error: ${err.message}`, "error");
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
      this._logToWebview("Cannot emit: Socket not connected", "warning");
      return;
    }

    let payload = {};
    try {
      payload = payloadStr ? JSON.parse(payloadStr) : {};
    } catch (err: any) {
      vscode.window.showErrorMessage(
        "Error parseando JSON del payload: " + err.message
      );
      this._logToWebview(`JSON Parse Error: ${err.message}`, "error");
      return;
    }

    this.socket.emit(eventName, payload);
    this.channel.appendLine(
      `[Emitido] ${eventName}: ${JSON.stringify(payload)}`
    );
    this._logToWebview(`Emitted '${eventName}'`, "success");
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
    this._lastStatus = { text: statusText, class: statusClass };
    this._view?.webview.postMessage({
      type: "statusUpdate",
      text: statusText,
      class: statusClass,
    });
  }

  private _logToWebview(
    message: string,
    type: "info" | "success" | "error" | "warning" = "info"
  ) {
    this._view?.webview.postMessage({
      type: "log",
      message: message,
      logType: type,
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
    const activeTab = savedState?.activeTab || "emit";

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Socket Tester</title>
                
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                
                <style>
                    :root {
                        --container-padding: 10px;
                        --input-padding: 6px;
                        --border-radius: 4px;
                    }

                    body {
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        overflow: hidden;
                    }

                    /* Top Bar: URL & Connect */
                    .top-bar {
                        padding: var(--container-padding);
                        background-color: var(--vscode-editor-background);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        display: flex;
                        gap: 8px;
                        align-items: center;
                    }

                    .url-input-group {
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .url-input-group label {
                        font-size: 10px;
                        margin-bottom: 2px;
                        color: var(--vscode-descriptionForeground);
                    }

                    .action-buttons {
                        display: flex;
                        gap: 5px;
                        margin-top: 14px; /* Align with input */
                    }

                    /* Status Bar */
                    .status-bar {
                        padding: 4px 10px;
                        font-size: 11px;
                        font-weight: bold;
                        text-align: center;
                        color: var(--vscode-editor-background);
                    }
                    .disconnected { background-color: var(--vscode-statusBarItem-errorBackground); }
                    .connected { background-color: var(--vscode-statusBarItem-warningBackground); color: var(--vscode-statusBarItem-warningForeground); } /* Postman uses orange/yellow for active sometimes, or green */
                    .connected { background-color: #198754; color: white; } /* Bootstrap Success Green */
                    .error { background-color: var(--vscode-errorForeground); color: white; }
                    .connecting { background-color: var(--vscode-progressBar-background); }

                    /* Tabs */
                    .tabs {
                        display: flex;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-sideBar-background);
                    }

                    .tab {
                        padding: 8px 16px;
                        cursor: pointer;
                        border-bottom: 2px solid transparent;
                        opacity: 0.7;
                    }

                    .tab:hover {
                        opacity: 1;
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .tab.active {
                        border-bottom-color: var(--vscode-panelTitle-activeBorder);
                        opacity: 1;
                        font-weight: bold;
                    }

                    /* Tab Content */
                    .tab-content {
                        padding: var(--container-padding);
                        flex-grow: 0;
                        overflow-y: auto;
                        display: none;
                    }
                    .tab-content.active {
                        display: block;
                    }

                    /* Inputs */
                    input, textarea {
                        width: 100%;
                        padding: var(--input-padding);
                        margin-bottom: 10px;
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        color: var(--vscode-input-foreground);
                        border-radius: var(--border-radius);
                    }
                    
                    label {
                        display: block;
                        margin-bottom: 4px;
                        font-weight: 600;
                        font-size: 12px;
                    }

                    button {
                        padding: 6px 12px;
                        border: none;
                        border-radius: var(--border-radius);
                        cursor: pointer;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    
                    button.secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }

                    /* Logs Console */
                    .logs-container {
                        flex-grow: 1;
                        border-top: 1px solid var(--vscode-panel-border);
                        display: flex;
                        flex-direction: column;
                        min-height: 150px;
                    }

                    .logs-header {
                        padding: 4px 10px;
                        background-color: var(--vscode-panel-background);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        font-size: 11px;
                        font-weight: bold;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .logs-content {
                        flex-grow: 1;
                        overflow-y: auto;
                        padding: 5px;
                        font-family: 'Consolas', 'Monaco', monospace;
                        font-size: 11px;
                        background-color: var(--vscode-editor-background);
                    }

                    .log-entry {
                        margin-bottom: 4px;
                        padding: 2px 4px;
                        border-bottom: 1px solid var(--vscode-tree-indentGuidesStroke);
                    }
                    .log-info { color: var(--vscode-textPreformat-foreground); }
                    .log-success { color: var(--vscode-testing-iconPassed); }
                    .log-error { color: var(--vscode-testing-iconFailed); }
                    .log-warning { color: var(--vscode-testing-iconQueued); }

                </style>
            </head>
            <body>
                
                <!-- Top Bar -->
                <div class="top-bar">
                    <div class="url-input-group">
                        <label>Server URL</label>
                        <input type="text" id="url" value="${defaultUrl}" placeholder="http://localhost:3000">
                    </div>
                    <div class="action-buttons">
                        <button id="connectBtn">Connect</button>
                        <button id="disconnectBtn" class="secondary" disabled>Disconnect</button>
                    </div>
                </div>

                <!-- Status Bar -->
                <div class="status-bar ${this._lastStatus.class}" id="status">${
      this._lastStatus.text
    }</div>

                <!-- Tabs -->
                <div class="tabs">
                    <div class="tab ${
                      activeTab === "emit" ? "active" : ""
                    }" data-target="emit-tab">Emit</div>
                    <div class="tab ${
                      activeTab === "settings" ? "active" : ""
                    }" data-target="settings-tab">Settings</div>
                </div>

                <!-- Tab Content: Emit -->
                <div id="emit-tab" class="tab-content ${
                  activeTab === "emit" ? "active" : ""
                }">
                    <label>Event Name</label>
                    <input type="text" id="eventName" value="${defaultEventName}" placeholder="e.g. message">
                    
                    <label>Payload (JSON)</label>
                    <textarea id="payload" rows="5" placeholder='{"key": "value"}'>${defaultPayload}</textarea>
                    
                    <button id="emitBtn" style="width: 100%;" disabled>Send Event</button>
                </div>

                <!-- Tab Content: Settings -->
                <div id="settings-tab" class="tab-content ${
                  activeTab === "settings" ? "active" : ""
                }">
                    <label>Auth Token (Bearer)</label>
                    <input type="text" id="token" value="${defaultToken}" placeholder="Optional">
                    
                    <label>User ID (Room)</label>
                    <input type="text" id="userId" value="${defaultUserId}" placeholder="Optional">
                </div>

                <!-- Logs -->
                <div class="logs-container">
                    <div class="logs-header">
                        <span>Console</span>
                        <button id="clearLogsBtn" style="padding: 2px 6px; font-size: 10px;">Clear</button>
                    </div>
                    <div class="logs-content" id="logs">
                        <!-- Logs will appear here -->
                    </div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    // Elements
                    const statusDiv = document.getElementById('status');
                    const connectBtn = document.getElementById('connectBtn');
                    const disconnectBtn = document.getElementById('disconnectBtn');
                    const emitBtn = document.getElementById('emitBtn');
                    const clearLogsBtn = document.getElementById('clearLogsBtn');
                    const logsDiv = document.getElementById('logs');
                    
                    const urlInput = document.getElementById('url');
                    const tokenInput = document.getElementById('token');
                    const userIdInput = document.getElementById('userId');
                    const eventNameInput = document.getElementById('eventName');
                    const payloadInput = document.getElementById('payload');
                    
                    const tabs = document.querySelectorAll('.tab');
                    const tabContents = document.querySelectorAll('.tab-content');

                    let currentTab = '${activeTab}';

                    // --- State Management ---
                    function saveState() {
                        const state = {
                            url: urlInput.value,
                            token: tokenInput.value,
                            userId: userIdInput.value,
                            eventName: eventNameInput.value,
                            payload: payloadInput.value,
                            activeTab: currentTab
                        };
                        vscode.postMessage({ type: 'saveState', state: state });
                        vscode.setState(state);
                    }

                    // Attach saveState to inputs
                    [urlInput, tokenInput, userIdInput, eventNameInput, payloadInput].forEach(el => {
                        el.onchange = saveState;
                    });

                    // --- Tab Switching ---
                    tabs.forEach(tab => {
                        tab.addEventListener('click', () => {
                            // Remove active class
                            tabs.forEach(t => t.classList.remove('active'));
                            tabContents.forEach(c => c.classList.remove('active'));
                            
                            // Add active class
                            tab.classList.add('active');
                            const targetId = tab.getAttribute('data-target');
                            document.getElementById(targetId).classList.add('active');
                            
                            // Update state
                            currentTab = targetId === 'emit-tab' ? 'emit' : 'settings';
                            saveState();
                        });
                    });

                    // --- UI Updates ---
                    function updateButtons(state) {
                        const isConnected = state === 'connected';
                        connectBtn.disabled = isConnected;
                        disconnectBtn.disabled = !isConnected;
                        emitBtn.disabled = !isConnected;
                    }

                    function addLog(message, type) {
                        const entry = document.createElement('div');
                        entry.className = 'log-entry log-' + type;
                        const time = new Date().toLocaleTimeString();
                        entry.textContent = '[' + time + '] ' + message;
                        logsDiv.appendChild(entry);
                        logsDiv.scrollTop = logsDiv.scrollHeight;
                    }

                    // Initialize
                    const initialClass = statusDiv.className.split(' ').pop();
                    updateButtons(initialClass);

                    // --- Event Listeners ---
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

                    clearLogsBtn.onclick = () => {
                        logsDiv.innerHTML = '';
                        vscode.postMessage({ type: 'clearLogs' });
                    };

                    // --- Message Handling ---
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'statusUpdate') {
                            statusDiv.textContent = message.text;
                            statusDiv.className = 'status-bar ' + message.class;
                            updateButtons(message.class);
                        } else if (message.type === 'log') {
                            addLog(message.message, message.logType);
                        }
                    });

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
