import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { generateDtoCommand } from "./commands/dto.command";
import { generateInterfaceCommand } from "./commands/interface.command";
import { generateReturnInterfaceCommand } from "./commands/return-interface.command";
import { generateRepositoryCommand } from "./commands/repository.command";
import { generateServiceCommand } from "./commands/service.command";
import { generateControllerCommand } from "./commands/controller.command";
import { generateCrudCommand } from "./commands/crud.command";
import { completeReturnType } from "./autocomplete/functionReturn";
import { generateControllerEndpoint } from "./commands/controller-by-function.command";
import { registerDiagramCommand } from "./commands/diagram.command";
import { EntityCommand } from "./commands/entity.command";
import { OrmConverter } from "./commands/convert.command";
import { MongooseToTypeOrmMigrator } from "./commands/migration.command";
import { generateErdCommand } from "./commands/erd-generator.command";
import {
  EntityTreeDataProvider,
  EntityItem,
} from "./views/entity-tree-provider";
import { EntityVisualizer } from "./views/erd-visualizer";
import { SocketTesterViewProvider } from "./views/socketView";
import { DtoSidebarProvider } from "./views/dto-sidebar.view";
import {
  closeHttpTesterCommand,
  openHttpTesterCommand,
} from "./commands/http-tester.command";
import { HttpTesterSidebarProvider } from "./views/http-tester-sidebar";
import { addLoggerDebugCommand } from "./commands/logger.command";
import { createAutoCommitService } from "./commands/auto-commit.command";
import { generateCollectionsFromControllerCommand } from "./commands/generate-collection.command";
import { HttpTesterPanel } from "./views/http-tester.view";
import { handleCreateProject } from "./commands/project-tools.command";
import { openFlowchartEditorCommand } from "./commands/flowchart.command";

const ENTITY_VIEW_FOLDER_KEY = "entityView.selectedFolder";

function getInitialEntityViewRoot(context: vscode.ExtensionContext): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  if (folders.length === 1) return folders[0].uri.fsPath;

  const stored = context.workspaceState.get<string>(ENTITY_VIEW_FOLDER_KEY);
  if (stored && folders.some((f) => f.uri.fsPath === stored)) return stored;

  const prismaFolder = findWorkspaceFolderWithPrismaSchema(folders);
  if (prismaFolder) return prismaFolder;

  return folders[0].uri.fsPath;
}

function findWorkspaceFolderWithPrismaSchema(
  folders: readonly vscode.WorkspaceFolder[] | undefined,
): string | undefined {
  if (!folders) return undefined;

  for (const folder of folders) {
    const root = folder.uri.fsPath;
    if (findPrismaSchemaRoot(root)) {
      return root;
    }
  }

  return undefined;
}

function findPrismaSchemaRoot(root: string): string | undefined {
  const candidatePaths = [
    path.join(root, "prisma", "schema"),
    path.join(root, "prisma", "schema.prisma"),
    path.join(root, "schema.prisma"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const stats = fs.lstatSync(candidate);
      if (stats.isDirectory() || stats.isFile()) {
        return root;
      }
    }
  }

  const entries = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const entry of entries) {
    const nestedBase = path.join(root, entry.name);
    const nestedCandidates = [
      path.join(nestedBase, "prisma", "schema"),
      path.join(nestedBase, "prisma", "schema.prisma"),
      path.join(nestedBase, "schema.prisma"),
    ];

    for (const candidate of nestedCandidates) {
      if (fs.existsSync(candidate)) {
        const stats = fs.lstatSync(candidate);
        if (stats.isDirectory() || stats.isFile()) {
          return root;
        }
      }
    }
  }

  return undefined;
}

export function activate(context: vscode.ExtensionContext) {
  const initialRoot = getInitialEntityViewRoot(context);
  const entityTreeProvider = new EntityTreeDataProvider(initialRoot);

  const treeView = vscode.window.createTreeView("nest-tools.entityView", {
    treeDataProvider: entityTreeProvider,
  });

  treeView.onDidChangeCheckboxState((e) => {
    e.items.forEach(([item, state]) => {
      if (item instanceof EntityItem) {
        if (item.id) {
          entityTreeProvider.setChecked(item.id, item.filePath, state);
        }
      }
    });

    entityTreeProvider.refresh();
  });

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nest-tools.renderSelectedEntities",
      async () => {
        const checkedPaths = entityTreeProvider.getCheckedItems();
        if (checkedPaths.length === 0) {
          vscode.window.showWarningMessage(
            "Please select at least one entity to render.",
          );
          return;
        }

        const entityNames: string[] = [];

        for (const p of checkedPaths) {
          try {
            const content = fs.readFileSync(p, "utf8");
            const match = content.match(/export\s+class\s+(\w+)/);
            if (match) {
              entityNames.push(match[1]);
            }
          } catch (e) {
            console.error(e);
          }
        }

        if (entityNames.length === 0) {
          vscode.window.showWarningMessage(
            "No valid entities found in selection.",
          );
          return;
        }

        const rootPath =
          entityTreeProvider.workspaceRoot ||
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
          "";
        if (!rootPath) {
          vscode.window.showWarningMessage(
            "No workspace folder selected. Use the folder icon in Entity View to select a project.",
          );
          return;
        }
        EntityVisualizer.createOrShow(
          context.extensionUri,
          entityNames[0],
          rootPath,
          context,
          entityNames,
          true,
        );
      },
    ),
  );

  const socketProvider = new SocketTesterViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SocketTesterViewProvider.viewId,
      socketProvider,
    ),
  );

  const dtoProvider = new DtoSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DtoSidebarProvider.viewId,
      dtoProvider,
    ),
  );

  const httpTesterProvider = new HttpTesterSidebarProvider(
    context.extensionUri,
    context,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HttpTesterSidebarProvider.viewId,
      httpTesterProvider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nest-tools.generateHttpCollections",
      (fileUri: vscode.Uri) =>
        generateCollectionsFromControllerCommand(context, fileUri),
    ),
    vscode.commands.registerCommand("nest-tools.openHttpTester", () =>
      openHttpTesterCommand(context),
    ),
    vscode.commands.registerCommand(
      "nest-tools.closeHttpTester",
      closeHttpTesterCommand,
    ),
    vscode.commands.registerCommand(
      "nest-tools.addLoggerDebug",
      addLoggerDebugCommand,
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateDto",
      generateDtoCommand,
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateInterface",
      generateInterfaceCommand,
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateReturnInterface",
      generateReturnInterfaceCommand,
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateRepository",
      generateRepositoryCommand,
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateService",
      generateServiceCommand,
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateController",
      generateControllerCommand,
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateCrud",
      generateCrudCommand,
    ),
    vscode.commands.registerCommand(
      "nest-tools.completeReturnType",
      completeReturnType,
    ),
    vscode.commands.registerCommand(
      "nest-tools.controllerByFunction",
      generateControllerEndpoint,
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateEntity",
      EntityCommand.generateEntity,
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateEntityFromPalette",
      EntityCommand.generateEntity,
    ),
    vscode.commands.registerCommand(
      "nest-tools.convertOrm",
      OrmConverter.convertOrm,
    ),
    vscode.commands.registerCommand(
      "nest-tools.migrateToTypeOrm",
      MongooseToTypeOrmMigrator.migrateToTypeOrm,
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateErd",
      generateErdCommand,
    ),
    vscode.commands.registerCommand("socketTester.connect", () =>
      vscode.commands.executeCommand(
        "workbench.view.extension.socketTesterView",
      ),
    ),
    vscode.commands.registerCommand(
      "nest-tools.viewEntityErd",
      async (item: EntityItem) => {
        if (item && item.label && item.filePath) {
          try {
            const content = fs.readFileSync(item.filePath, "utf8");

            const match = content.match(/export\s+class\s+(\w+)/);
            if (!match) {
              vscode.window.showWarningMessage(
                "No se pudo detectar la clase en el archivo.",
              );
              return;
            }
            const entityClassName = match[1];

            // Obtener las entidades marcadas con checkbox
            const checkedPaths = entityTreeProvider.getCheckedItems();

            if (checkedPaths.length > 0) {
              // Si hay entidades marcadas, usar solo esas
              const entityNames: string[] = [];

              for (const p of checkedPaths) {
                try {
                  const fileContent = fs.readFileSync(p, "utf8");
                  const classMatch = fileContent.match(
                    /export\s+class\s+(\w+)/,
                  );
                  if (classMatch) {
                    entityNames.push(classMatch[1]);
                  }
                } catch (e) {
                  console.error(e);
                }
              }

              const rootPath =
                entityTreeProvider.workspaceRoot ||
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
                "";
              if (entityNames.length > 0) {
                EntityVisualizer.createOrShow(
                  context.extensionUri,
                  entityNames[0],
                  rootPath,
                  context,
                  entityNames,
                  true, // strict mode: solo mostrar entidades seleccionadas
                );
              } else {
                vscode.window.showWarningMessage(
                  "No se pudieron procesar las entidades seleccionadas.",
                );
              }
            } else {
              // Si no hay entidades marcadas, mostrar solo la entidad clickeada
              const rootPath =
                entityTreeProvider.workspaceRoot ||
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
                "";
              if (!rootPath) {
                vscode.window.showWarningMessage(
                  "Selecciona una carpeta del workspace en Entity View (ícono de carpeta).",
                );
                return;
              }
              EntityVisualizer.createOrShow(
                context.extensionUri,
                entityClassName,
                rootPath,
                context,
                [entityClassName],
                true, // strict mode: solo mostrar esta entidad
              );
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`Error opening ERD: ${err.message}`);
          }
        }
      },
    ),
    vscode.commands.registerCommand(
      "nest-tools.selectEntityViewFolder",
      async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
          vscode.window.showWarningMessage(
            "No hay carpetas abiertas en el workspace.",
          );
          return;
        }
        if (folders.length === 1) {
          vscode.window.showInformationMessage(
            "Solo hay una carpeta en el workspace.",
          );
          return;
        }

        const currentRoot = entityTreeProvider.workspaceRoot;
        const items = folders.map((f) => ({
          label: f.name,
          description: f.uri.fsPath,
          folder: f,
          picked: f.uri.fsPath === currentRoot,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Selecciona la carpeta del proyecto para el Entity View",
          matchOnDescription: true,
          title: "Carpeta del Entity View",
        });

        if (selected) {
          entityTreeProvider.setWorkspaceRoot(selected.folder.uri.fsPath);
          context.workspaceState.update(
            ENTITY_VIEW_FOLDER_KEY,
            selected.folder.uri.fsPath,
          );
          vscode.window.showInformationMessage(
            `Entity View: mostrando entidades de "${selected.label}".`,
          );
        }
      },
    ),
    vscode.commands.registerCommand("nest-tools.searchEntities", async () => {
      const value = await vscode.window.showInputBox({
        placeHolder: "Search entities...",
      });
      if (value !== undefined) {
        entityTreeProvider.filter(value);
      }
    }),
    vscode.commands.registerCommand("nest-tools.openFlowchartEditor", () =>
      openFlowchartEditorCommand(context, entityTreeProvider)
    ),
    vscode.commands.registerCommand(
      "nest-tools.renderSelectedAsFlowchart",
      async () => {
        const checkedPaths = entityTreeProvider.getCheckedItems();
        if (checkedPaths.length === 0) {
          vscode.window.showWarningMessage(
            "Selecciona al menos una entidad con checkbox para crear el diagrama."
          );
          return;
        }
        openFlowchartEditorCommand(context, entityTreeProvider);
      }
    ),
    vscode.commands.registerCommand("nest-tools.clearSearchEntities", () => {
      entityTreeProvider.filter("");
    }),
    vscode.commands.registerCommand("nest-tools.openHttpTesterNewTab", () => {
      HttpTesterPanel.createNewTab(context.extensionUri, context);
    }),
    vscode.commands.registerCommand("nest-tools.closeAllHttpTesterTabs", () => {
      if (HttpTesterPanel.panels && HttpTesterPanel.panels.length > 0) {
        const panels = [...HttpTesterPanel.panels];
        panels.forEach((panel) => panel.dispose());
        vscode.window.showInformationMessage(
          `Closed ${panels.length} HTTP Tester tab(s)`,
        );
      }
    }),
    vscode.commands.registerCommand("nest-tools.showHttpTesterInfo", () => {
      const count = HttpTesterPanel.getPanelCount();
      if (count === 0) {
        vscode.window.showInformationMessage("No HTTP Tester tabs are open");
      } else {
        vscode.window.showInformationMessage(
          `${count} HTTP Tester tab(s) currently open`,
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.createProject",
      async (uri: vscode.Uri) => {
        await handleCreateProject(uri);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nest-tools.triggerReturnType", () => {
      vscode.commands.executeCommand("nest-tools.completeReturnType");
    }),
  );

  // Auto-commit service moved to commands/auto-commit.command.ts
  const autoCommitService = createAutoCommitService(context);
  context.subscriptions.push(autoCommitService);
  try {
    const acEnabled = context.globalState.get("autoCommitEnabled");
    if (acEnabled) {
      vscode.window.showInformationMessage("Auto-commit is enabled.");
    }
  } catch (err) {
    // ignore
  }

  vscode.window.showInformationMessage("Backend tools active!");
}

export function deactivate() {
  if (HttpTesterPanel.panels && HttpTesterPanel.panels.length > 0) {
    const panels = [...HttpTesterPanel.panels];
    panels.forEach((panel) => {
      try {
        panel.dispose();
      } catch (error) {
        console.error("Error disposing panel:", error);
      }
    });
  }
  console.log("Backend Tools desactivado");
}
