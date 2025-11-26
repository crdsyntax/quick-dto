import * as vscode from "vscode";
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
import { EntityGenerator } from "./commands/entity.command";
import { OrmConverter } from "./commands/convert.command";
import { MongooseToTypeOrmMigrator } from "./commands/migration.command";
import { generateErdCommand } from "./commands/erd-generator.command";

export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(
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
      "nest-tools.generateDiagram",
      registerDiagramCommand
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateEntity", EntityGenerator.generateEntity
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateEntityFromPalette", EntityGenerator.generateEntity
    ),
    vscode.commands.registerCommand(
      "nest-tools.convertOrm", OrmConverter.convertOrm
    ),
    vscode.commands.registerCommand(
      "nest-tools.migrateToTypeOrm", MongooseToTypeOrmMigrator.migrateToTypeOrm
    ),
    vscode.commands.registerCommand(
      "nest-tools.generateErd", generateErdCommand
    ),

  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nest-tools.triggerReturnType", () => {
      vscode.commands.executeCommand("nest-tools.completeReturnType");
    })
  );

  vscode.window.showInformationMessage("NestJS Tools Activado 🚀 v2.106.0");
}

export function deactivate() {
  console.log("NestJS Tools desactivado");
}