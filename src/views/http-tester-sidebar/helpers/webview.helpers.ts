import * as fs from "fs";
import * as vscode from "vscode";

export function loadSidebarHtml(extensionUri: vscode.Uri, webview: vscode.Webview): string {
  const htmlPath = vscode.Uri.joinPath(
    extensionUri,
    "media",
    "http-tester-sidebar.html"
  );

  const html = fs.readFileSync(htmlPath.fsPath, "utf8");
  const rootUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media")
  );

  return html.replace(/{{root}}/g, rootUri.toString());
}
