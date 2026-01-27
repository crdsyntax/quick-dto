import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class EntityTreeDataProvider implements vscode.TreeDataProvider<
  EntityItem | EntityFolderItem
> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    EntityItem | EntityFolderItem | undefined | null | void
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterQuery: string = "";

  private checkedIds: Set<string> = new Set();
  private idToFilePath: Map<string, string> = new Map();

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  filter(query: string): void {
    this.filterQuery = query.toLowerCase();
    this.refresh();
  }

  setChecked(
    id: string,
    filePath: string,
    state: vscode.TreeItemCheckboxState,
  ) {
    if (state === vscode.TreeItemCheckboxState.Checked) {
      this.checkedIds.add(id);
      this.idToFilePath.set(id, filePath);
    } else {
      this.checkedIds.delete(id);
      this.idToFilePath.delete(id);
    }
  }

  getCheckedItems(): string[] {
    const paths = new Set<string>();
    this.checkedIds.forEach((id) => {
      const path = this.idToFilePath.get(id);
      if (path) paths.add(path);
    });
    return Array.from(paths);
  }

  getTreeItem(element: EntityItem | EntityFolderItem): vscode.TreeItem {
    if (element instanceof EntityItem) {
      element.checkboxState =
        element.id && this.checkedIds.has(element.id)
          ? vscode.TreeItemCheckboxState.Checked
          : vscode.TreeItemCheckboxState.Unchecked;
    }
    return element;
  }

  async getChildren(
    element?: EntityItem | EntityFolderItem,
  ): Promise<(EntityItem | EntityFolderItem)[]> {
    if (!this.workspaceRoot) return [];

    const srcPath = path.join(this.workspaceRoot, "src");

    if (!element) {
      return this.getModuleFolders(srcPath);
    }

    if (element instanceof EntityFolderItem) {
      return this.getEntitiesInFolder(element.folderPath);
    }

    if (element instanceof EntityItem) {
      return this.getRelatedEntities(element);
    }

    return [];
  }

  private async getModuleFolders(srcPath: string): Promise<EntityFolderItem[]> {
    if (!fs.existsSync(srcPath)) return [];

    const dirs = fs
      .readdirSync(srcPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map(
        (dir) =>
          new EntityFolderItem(
            dir.name,
            path.join(srcPath, dir.name),
            vscode.TreeItemCollapsibleState.Collapsed,
          ),
      );

    if (!this.filterQuery) return dirs;

    return dirs.filter((d) => d.label.toLowerCase().includes(this.filterQuery));
  }

  private async getEntitiesInFolder(folderPath: string): Promise<EntityItem[]> {
    const entityPattern = new vscode.RelativePattern(
      folderPath,
      "**/*.entity.ts",
    );
    const schemaPattern = new vscode.RelativePattern(
      folderPath,
      "**/*.schema.ts",
    );

    const files = [
      ...(await vscode.workspace.findFiles(entityPattern)),
      ...(await vscode.workspace.findFiles(schemaPattern)),
    ];

    let items = files.map((file) => {
      const base = file.fsPath.endsWith(".entity.ts")
        ? path.basename(file.fsPath, ".entity.ts")
        : path.basename(file.fsPath, ".schema.ts");

      const hasRels = this.hasRelations(file.fsPath);

      return new EntityItem(
        base,
        file.fsPath,
        hasRels
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      );
    });

    if (!this.filterQuery) return items;

    return items.filter((i) =>
      i.label.toLowerCase().includes(this.filterQuery),
    );
  }

  private hasRelations(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const content = fs.readFileSync(filePath, "utf8");
      return (
        /@(ManyToOne|OneToMany|OneToOne|ManyToMany)/.test(content) ||
        /ref:\s*['"]\w+['"]/.test(content)
      );
    } catch {
      return false;
    }
  }

  private async getRelatedEntities(item: EntityItem): Promise<EntityItem[]> {
    try {
      const content = fs.readFileSync(item.filePath, "utf8");
      const relations: {
        type: string;
        targetEntity: string;
        propertyName: string;
      }[] = [];

      // TypeORM relations: @ManyToOne(() => User, ...)
      const relRegex =
        /@(ManyToOne|OneToMany|OneToOne|ManyToMany)\s*\(\s*\(\s*\)\s*=>\s*([\w]+)/g;
      let match;
      while ((match = relRegex.exec(content)) !== null) {
        const type = match[1];
        const targetEntity = match[2];

        const nextLines = content.substring(
          match.index + match[0].length,
          match.index + match[0].length + 100,
        );
        const propertyNameMatch = nextLines.match(/^\s*\)?\s*(\w+)\s*[:?]/);
        const propertyName = propertyNameMatch ? propertyNameMatch[1] : "";

        if (
          targetEntity &&
          !relations.some(
            (r) =>
              r.targetEntity === targetEntity &&
              r.propertyName === propertyName,
          )
        ) {
          relations.push({ type, targetEntity, propertyName });
        }
      }

      // Mongoose: ref: 'User'
      const mongooseRegex = /ref:\s*['"](\w+)['"]/g;
      while ((match = mongooseRegex.exec(content)) !== null) {
        const targetEntity = match[1];
        if (
          targetEntity &&
          !relations.some((r) => r.targetEntity === targetEntity)
        ) {
          relations.push({ type: "Ref", targetEntity, propertyName: "" });
        }
      }

      const relatedItems: EntityItem[] = [];
      for (const rel of relations) {
        let filePath = await this.findEntityFile(
          rel.targetEntity,
          item.filePath,
          content,
        );

        if (filePath) {
          const label = rel.propertyName
            ? `${rel.propertyName}: ${rel.targetEntity}`
            : rel.targetEntity;
          const hasRels = this.hasRelations(filePath);
          const relatedItem = new EntityItem(
            label,
            filePath,
            hasRels
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            item,
          );
          relatedItem.description = rel.type;
          relatedItems.push(relatedItem);
        }
      }
      return relatedItems;
    } catch (err) {
      return [];
    }
  }

  private async findEntityFile(
    targetEntity: string,
    sourceFilePath: string,
    content: string,
  ): Promise<string | undefined> {
    const importRegex = new RegExp(
      `import\\s+{[^}]*${targetEntity}[^}]*}\\s+from\\s+['"](.*)['"]`,
      "i",
    );
    const match = content.match(importRegex);
    if (match) {
      const importPath = match[1];
      if (importPath.startsWith(".")) {
        const absolutePath = path.resolve(
          path.dirname(sourceFilePath),
          importPath,
        );
        const extensions = [".ts", ".entity.ts", ".schema.ts", "/index.ts", ""];
        for (const ext of extensions) {
          const fullPath = absolutePath + ext;
          if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
            return fullPath;
          }
        }
      }
    }

    const patterns = [
      `**/src/**/${targetEntity.toLowerCase()}.entity.ts`,
      `**/src/**/${targetEntity.toLowerCase()}.schema.ts`,
      `**/src/**/${targetEntity}.entity.ts`,
      `**/src/**/${targetEntity}.schema.ts`,
    ];

    for (const pattern of patterns) {
      const files = await vscode.workspace.findFiles(pattern);
      if (files.length > 0) {
        return files[0].fsPath;
      }
    }
    return undefined;
  }
}

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

export class EntityItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly parent?: EntityItem,
  ) {
    super(label, collapsibleState);
    this.description = path.basename(filePath);
    this.tooltip = filePath;

    if (parent && parent.id) {
      this.id = `${parent.id}::${label}`;
    } else {
      this.id = filePath;
    }

    this.contextValue = "entityItem";
    this.iconPath = new vscode.ThemeIcon("symbol-class");
  }
}
