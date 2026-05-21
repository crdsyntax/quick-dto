import * as vscode from "vscode";

export class EntityFolderItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly folderPath: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.iconPath = new vscode.ThemeIcon("folder-library");
  }
}
