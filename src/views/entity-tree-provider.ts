import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class EntityTreeDataProvider
  implements vscode.TreeDataProvider<EntityItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    EntityItem | undefined | null | void
  > = new vscode.EventEmitter<EntityItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    EntityItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private filterQuery: string = "";

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  filter(query: string): void {
    this.filterQuery = query.toLowerCase();
    this.refresh();
  }

  getTreeItem(element: EntityItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: EntityItem): Thenable<EntityItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No entity in empty workspace");
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve([]);
    } else {
      const entitiesPath = path.join(this.workspaceRoot, "src");
      if (this.pathExists(entitiesPath)) {
        return this.getEntitiesInSrc(entitiesPath);
      } else {
        vscode.window.showInformationMessage("Workspace has no src folder");
        return Promise.resolve([]);
      }
    }
  }

  private async getEntitiesInSrc(srcPath: string): Promise<EntityItem[]> {
    const entityPattern = new vscode.RelativePattern(srcPath, "**/*.entity.ts");
    const schemaPattern = new vscode.RelativePattern(srcPath, "**/*.schema.ts");

    const entityFiles = await vscode.workspace.findFiles(entityPattern);
    const schemaFiles = await vscode.workspace.findFiles(schemaPattern);

    const allFiles = [...entityFiles, ...schemaFiles];

    const items = allFiles.map((file) => {
      const isEntity = file.fsPath.endsWith(".entity.ts");
      const extensionToRemove = isEntity ? ".entity.ts" : ".schema.ts";

      const name = path.basename(file.fsPath, extensionToRemove);

      return new EntityItem(
        name,
        file.fsPath,
        vscode.TreeItemCollapsibleState.None
      );
    });

    if (!this.filterQuery) {
      return items;
    }

    return items.filter((item) =>
      item.label.toLowerCase().includes(this.filterQuery)
    );
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
      return true;
    } catch (err) {
      return false;
    }
  }
}

export class EntityItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.description = path.relative(vscode.workspace.rootPath || "", filePath);

    this.command = {
      command: "nest-tools.viewEntityErd",
      title: "View ER Diagram",
      arguments: [this],
    };

    this.iconPath = new vscode.ThemeIcon("symbol-class");
  }
}
