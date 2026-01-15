import * as vscode from "vscode";
import * as fs from "fs";
import { TransferEngine } from "../logic/transfer-engine";
import { TransferConfig, TransferProgress } from "../types/database-types";

export class CopyPanel {
  public static currentPanel: CopyPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _engine = new TransferEngine();

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtmlForWebview();
    this._setWebviewMessageListener(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    const column = vscode.ViewColumn.One;

    if (CopyPanel.currentPanel) {
      CopyPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "databaseCopy",
      "Database Migration Tool",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    CopyPanel.currentPanel = new CopyPanel(panel, extensionUri);
  }

  private _getHtmlForWebview(): string {
    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "database-migrator.html"
    );

    if (fs.existsSync(htmlPath.fsPath)) {
      let html = fs.readFileSync(htmlPath.fsPath, "utf8");
      const rootUri = this._panel.webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "media")
      );
      html = html.replace(/{{root}}/g, rootUri.toString());
      return html;
    }

    // Fallback inline HTML
    return this._getInlineHtml();
  }

  private _getInlineHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Database Migration Tool</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
          }
          .container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          .column {
            background: var(--vscode-input-background);
            padding: 15px;
            border-radius: 5px;
            border: 1px solid var(--vscode-input-border);
          }
          .column h2 {
            margin-top: 0;
            color: var(--vscode-textLink-activeForeground);
          }
          .form-group {
            margin-bottom: 15px;
          }
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
          }
          .form-group input, .form-group select {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
          }
          .form-group input[type="checkbox"] {
            width: auto;
            margin-right: 5px;
          }
          .form-group input[type="password"] {
            font-family: monospace;
          }
          .ssh-section {
            border-top: 1px solid var(--vscode-input-border);
            padding-top: 15px;
            margin-top: 15px;
          }
          .global-section {
            background: var(--vscode-input-background);
            padding: 15px;
            border-radius: 5px;
            border: 1px solid var(--vscode-input-border);
            margin-bottom: 20px;
          }
          .actions {
            text-align: center;
          }
          button {
            padding: 10px 30px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .progress-section {
            margin-top: 20px;
            display: none;
          }
          .progress-section.active {
            display: block;
          }
          .progress-item {
            padding: 10px;
            margin-bottom: 5px;
            background: var(--vscode-input-background);
            border-radius: 3px;
            border-left: 3px solid var(--vscode-progressBar-background);
          }
          .progress-item.completed {
            border-left-color: #4CAF50;
          }
          .progress-item.error {
            border-left-color: #f44336;
          }
          .info-box {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-activeForeground);
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 3px;
          }
        </style>
      </head>
      <body>
        <h1>🗄️ Universal Database Migration Tool</h1>
        
        <div class="info-box">
          <strong>Universal Schema Support:</strong> This tool works with ANY MySQL table.
          Specify a table name and record ID, and the tool will automatically discover
          and copy all related child records based on foreign key relationships.
        </div>

        <div class="global-section">
          <h2>Record Configuration</h2>
          <div class="form-group">
            <label for="tableName">Table Name</label>
            <input type="text" id="tableName" placeholder="e.g., Reserva, users, orders">
          </div>
          <div class="form-group">
            <label for="recordId">Record ID</label>
            <input type="text" id="recordId" placeholder="e.g., 123">
          </div>
          <div class="form-group">
            <label for="maxDepth">Max FK Depth (optional)</label>
            <input type="number" id="maxDepth" value="10" min="1" max="20">
          </div>
        </div>

        <div class="container">
          <!-- Source Database -->
          <div class="column">
            <h2>Source Database</h2>
            <div class="form-group">
              <label for="sourceHost">Host</label>
              <input type="text" id="sourceHost" value="localhost">
            </div>
            <div class="form-group">
              <label for="sourcePort">Port</label>
              <input type="number" id="sourcePort" value="3306">
            </div>
            <div class="form-group">
              <label for="sourceUser">User</label>
              <input type="text" id="sourceUser" value="root">
            </div>
            <div class="form-group">
              <label for="sourcePassword">Password</label>
              <input type="password" id="sourcePassword">
            </div>
            <div class="form-group">
              <label for="sourceDatabase">Database</label>
              <input type="text" id="sourceDatabase">
            </div>
            
            <div class="ssh-section">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="sourceSshEnabled"> Enable SSH Tunnel
                </label>
              </div>
              <div id="sourceSshConfig" style="display: none;">
                <div class="form-group">
                  <label for="sourceSshHost">SSH Host</label>
                  <input type="text" id="sourceSshHost">
                </div>
                <div class="form-group">
                  <label for="sourceSshPort">SSH Port</label>
                  <input type="number" id="sourceSshPort" value="22">
                </div>
                <div class="form-group">
                  <label for="sourceSshUser">SSH Username</label>
                  <input type="text" id="sourceSshUser">
                </div>
                <div class="form-group">
                  <label for="sourceSshKey">Private Key Path</label>
                  <input type="text" id="sourceSshKey" placeholder="C:\\Users\\user\\.ssh\\id_rsa">
                </div>
                <div class="form-group">
                  <label for="sourceSshPassphrase">Passphrase (optional)</label>
                  <input type="password" id="sourceSshPassphrase">
                </div>
              </div>
            </div>
          </div>

          <!-- Target Database -->
          <div class="column">
            <h2>Target Database</h2>
            <div class="form-group">
              <label for="targetHost">Host</label>
              <input type="text" id="targetHost" value="localhost">
            </div>
            <div class="form-group">
              <label for="targetPort">Port</label>
              <input type="number" id="targetPort" value="3306">
            </div>
            <div class="form-group">
              <label for="targetUser">User</label>
              <input type="text" id="targetUser" value="root">
            </div>
            <div class="form-group">
              <label for="targetPassword">Password</label>
              <input type="password" id="targetPassword">
            </div>
            <div class="form-group">
              <label for="targetDatabase">Database</label>
              <input type="text" id="targetDatabase">
            </div>
            
            <div class="ssh-section">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="targetSshEnabled"> Enable SSH Tunnel
                </label>
              </div>
              <div id="targetSshConfig" style="display: none;">
                <div class="form-group">
                  <label for="targetSshHost">SSH Host</label>
                  <input type="text" id="targetSshHost">
                </div>
                <div class="form-group">
                  <label for="targetSshPort">SSH Port</label>
                  <input type="number" id="targetSshPort" value="22">
                </div>
                <div class="form-group">
                  <label for="targetSshUser">SSH Username</label>
                  <input type="text" id="targetSshUser">
                </div>
                <div class="form-group">
                  <label for="targetSshKey">Private Key Path</label>
                  <input type="text" id="targetSshKey" placeholder="C:\\Users\\user\\.ssh\\id_rsa">
                </div>
                <div class="form-group">
                  <label for="targetSshPassphrase">Passphrase (optional)</label>
                  <input type="password" id="targetSshPassphrase">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button id="startTransfer">🚀 Start Transfer</button>
        </div>

        <div class="progress-section" id="progressSection">
          <h2>Transfer Progress</h2>
          <div id="progressContainer"></div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          // Toggle SSH configuration visibility
          document.getElementById('sourceSshEnabled').addEventListener('change', (e) => {
            document.getElementById('sourceSshConfig').style.display = e.target.checked ? 'block' : 'none';
          });

          document.getElementById('targetSshEnabled').addEventListener('change', (e) => {
            document.getElementById('targetSshConfig').style.display = e.target.checked ? 'block' : 'none';
          });

          // Start transfer
          document.getElementById('startTransfer').addEventListener('click', () => {
            const config = {
              source: {
                database: {
                  host: document.getElementById('sourceHost').value,
                  port: parseInt(document.getElementById('sourcePort').value),
                  user: document.getElementById('sourceUser').value,
                  password: document.getElementById('sourcePassword').value,
                  database: document.getElementById('sourceDatabase').value,
                },
                ssh: document.getElementById('sourceSshEnabled').checked ? {
                  enabled: true,
                  host: document.getElementById('sourceSshHost').value,
                  port: parseInt(document.getElementById('sourceSshPort').value),
                  username: document.getElementById('sourceSshUser').value,
                  privateKeyPath: document.getElementById('sourceSshKey').value,
                  passphrase: document.getElementById('sourceSshPassphrase').value || undefined,
                } : { enabled: false }
              },
              target: {
                database: {
                  host: document.getElementById('targetHost').value,
                  port: parseInt(document.getElementById('targetPort').value),
                  user: document.getElementById('targetUser').value,
                  password: document.getElementById('targetPassword').value,
                  database: document.getElementById('targetDatabase').value,
                },
                ssh: document.getElementById('targetSshEnabled').checked ? {
                  enabled: true,
                  host: document.getElementById('targetSshHost').value,
                  port: parseInt(document.getElementById('targetSshPort').value),
                  username: document.getElementById('targetSshUser').value,
                  privateKeyPath: document.getElementById('targetSshKey').value,
                  passphrase: document.getElementById('targetSshPassphrase').value || undefined,
                } : { enabled: false }
              },
              tableName: document.getElementById('tableName').value,
              recordId: document.getElementById('recordId').value,
              maxDepth: parseInt(document.getElementById('maxDepth').value),
            };

            vscode.postMessage({
              command: 'startTransfer',
              config: config
            });

            document.getElementById('progressSection').classList.add('active');
            document.getElementById('progressContainer').innerHTML = '';
          });

          // Listen for progress updates
          window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.command) {
              case 'progress':
                updateProgress(message.progress);
                break;
              case 'complete':
                showComplete();
                break;
              case 'error':
                showError(message.error);
                break;
            }
          });

          function updateProgress(progress) {
            const container = document.getElementById('progressContainer');
            let item = document.getElementById('progress-' + progress.tableName);
            
            if (!item) {
              item = document.createElement('div');
              item.id = 'progress-' + progress.tableName;
              item.className = 'progress-item';
              container.appendChild(item);
            }

            item.className = 'progress-item ' + progress.status;
            item.innerHTML = \`
              <strong>\${progress.tableName}</strong>: \${progress.recordsTransferred} / \${progress.totalRecords}
              \${progress.error ? '<br><span style="color: #f44336;">' + progress.error + '</span>' : ''}
            \`;
          }

          function showComplete() {
            const container = document.getElementById('progressContainer');
            const summary = document.createElement('div');
            summary.className = 'info-box';
            summary.innerHTML = '<strong>✅ Transfer Completed Successfully!</strong>';
            container.appendChild(summary);
          }

          function showError(error) {
            const container = document.getElementById('progressContainer');
            const errorBox = document.createElement('div');
            errorBox.className = 'progress-item error';
            errorBox.innerHTML = '<strong>❌ Error:</strong> ' + error;
            container.appendChild(errorBox);
          }
        </script>
      </body>
      </html>
    `;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "startTransfer":
            await this.startTransfer(message.config);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private async startTransfer(config: TransferConfig) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Copying ${config.tableName} record ${config.recordId}`,
        cancellable: false,
      },
      async (progress) => {
        try {
          this._engine.setProgressCallback((transferProgress) => {
            progress.report({
              message: `${transferProgress.tableName}: ${transferProgress.recordsTransferred}/${transferProgress.totalRecords}`,
            });

            this._panel.webview.postMessage({
              command: "progress",
              progress: transferProgress,
            });
          });

          await this._engine.transfer(config);

          this._panel.webview.postMessage({
            command: "complete",
          });

          vscode.window.showInformationMessage(
            `✅ Successfully copied ${config.tableName} record!`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          this._panel.webview.postMessage({
            command: "error",
            error: errorMessage,
          });

          vscode.window.showErrorMessage(`❌ Transfer failed: ${errorMessage}`);
        }
      }
    );
  }

  public dispose() {
    CopyPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
