import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class EntityTreeDataProvider
  implements vscode.TreeDataProvider<EntityItem | EntityFolderItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    EntityItem | EntityFolderItem | undefined | null | void
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterQuery: string = "";

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  filter(query: string): void {
    this.filterQuery = query.toLowerCase();
    this.refresh();
  }

  getTreeItem(element: EntityItem | EntityFolderItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: EntityItem | EntityFolderItem
  ): Promise<(EntityItem | EntityFolderItem)[]> {
    if (!this.workspaceRoot) return [];

    const srcPath = path.join(this.workspaceRoot, "src");

    if (!element) {
      return this.getModuleFolders(srcPath);
    }

    if (element instanceof EntityFolderItem) {
      return this.getEntitiesInFolder(element.folderPath);
    }

    return [];
  }

  private async getModuleFolders(srcPath: string): Promise<EntityFolderItem[]> {
    const dirs = fs
      .readdirSync(srcPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map(
        (dir) =>
          new EntityFolderItem(
            dir.name,
            path.join(srcPath, dir.name),
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );

    if (!this.filterQuery) return dirs;

    return dirs.filter((d) =>
      d.label.toLowerCase().includes(this.filterQuery)
    );
  }

  private async getEntitiesInFolder(folderPath: string): Promise<EntityItem[]> {
    const entityPattern = new vscode.RelativePattern(
      folderPath,
      "**/*.entity.ts"
    );
    const schemaPattern = new vscode.RelativePattern(
      folderPath,
      "**/*.schema.ts"
    );

    const files = [
      ...(await vscode.workspace.findFiles(entityPattern)),
      ...(await vscode.workspace.findFiles(schemaPattern)),
    ];

    let items = files.map((file) => {
      const base = file.fsPath.endsWith(".entity.ts")
        ? path.basename(file.fsPath, ".entity.ts")
        : path.basename(file.fsPath, ".schema.ts");

      return new EntityItem(
        base,
        file.fsPath,
        vscode.TreeItemCollapsibleState.None
      );
    });

    if (!this.filterQuery) return items;

    return items.filter((i) =>
      i.label.toLowerCase().includes(this.filterQuery)
    );
  }
}

export class EntityFolderItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly folderPath: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.iconPath = new vscode.ThemeIcon("folder-library");
  }
}

export class EntityItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.description = path.basename(filePath);
    this.tooltip = filePath;

    this.command = {
      command: "nest-tools.viewEntityErd",
      title: "View ER Diagram",
      arguments: [this],
    };

    this.iconPath = new vscode.ThemeIcon("symbol-class");
  }
}

