import * as vscode from "vscode";
import { DtoSidebarManager } from "../hooks/dto-sidebar.manager";
import { DtoHtmlGenerator } from "../utils/dto-html-generator.util";
import { WebviewMessage } from "../types/dto-sidebar.types";

export class DtoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "nest-tools.dtoPropertiesView";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = DtoHtmlGenerator.generate();

    webviewView.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      await DtoSidebarManager.handleMessage(msg);
    });
  }
}

export default DtoSidebarProvider;
