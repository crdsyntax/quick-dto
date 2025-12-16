import * as vscode from "vscode";
import * as fs from "fs";
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
import {
  closeHttpTesterCommand,
  openHttpTesterCommand,
} from "./commands/http-tester.command";
import { HttpTesterSidebarProvider } from "./views/http-tester-sidebar.view";
import { addLoggerDebugCommand } from "./commands/logger.command";
import { generateCollectionsFromControllerCommand } from "./commands/generate-collection.command";
import { HttpTesterPanel } from "./views/http-tester.view";

export function activate(context: vscode.ExtensionContext) {
  const entityTreeProvider = new EntityTreeDataProvider(
    vscode.workspace.rootPath
  );

  const treeView = vscode.window.createTreeView("nest-tools.entityView", {
    treeDataProvider: entityTreeProvider,
  });

  treeView.onDidChangeCheckboxState((e) => {
    e.items.forEach(([item, state]) => {
      if (item instanceof EntityItem) {
        entityTreeProvider.setChecked(item, state);
      }
    });
  });

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nest-tools.renderSelectedEntities",
      async () => {
        const checkedPaths = entityTreeProvider.getCheckedItems();
        if (checkedPaths.length === 0) {
          vscode.window.showWarningMessage(
            "Please select at least one entity to render."
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
            "No valid entities found in selection."
          );
          return;
        }

        EntityVisualizer.createOrShow(
          context.extensionUri,
          entityNames[0], // using first as 'root' for naming purpose mainly
          vscode.workspace.rootPath || "",
          context,
          entityNames // pass the list!
        );
      }
    )
  );

  const socketProvider = new SocketTesterViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SocketTesterViewProvider.viewId,
      socketProvider
    )
  );

  const httpTesterProvider = new HttpTesterSidebarProvider(
    context.extensionUri
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HttpTesterSidebarProvider.viewId,
      httpTesterProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nest-tools.generateHttpCollections",
      (fileUri: vscode.Uri) =>
        generateCollectionsFromControllerCommand(context, fileUri)
    ),
    vscode.commands.registerCommand("nest-tools.openHttpTester", () =>
      openHttpTesterCommand(context)
    ),
    vscode.commands.registerCommand(
      "nest-tools.closeHttpTester",
      closeHttpTesterCommand
    ),
    vscode.commands.registerCommand(
      "nest-tools.addLoggerDebug",
      addLoggerDebugCommand
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateDto",
      generateDtoCommand
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateInterface",
      generateInterfaceCommand
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateReturnInterface",
      generateReturnInterfaceCommand
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateRepository",
      generateRepositoryCommand
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateService",
      generateServiceCommand
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateController",
      generateControllerCommand
    ),
    vscode.commands.registerCommand(
      "nest-dto-generator.generateCrud",
      generateCrudCommand
    ),
    vscode.commands.registerCommand(
      "nest-tools.completeReturnType",
      completeReturnType
    ),
    vscode.commands.registerCommand(
      "nest-tools.controllerByFunction",
      generateControllerEndpoint
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateEntity",
      EntityCommand.generateEntity
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateEntityFromPalette",
      EntityCommand.generateEntity
    ),
    vscode.commands.registerCommand(
      "nest-tools.convertOrm",
      OrmConverter.convertOrm
    ),
    vscode.commands.registerCommand(
      "nest-tools.migrateToTypeOrm",
      MongooseToTypeOrmMigrator.migrateToTypeOrm
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateErd",
      generateErdCommand
    ),
    vscode.commands.registerCommand("socketTester.connect", () =>
      vscode.commands.executeCommand(
        "workbench.view.extension.socketTesterView"
      )
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
                "No se pudo detectar la clase en el archivo."
              );
              return;
            }
            const entityClassName = match[1];

            EntityVisualizer.createOrShow(
              context.extensionUri,
              entityClassName,
              vscode.workspace.rootPath || "",
              context
            );
          } catch (err: any) {
            vscode.window.showErrorMessage(`Error opening ERD: ${err.message}`);
          }
        }
      }
    ),
    vscode.commands.registerCommand("nest-tools.searchEntities", async () => {
      const value = await vscode.window.showInputBox({
        placeHolder: "Search entities...",
      });
      if (value !== undefined) {
        entityTreeProvider.filter(value);
      }
    }),
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
          `Closed ${panels.length} HTTP Tester tab(s)`
        );
      }
    }),

    vscode.commands.registerCommand("nest-tools.showHttpTesterInfo", () => {
      const count = HttpTesterPanel.getPanelCount();
      if (count === 0) {
        vscode.window.showInformationMessage("No HTTP Tester tabs are open");
      } else {
        vscode.window.showInformationMessage(
          `${count} HTTP Tester tab(s) currently open`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nest-tools.triggerReturnType", () => {
      vscode.commands.executeCommand("nest-tools.completeReturnType");
    })
  );

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
