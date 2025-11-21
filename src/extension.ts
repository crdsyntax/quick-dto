import * as vscode from "vscode";
import { generateDtoCommand } from "./commands/dto.command";
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

export function activate(context: vscode.ExtensionContext) {
  console.log("NestJS Tools Generador actived");

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nest-dto-generator.generateDto",
      generateDtoCommand
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
    )
  );

  const disposable = vscode.commands.registerCommand(
    "nest-tools.completeReturnType",
    completeReturnType
  );

  const disposablece = vscode.commands.registerCommand(
    "nest-tools.controllerByFunction",
    generateControllerEndpoint
  );

  const disposabledia = vscode.commands.registerCommand(
    "nest-tools.generateDiagram",
    registerDiagramCommand
  );

  let generateEntityCommand = vscode.commands.registerCommand(
    "nest-tools.generateEntity",
    (uri: vscode.Uri) => {
      EntityGenerator.generateEntity();
    }
  );

  let generateEntityFromPalette = vscode.commands.registerCommand(
    "nest-tools.generateEntityFromPalette",
    () => {
      EntityGenerator.generateEntity();
    }
  );

  let exploreDataDictionary = vscode.commands.registerCommand(
    "nest-tools.exploreDataDictionary",
    () => {
      EntityGenerator.showDataDictionary();
    }
  );

  let convertOrmCommand = vscode.commands.registerCommand(
    "nest-tools.convertOrm",
    () => {
      OrmConverter.convertOrm();
    }
  );

  let migrateToTypeOrmCommand = vscode.commands.registerCommand(
    "nest-tools.migrateToTypeOrm",
    () => {
      MongooseToTypeOrmMigrator.migrateToTypeOrm();
    }
  );

  context.subscriptions.push(
    generateEntityCommand,
    generateEntityFromPalette,
    exploreDataDictionary,
    disposable,
    disposabledia,
    disposablece,
    
    convertOrmCommand,
    migrateToTypeOrmCommand
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nest-tools.triggerReturnType", () => {
      vscode.commands.executeCommand("nest-tools.completeReturnType");
    })
  );

  vscode.window.showInformationMessage("NestJS Tools Activado - ¡Comandos de conversión ORM disponibles!");
}

export function deactivate() {
  console.log("NestJS Tools desactivado");
}