import * as vscode from "vscode";
import { generateDtoCommand } from "./commands/dto.command";
import { generateRepositoryCommand } from "./commands/repository.command";
import { generateServiceCommand } from "./commands/service.command";
import { generateControllerCommand } from "./commands/controller.command";
import { generateCrudCommand } from "./commands/crud.command";
import { completeReturnType } from "./autocomplete/functionReturn";

export function activate(context: vscode.ExtensionContext) {
  console.log("NestJS Tools: Generador CRUD + Autocomplete activado");

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

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.commands.registerCommand("nest-tools.triggerReturnType", () => {
      vscode.commands.executeCommand("nest-tools.completeReturnType");
    })
  );
  vscode.window.showInformationMessage(
    "NestJS Tools listo: Generador CRUD + Autocomplete activado"
  );
}

export function deactivate() {
  console.log("NestJS Tools desactivado");
}
