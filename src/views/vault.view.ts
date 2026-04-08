import * as vscode from "vscode";
import * as fs from "fs";
import { VAULT_STORAGE_KEY } from "../commands/vault-notes.command";

interface VaultNotes {
  [key: string]: string[];
}

export class VaultViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "vaultNotesView";

  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    this._setWebviewMessageListener(webviewView.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "vault-view.html",
    );
    let html = fs.readFileSync(htmlPath.fsPath, "utf8");

    const rootUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media"),
    );

    html = html.replace(/{{root}}/g, rootUri.toString());
    return html;
  }

  private _getVaultNotes(): VaultNotes {
    const stored = this._context.globalState.get<VaultNotes>(
      VAULT_STORAGE_KEY,
      {},
    );
    return stored ?? {};
  }

  private async _updateVaultNotes(vault: VaultNotes) {
    await this._context.globalState.update(VAULT_STORAGE_KEY, vault);
  }

  private _postVaultState(selectedKey?: string) {
    if (!this._view) {
      return;
    }

    const vault = this._getVaultNotes();
    const keys = Object.keys(vault).sort();

    const keyToUse =
      selectedKey && keys.includes(selectedKey)
        ? selectedKey
        : keys.length > 0
          ? keys[0]
          : "";

    const notes = keyToUse ? vault[keyToUse] ?? [] : [];

    this._view.webview.postMessage({
      command: "vaultState",
      keys,
      selectedKey: keyToUse,
      notes,
    });
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (msg) => {
        try {
          const vault = this._getVaultNotes();

          switch (msg.command) {
            case "ready": {
              this._postVaultState();
              break;
            }
            case "loadVault": {
              const key = (msg.key as string | undefined)?.trim() ?? "";
              this._postVaultState(key || undefined);
              break;
            }
            case "addNote": {
              const rawKey = (msg.key as string | undefined) ?? "";
              const note = (msg.note as string | undefined) ?? "";
              const key = rawKey.trim();

              if (!key || !note.trim()) {
                vscode.window.showWarningMessage(
                  "La clave y la anotación no pueden estar vacías.",
                );
                return;
              }

              const notes = vault[key] ?? [];
              notes.push(note);
              vault[key] = notes;
              await this._updateVaultNotes(vault);
              vscode.window.showInformationMessage(
                `Anotación guardada en el baúl "${key}".`,
              );
              this._postVaultState(key);
              break;
            }
            case "deleteNote": {
              const rawKey = (msg.key as string | undefined) ?? "";
              const key = rawKey.trim();
              const index = Number(msg.index);

              if (!key || !Number.isInteger(index)) {
                return;
              }

              const notes = vault[key] ?? [];
              if (index < 0 || index >= notes.length) {
                return;
              }

              notes.splice(index, 1);
              if (notes.length === 0) {
                delete vault[key];
              } else {
                vault[key] = notes;
              }

              await this._updateVaultNotes(vault);
              this._postVaultState(key);
              break;
            }
            case "deleteVault": {
              const rawKey = (msg.key as string | undefined) ?? "";
              const key = rawKey.trim();
              if (!key) {
                return;
              }

              const existingNotes = vault[key];
              if (!existingNotes) {
                return;
              }

              const answer = await vscode.window.showWarningMessage(
                `¿Eliminar todas las anotaciones del baúl "${key}"?`,
                { modal: true },
                "Eliminar",
              );
              if (answer !== "Eliminar") {
                return;
              }

              delete vault[key];
              await this._updateVaultNotes(vault);
              vscode.window.showInformationMessage(
                `Baúl "${key}" eliminado correctamente.`,
              );
              this._postVaultState();
              break;
            }
          }
        } catch (err: any) {
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

  public dispose() {
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }
}

