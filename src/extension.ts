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

async function addLoggerDebugCommand() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage("No active editor found");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showWarningMessage("Please select some text first");
    return;
  }

  try {
    const functionName = await getCurrentFunctionName(editor, selection.start);
    const className = await getClassName(editor);
    const loggerAdded = await ensureLoggerExists(editor, className);

    if (loggerAdded === null) {
      vscode.window.showErrorMessage(
        "Could not determine where to add logger in the class"
      );
      return;
    }
    const debugStatement = `this.logger.debug("${functionName}", ${selectedText});`;
    await editor.edit((editBuilder) => {
      const line = editor.document.lineAt(selection.end.line);
      const lineText = line.text;
      const indentationMatch = lineText.match(/^(\s*)/);
      const indentation = indentationMatch
        ? indentationMatch[1] + "\t".repeat(2)
        : "\t\t";

      const insertPosition = new vscode.Position(selection.end.line + 1, 0);
      editBuilder.insert(insertPosition, `\n${indentation}${debugStatement}`);
    });

    vscode.window.showInformationMessage(
      `Logger debug statement added for: ${functionName}`
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error: ${error.message}`);
  }
}

async function getCurrentFunctionName(
  editor: vscode.TextEditor,
  position: vscode.Position
): Promise<string> {
  const document = editor.document;
  let currentLine = position.line;
  while (currentLine >= 0) {
    const lineText = document.lineAt(currentLine).text;
    const functionMatch = lineText.match(
      /(public|private|protected)?\s*(async)?\s*(\w+)\s*\([^)]*\)/
    );
    const arrowFunctionMatch = lineText.match(
      /(public|private|protected)?\s*(\w+)\s*=\s*\([^)]*\)\s*=>/
    );

    if (functionMatch && functionMatch[3]) {
      return functionMatch[3];
    } else if (arrowFunctionMatch && arrowFunctionMatch[2]) {
      return arrowFunctionMatch[2];
    }

    currentLine--;
  }

  return "anonymousFunction";
}

async function ensureLoggerExists(
  editor: vscode.TextEditor,
  className: string
): Promise<boolean | null> {
  const document = editor.document;
  const text = document.getText();
  const loggerPatterns = [
    /private\s+readonly\s+logger\s*[:=]/,
    /private\s+logger\s*[:=]/,
    /protected\s+readonly\s+logger\s*[:=]/,
    /readonly\s+logger\s*[:=]/,
    /logger\s*[:=]/,
    /constructor\([^)]*logger\s*:/,
    /@Inject\([^)]*Logger[^)]*\)/,
  ];

  const loggerExists = loggerPatterns.some((pattern) => pattern.test(text));

  if (loggerExists) {
    return true;
  }
  return await addLoggerToClass(editor, className);
}

async function addLoggerToClass(
  editor: vscode.TextEditor,
  className: string
): Promise<boolean | null> {
  const document = editor.document;
  const text = document.getText();
  const classMatch = text.match(/class\s+(\w+)/);
  if (!classMatch) {
    return null;
  }

  const constructorMatch = text.match(/(constructor\s*\([^)]*\)\s*{)/);

  if (constructorMatch) {
    return await addLoggerToConstructor(editor, constructorMatch[1], className);
  } else {
    return await createConstructorWithLogger(editor, className);
  }
}

async function addLoggerToConstructor(
  editor: vscode.TextEditor,
  constructorLine: string,
  className: string
): Promise<boolean> {
  const document = editor.document;
  const text = document.getText();

  const constructorIndex = text.indexOf(constructorLine);
  if (constructorIndex === -1) {
    return false;
  }

  const position = document.positionAt(constructorIndex);
  const line = document.lineAt(position.line);

  if (line.text.includes("logger")) {
    return true;
  }

  await editor.edit((editBuilder) => {
    let parenCount = 0;
    let foundClosing = false;
    let currentPos = position;

    while (currentPos.line < document.lineCount && !foundClosing) {
      const lineText = document.lineAt(currentPos.line).text;

      for (let i = 0; i < lineText.length; i++) {
        if (lineText[i] === "(") parenCount++;
        if (lineText[i] === ")") {
          parenCount--;
          if (parenCount === 0) {
            const charPos = new vscode.Position(currentPos.line, i);
            const constructorParams = lineText
              .substring(lineText.indexOf("(") + 1, i)
              .trim();

            if (constructorParams.length > 0) {
              editBuilder.insert(charPos, `, private readonly logger: Logger`);
            } else {
              editBuilder.insert(charPos, `private readonly logger: Logger`);
            }

            foundClosing = true;
            break;
          }
        }
      }

      if (!foundClosing) {
        currentPos = new vscode.Position(currentPos.line + 1, 0);
      }
    }
  });

  return true;
}

async function createConstructorWithLogger(
  editor: vscode.TextEditor,
  className: string
): Promise<boolean | null> {
  const document = editor.document;
  const text = document.getText();
  const classMatch = text.match(/class\s+\w+\s*{/);
  if (!classMatch) {
    return null;
  }

  const classIndex = text.indexOf(classMatch[0]);
  const position = document.positionAt(classIndex + classMatch[0].length);
  let insertLine = position.line;
  let foundInsertionPoint = false;

  while (insertLine < document.lineCount && !foundInsertionPoint) {
    const lineText = document.lineAt(insertLine).text.trim();

    if (
      lineText.length > 0 &&
      !lineText.startsWith("//") &&
      !lineText.startsWith("*")
    ) {
      foundInsertionPoint = true;
      break;
    }
    insertLine++;
  }

  if (!foundInsertionPoint) {
    insertLine = position.line + 1;
  }

  await editor.edit((editBuilder) => {
    const insertPosition = new vscode.Position(insertLine, 0);
    const indentation = getIndentationAtLine(document, insertLine);

    const constructorCode = `\n${indentation}constructor(private readonly logger: Logger) {}\n`;
    editBuilder.insert(insertPosition, constructorCode);
  });

  return true;
}

function getIndentationAtLine(
  document: vscode.TextDocument,
  line: number
): string {
  const lineText = document.lineAt(line).text;
  const indentationMatch = lineText.match(/^(\s*)/);
  return indentationMatch ? indentationMatch[1] : "";
}

async function getClassName(editor: vscode.TextEditor): Promise<string> {
  const document = editor.document;
  const text = document.getText();

  const classMatch = text.match(/class\s+(\w+)/);
  if (classMatch && classMatch[1]) {
    return classMatch[1];
  }

  return "UnknownClass";
}

export function activate(context: vscode.ExtensionContext) {
  const entityTreeProvider = new EntityTreeDataProvider(
    vscode.workspace.rootPath
  );
  vscode.window.registerTreeDataProvider(
    "nest-tools.entityView",
    entityTreeProvider
  );

  const socketProvider = new SocketTesterViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SocketTesterViewProvider.viewId,
      socketProvider
    )
  );

  context.subscriptions.push(
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
    })
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
