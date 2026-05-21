import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { EntityFolderItem } from "../EntityFolderItem/EntityFolderItem";
import { EntityItem } from "../EntityItem/EntityItem";
import { EntityRelation, EntityRelationType } from "../types";

type TreeElement = EntityItem | EntityFolderItem;

const ENTITY_EXTENSIONS = [".entity.ts", ".schema.ts"] as const;
const PRISMA_SCHEMA_FILE = "schema.prisma";

export class EntityTreeDataProvider implements vscode.TreeDataProvider<TreeElement> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<
    TreeElement | undefined | null | void
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterQuery = "";
  private readonly checkedIds = new Set<string>();
  private readonly idToFilePath = new Map<string, string>();

  private _workspaceRoot: string | undefined;

  constructor(workspaceRoot: string | undefined) {
    this._workspaceRoot = workspaceRoot;
  }

  get workspaceRoot(): string | undefined {
    return this._workspaceRoot;
  }

  setWorkspaceRoot(root: string | undefined): void {
    if (this._workspaceRoot !== root) {
      this._workspaceRoot = root;
      this.checkedIds.clear();
      this.idToFilePath.clear();
      this.refresh();
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  filter(query: string): void {
    this.filterQuery = query.trim().toLowerCase();
    this.refresh();
  }

  setChecked(
    id: string,
    filePath: string,
    state: vscode.TreeItemCheckboxState,
  ): void {
    if (state === vscode.TreeItemCheckboxState.Checked) {
      this.checkedIds.add(id);
      this.idToFilePath.set(id, filePath);
    } else {
      this.checkedIds.delete(id);
      this.idToFilePath.delete(id);
    }
  }

  getCheckedItems(): string[] {
    const uniquePaths = new Set<string>();
    this.checkedIds.forEach((id) => {
      const filePath = this.idToFilePath.get(id);
      if (filePath) {
        uniquePaths.add(filePath);
      }
    });
    return Array.from(uniquePaths);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    if (element instanceof EntityItem) {
      element.checkboxState = this.checkedIds.has(element.id)
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
    }
    return element;
  }

  async getChildren(element?: TreeElement): Promise<TreeElement[]> {
    if (!this.workspaceRoot) {
      return [];
    }

    const srcPath = path.join(this.workspaceRoot, "src");

    if (!element) {
      const moduleFolders = await this.getModuleFolders(srcPath);
      const prismaSchemaPath = this.getPrismaSchemaPath(this.workspaceRoot);

      if (prismaSchemaPath) {
        const prismaFolder = new EntityFolderItem(
          "Prisma Models",
          prismaSchemaPath,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        prismaFolder.iconPath = new vscode.ThemeIcon("database");
        prismaFolder.contextValue = "prismaFolder";

        return [prismaFolder, ...moduleFolders];
      }

      return moduleFolders;
    }

    if (element instanceof EntityFolderItem) {
      if (element.contextValue === "prismaFolder") {
        return this.getPrismaModels(element.folderPath);
      }
      return this.getEntitiesInFolder(element.folderPath);
    }

    if (element instanceof EntityItem) {
      return this.getRelatedEntities(element);
    }

    return [];
  }

  private getPrismaSchemaPath(root: string): string | null {
    const result = findPrismaSchema(root);
    if (!result) return null;
    if (Array.isArray(result)) {
      return path.dirname(result[0]);
    }
    return result;
  }

  private async getPrismaModels(schemaPath: string): Promise<EntityItem[]> {
    try {
      const stats = fs.lstatSync(schemaPath);
      const filesToRead: string[] = [];

      if (stats.isDirectory()) {
        const files = fs.readdirSync(schemaPath);
        filesToRead.push(...files.filter(f => f.endsWith(".prisma")).map(f => path.join(schemaPath, f)));
      } else {
        filesToRead.push(schemaPath);
      }

      const models: EntityItem[] = [];
      const modelRegex = /^model\s+(\w+)/gim;

      for (const filePath of filesToRead) {
        const content = fs.readFileSync(filePath, "utf8");
        let match: RegExpExecArray | null;

        while ((match = modelRegex.exec(content)) !== null) {
          models.push(
            this.createEntityItem(filePath, undefined, match[1])
          );
        }
      }

      return this.filterQuery
        ? models.filter((item) => item.label.toLowerCase().includes(this.filterQuery))
        : models;
    } catch {
      return [];
    }
  }

  private async getModuleFolders(srcPath: string): Promise<EntityFolderItem[]> {
    if (!fs.existsSync(srcPath)) {
      return [];
    }

    const directoryEntries = fs.readdirSync(srcPath, { withFileTypes: true });
    const folders = directoryEntries
      .filter((entry) => entry.isDirectory())
      .map(
        (entry) =>
          new EntityFolderItem(
            entry.name,
            path.join(srcPath, entry.name),
            vscode.TreeItemCollapsibleState.Collapsed,
          ),
      );

    return this.filterQuery
      ? folders.filter((folder) => folder.label.toLowerCase().includes(this.filterQuery))
      : folders;
  }

  private async getEntitiesInFolder(folderPath: string): Promise<EntityItem[]> {
    const entityPattern = new vscode.RelativePattern(folderPath, "**/*.entity.ts");
    const schemaPattern = new vscode.RelativePattern(folderPath, "**/*.schema.ts");

    const entityFiles = await vscode.workspace.findFiles(entityPattern);
    const schemaFiles = await vscode.workspace.findFiles(schemaPattern);

    const items = [...entityFiles, ...schemaFiles].map((file) => {
      return this.createEntityItem(file.fsPath);
    });

    return this.filterQuery
      ? items.filter((item) => item.label.toLowerCase().includes(this.filterQuery))
      : items;
  }

  private createEntityItem(
    filePath: string,
    parent?: EntityItem,
    labelOverride?: string,
  ): EntityItem {
    const label = labelOverride ?? this.extractEntityName(filePath);
    const collapsibleState = this.hasRelations(filePath, label)
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    return new EntityItem(label, filePath, collapsibleState, parent);
  }

  private extractEntityName(filePath: string): string {
    for (const extension of ENTITY_EXTENSIONS) {
      if (filePath.endsWith(extension)) {
        return path.basename(filePath, extension);
      }
    }

    if (filePath.endsWith(".prisma")) {
      return path.basename(filePath, ".prisma");
    }

    return path.basename(filePath, ".ts");
  }

  private hasRelations(filePath: string, entityName?: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, "utf8");
    if (filePath.endsWith(".prisma")) {
      // For prisma, we check if the specific model has relations
      const modelRegex = new RegExp(`model\\s+${entityName}\\s+{[^}]*}`, "ims");
      const modelMatch = content.match(modelRegex);
      if (modelMatch) {
        return /@relation/.test(modelMatch[0]) || (entityName ? this.parsePrismaRelations(modelMatch[0]).length > 0 : false);
      }
      return /@relation/.test(content);
    }

    return (
      /@(ManyToOne|OneToMany|OneToOne|ManyToMany)/.test(content) ||
      /ref:\s*['"]\w+['"]/.test(content)
    );
  }

  private async getRelatedEntities(item: EntityItem): Promise<EntityItem[]> {
    if (!fs.existsSync(item.filePath)) {
      return [];
    }

    const content = fs.readFileSync(item.filePath, "utf8");
    const relations = this.parseRelations(content, item.filePath, item.label);
    const relatedItems: EntityItem[] = [];

    for (const relation of relations) {
      const filePath = await this.findEntityFile(
        relation.targetEntity,
        item.filePath,
        content,
      );

      if (!filePath) {
        continue;
      }

      const label = relation.propertyName
        ? `${relation.propertyName}: ${relation.targetEntity}`
        : relation.targetEntity;
      const relatedItem = this.createEntityItem(filePath, item, label);

      relatedItems.push(relatedItem);
    }

    return relatedItems;
  }

  private parseRelations(content: string, filePath: string, entityName?: string): EntityRelation[] {
    const relations: EntityRelation[] = [];
    
    if (filePath.endsWith(".prisma")) {
      const modelRegex = new RegExp(`model\\s+${entityName}\\s+{[^}]*}`, "ims");
      const modelMatch = content.match(modelRegex);
      if (modelMatch) {
        relations.push(...this.parsePrismaRelations(modelMatch[0]));
      }
    } else {
      relations.push(...this.parseTypeOrmRelations(content));
      relations.push(...this.parseMongooseRelations(content));
    }

    return relations.filter((relation, index) =>
      relations.findIndex(
        (candidate) =>
          candidate.targetEntity === relation.targetEntity &&
          candidate.propertyName === relation.propertyName,
      ) === index,
    );
  }

  private parsePrismaRelations(content: string): EntityRelation[] {
    const relations: EntityRelation[] = [];
    const scalarTypes = ["String", "Boolean", "Int", "BigInt", "Float", "Decimal", "DateTime", "Json", "Bytes", "Unsupported"];
    
    // Match fields: name Type or name Type[]
    const fieldRegex = /^\s*(\w+)\s+(\w+)(\[\])?/gm;
    let match: RegExpExecArray | null;
    
    while ((match = fieldRegex.exec(content)) !== null) {
      const propertyName = match[1];
      const targetEntity = match[2];
      const isArray = !!match[3];

      if (!scalarTypes.includes(targetEntity) && targetEntity !== "model") {
        relations.push({
          type: isArray ? "OneToMany" : "ManyToOne",
          targetEntity,
          propertyName,
        });
      }
    }
    return relations;
  }

  private parseTypeOrmRelations(content: string): EntityRelation[] {
    const relationRegex = /@(ManyToOne|OneToMany|OneToOne|ManyToMany)\s*\(\s*\(\s*\)\s*=>\s*([\w]+)/g;
    const relations: EntityRelation[] = [];
    let match: RegExpExecArray | null;

    while ((match = relationRegex.exec(content)) !== null) {
      const type = match[1];
      const targetEntity = match[2];
      const searchArea = content.slice(match.index + match[0].length, match.index + match[0].length + 120);
      const propertyNameMatch = searchArea.match(/^\s*\)?\s*(\w+)\s*[:?]/m);
      const propertyName = propertyNameMatch ? propertyNameMatch[1] : "";

      relations.push({ type, targetEntity, propertyName });
    }

    return relations;
  }

  private parseMongooseRelations(content: string): EntityRelation[] {
    const relations: EntityRelation[] = [];
    const mongooseRegex = /ref:\s*['"](\w+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = mongooseRegex.exec(content)) !== null) {
      relations.push({ type: "Ref", targetEntity: match[1], propertyName: "" });
    }

    return relations;
  }

  private async findEntityFile(
    targetEntity: string,
    sourceFilePath: string,
    sourceFileContent: string,
  ): Promise<string | undefined> {
    // 1. Check imports for TS entities/schemas
    const importRegex = new RegExp(
      `import\\s+{[^}]*${targetEntity}[^}]*}\\s+from\\s+['"](.*)['"]`,
      "i",
    );
    const match = sourceFileContent.match(importRegex);

    if (match) {
      const importPath = match[1];
      if (importPath.startsWith(".")) {
        const absoluteImportPath = path.resolve(path.dirname(sourceFilePath), importPath);
        const extensions = [".ts", ".entity.ts", ".schema.ts", "/index.ts", ""] as const;

        for (const extension of extensions) {
          const candidate = absoluteImportPath + extension;
          if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) {
            return candidate;
          }
        }
      }
    }

    // 2. If source is a prisma file, look in the same directory/schema
    if (sourceFilePath.endsWith(".prisma")) {
      const schemaDir = path.dirname(sourceFilePath);
      if (fs.existsSync(schemaDir) && fs.lstatSync(schemaDir).isDirectory()) {
        const files = fs.readdirSync(schemaDir);
        for (const file of files) {
          if (file.endsWith(".prisma")) {
            const filePath = path.join(schemaDir, file);
            const content = fs.readFileSync(filePath, "utf8");
            if (new RegExp(`^model\\s+${targetEntity}\\b`, "im").test(content)) {
              return filePath;
            }
          }
        }
      }
    }

    // 3. Fallback to glob search
    const searchPatterns = [
      `**/src/**/${targetEntity.toLowerCase()}.entity.ts`,
      `**/src/**/${targetEntity.toLowerCase()}.schema.ts`,
      `**/src/**/${targetEntity}.entity.ts`,
      `**/src/**/${targetEntity}.schema.ts`,
      `**/prisma/**/${targetEntity}.prisma`,
      `**/prisma/**/${targetEntity.toLowerCase()}.prisma`,
      `**/${targetEntity}.prisma`,
    ];

    for (const pattern of searchPatterns) {
      const files = await vscode.workspace.findFiles(pattern);
      if (files.length > 0) {
        return files[0].fsPath;
      }
    }

    // 4. Deep search in all prisma files if still not found
    const allPrismaFiles = await vscode.workspace.findFiles("**/*.prisma");
    for (const file of allPrismaFiles) {
      try {
        const content = fs.readFileSync(file.fsPath, "utf8");
        if (new RegExp(`^model\\s+${targetEntity}\\b`, "im").test(content)) {
          return file.fsPath;
        }
      } catch (e) {
        // skip unreadable
      }
    }

    return undefined;
  }

}
