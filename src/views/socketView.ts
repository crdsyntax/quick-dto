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
    webview: vscode.Webview,
    savedState?: SocketTesterState
  ): string {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    const nonce = getNonce();

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
                        --container-padding: 16px;
                        --input-padding: 8px;
                        --border-radius: 6px;
                        --bg-secondary: var(--vscode-sideBar-background);
                        --border-color: var(--vscode-panel-border);
                    }

                    body {
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        font-family: var(--vscode-font-family);
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }

                    /* Header Section */
                    .header {
                        padding: var(--container-padding);
                        background-color: var(--bg-secondary);
                        border-bottom: 1px solid var(--border-color);
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }

                    .connection-group {
                        display: flex;
                        gap: 8px;
                        align-items: flex-end;
                    }

                    .input-wrapper {
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }

                    label {
                        font-size: 11px;
                        font-weight: 600;
                        color: var(--vscode-descriptionForeground);
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    input, textarea {
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        color: var(--vscode-input-foreground);
                        border-radius: var(--border-radius);
                        padding: var(--input-padding);
                        font-family: 'Consolas', 'Monaco', monospace;
                        font-size: 13px;
                    }

                    input:focus, textarea:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                        border-color: var(--vscode-focusBorder);
                    }

                    /* Buttons */
                    .btn-group {
                        display: flex;
                        gap: 8px;
                    }

                    button {
                        padding: 8px 16px;
                        border: none;
                        border-radius: var(--border-radius);
                        cursor: pointer;
                        font-weight: 500;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        transition: all 0.2s;
                    }

                    .btn-primary {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .btn-primary:hover { background-color: var(--vscode-button-hoverBackground); }

                    .btn-secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    .btn-secondary:hover { background-color: var(--vscode-button-secondaryHoverBackground); }

                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    /* Status Bar */
                    .status-bar {
                        padding: 6px 12px;
                        font-size: 11px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        border-bottom: 1px solid var(--border-color);
                    }
                    
                    .status-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background-color: var(--vscode-disabledForeground);
                    }
                    
                    .status-connected .status-dot { background-color: #4CAF50; box-shadow: 0 0 4px #4CAF50; }
                    .status-disconnected .status-dot { background-color: var(--vscode-errorForeground); }
                    .status-connecting .status-dot { background-color: var(--vscode-progressBar-background); animation: pulse 1s infinite; }

                    @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }

                    /* Tabs */
                    .tabs {
                        display: flex;
                        background-color: var(--bg-secondary);
                        border-bottom: 1px solid var(--border-color);
                        padding: 0 16px;
                    }

                    .tab {
                        padding: 10px 16px;
                        cursor: pointer;
                        font-size: 12px;
                        color: var(--vscode-foreground);
                        opacity: 0.7;
                        border-bottom: 2px solid transparent;
                        transition: all 0.2s;
                    }

                    .tab:hover { opacity: 1; background-color: var(--vscode-list-hoverBackground); }
                    
                    .tab.active {
                        opacity: 1;
                        border-bottom-color: var(--vscode-panelTitle-activeBorder);
                        color: var(--vscode-panelTitle-activeForeground);
                    }

                    /* Content Area */
                    .content {
                        flex-grow: 1;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }

                    .tab-pane {
                        display: none;
                        padding: var(--container-padding);
                        overflow-y: auto;
                        flex-grow: 1;
                    }
                    .tab-pane.active { display: flex; flex-direction: column; gap: 16px; }

                    /* Logs */
                    .logs-section {
                        height: 200px;
                        border-top: 1px solid var(--border-color);
                        display: flex;
                        flex-direction: column;
                        background-color: var(--vscode-editor-background);
                    }

                    .logs-header {
                        padding: 8px 16px;
                        background-color: var(--bg-secondary);
                        border-bottom: 1px solid var(--border-color);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                    }

                    .logs-container {
                        flex-grow: 1;
                        overflow-y: auto;
                        padding: 8px;
                        font-family: 'Consolas', 'Monaco', monospace;
                        font-size: 12px;
                    }

                    .log-entry {
                        padding: 4px 8px;
                        border-bottom: 1px solid var(--vscode-tree-indentGuidesStroke);
                        word-break: break-all;
                    }
                    .log-time { color: var(--vscode-descriptionForeground); margin-right: 8px; }
                    .log-info { color: var(--vscode-textPreformat-foreground); }
                    .log-success { color: #4CAF50; }
                    .log-error { color: #F44336; }
                    .log-warning { color: #FFC107; }

                </style>
            </head>
            <body>
                
                <div class="header">
                    <div class="connection-group">
                        <div class="input-wrapper" style="flex: 3;">
                            <label>Server URL</label>
                            <input type="text" id="url" value="${defaultUrl}" placeholder="http://localhost:3000">
                        </div>
                        <div class="btn-group">
                            <button id="connectBtn" class="btn-primary">Connect</button>
                            <button id="disconnectBtn" class="btn-secondary" disabled>Disconnect</button>
                        </div>
                    </div>
                </div>

                <div class="status-bar status-disconnected" id="statusBar">
                    <div class="status-dot"></div>
                    <span id="statusText">Disconnected</span>
                </div>

                <div class="tabs">
                    <div class="tab ${
                      activeTab === "emit" ? "active" : ""
                    }" data-target="emit">Emit Event</div>
                    <div class="tab ${
                      activeTab === "settings" ? "active" : ""
                    }" data-target="settings">Settings</div>
                </div>

                <div class="content">
                    <!-- Emit Tab -->
                    <div id="emit" class="tab-pane ${
                      activeTab === "emit" ? "active" : ""
                    }">
                        <div class="input-wrapper">
                            <label>Event Name</label>
                            <input type="text" id="eventName" value="${defaultEventName}" placeholder="e.g. message">
                        </div>
                        
                        <div class="input-wrapper" style="flex-grow: 1;">
                            <label>Payload (JSON)</label>
                            <textarea id="payload" style="flex-grow: 1; resize: none;" placeholder='{"key": "value"}'>${defaultPayload}</textarea>
                        </div>
                        
                        <button id="emitBtn" class="btn-primary" style="width: 100%;" disabled>Send Event</button>
                    </div>

                    <!-- Settings Tab -->
                    <div id="settings" class="tab-pane ${
                      activeTab === "settings" ? "active" : ""
                    }">
                        <div class="input-wrapper">
                            <label>Auth Token (Bearer)</label>
                            <input type="text" id="token" value="${defaultToken}" placeholder="Optional">
                        </div>
                        
                        <div class="input-wrapper">
                            <label>User ID (Room)</label>
                            <input type="text" id="userId" value="${defaultUserId}" placeholder="Optional">
                        </div>
                    </div>
                </div>

                <div class="logs-section">
                    <div class="logs-header">
                        <span>Event Log</span>
                        <button id="clearLogsBtn" class="btn-secondary" style="padding: 2px 8px; font-size: 10px;">Clear</button>
                    </div>
                    <div class="logs-container" id="logs"></div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    // Elements
                    const els = {
                        url: document.getElementById('url'),
                        token: document.getElementById('token'),
                        userId: document.getElementById('userId'),
                        eventName: document.getElementById('eventName'),
                        payload: document.getElementById('payload'),
                        connectBtn: document.getElementById('connectBtn'),
                        disconnectBtn: document.getElementById('disconnectBtn'),
                        emitBtn: document.getElementById('emitBtn'),
                        clearLogsBtn: document.getElementById('clearLogsBtn'),
                        logs: document.getElementById('logs'),
                        statusBar: document.getElementById('statusBar'),
                        statusText: document.getElementById('statusText'),
                        tabs: document.querySelectorAll('.tab'),
                        panes: document.querySelectorAll('.tab-pane')
                    };

                    let currentTab = '${activeTab}';

                    // --- Error Handling ---
                    window.onerror = function(message, source, lineno, colno, error) {
                        console.error('Webview Error:', message);
                        vscode.postMessage({ type: 'log', message: 'Webview Error: ' + message, logType: 'error' });
                    };

                    // --- State Management ---
                    function saveState() {
                        const state = {
                            url: els.url.value,
                            token: els.token.value,
                            userId: els.userId.value,
                            eventName: els.eventName.value,
                            payload: els.payload.value,
                            activeTab: currentTab
                        };
                        vscode.postMessage({ type: 'saveState', state });
                        vscode.setState(state);
                    }

                    ['change', 'input'].forEach(evt => {
                        [els.url, els.token, els.userId, els.eventName, els.payload].forEach(el => {
                            el.addEventListener(evt, saveState);
                        });
                    });

                    // --- Tabs ---
                    els.tabs.forEach(tab => {
                        tab.addEventListener('click', () => {
                            els.tabs.forEach(t => t.classList.remove('active'));
                            els.panes.forEach(p => p.classList.remove('active'));
                            
                            tab.classList.add('active');
                            const target = tab.dataset.target;
                            document.getElementById(target).classList.add('active');
                            
                            currentTab = target;
                            saveState();
                        });
                    });

                    // --- Actions ---
                    els.connectBtn.onclick = () => {
                        saveState();
                        vscode.postMessage({
                            type: 'connect',
                            url: els.url.value,
                            token: els.token.value,
                            userId: els.userId.value
                        });
                    };

                    els.disconnectBtn.onclick = () => vscode.postMessage({ type: 'disconnect' });

                    els.emitBtn.onclick = () => {
                        saveState();
                        vscode.postMessage({
                            type: 'emit',
                            eventName: els.eventName.value,
                            payload: els.payload.value
                        });
                    };

                    els.clearLogsBtn.onclick = () => {
                        els.logs.innerHTML = '';
                        vscode.postMessage({ type: 'clearLogs' });
                    };

                    // --- Updates ---
                    function updateStatus(text, className) {
                        els.statusText.textContent = text;
                        els.statusBar.className = 'status-bar status-' + className;
                        
                        const isConnected = className === 'connected';
                        els.connectBtn.disabled = isConnected;
                        els.disconnectBtn.disabled = !isConnected;
                        els.emitBtn.disabled = !isConnected;
                    }

                    function addLog(msg, type) {
                        const div = document.createElement('div');
                        div.className = \`log-entry log-\${type}\`;
                        const time = new Date().toLocaleTimeString();
                        div.innerHTML = \`<span class="log-time">[\${time}]\</span>\${msg}\`;
                        els.logs.appendChild(div);
                        els.logs.scrollTop = els.logs.scrollHeight;
                    }

                    // --- Message Handler ---
                    window.addEventListener('message', event => {
                        const msg = event.data;
                        switch (msg.type) {
                            case 'statusUpdate':
                                updateStatus(msg.text, msg.class);
                                break;
                            case 'log':
                                addLog(msg.message, msg.logType);
                                break;
                        }
                    });

                    // Init
                    const initialStatusClass = '${this._lastStatus.class}';
                    updateStatus('${
                      this._lastStatus.text
                    }', initialStatusClass);

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
