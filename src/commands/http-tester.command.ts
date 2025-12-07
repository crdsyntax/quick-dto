import * as vscode from 'vscode';
import { HttpTesterPanel } from '../views/http-tester.view';


export async function openHttpTesterCommand(context: vscode.ExtensionContext) {
    try {
        HttpTesterPanel.createOrShow(context.extensionUri);
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error opening HTTP Tester: ${error.message}`);
        return false;
    }
}


export async function closeHttpTesterCommand() {
    HttpTesterPanel.currentPanel?.dispose();
    return true;
}