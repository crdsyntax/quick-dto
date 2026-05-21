import * as path from "path";
import * as vscode from "vscode";

export class EntityItem extends vscode.TreeItem {
  public readonly id: string;

  constructor(
    public label: string,
    public readonly filePath: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly parent?: EntityItem,
  ) {
    super(label, collapsibleState);
    this.description = path.basename(filePath);
    this.tooltip = filePath;
    this.id = parent?.id ? `${parent.id}::${label}` : filePath;
    this.contextValue = "entityItem";
    this.iconPath = new vscode.ThemeIcon("symbol-class");
  }
}
