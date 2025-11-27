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
    const pattern = new vscode.RelativePattern(srcPath, "**/*.entity.ts");
    const files = await vscode.workspace.findFiles(pattern);

    const items = files.map((file) => {
      const name = path.basename(file.fsPath, ".entity.ts");
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
