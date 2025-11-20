import * as vscode from "vscode";

let tsLib: any = null;
try {
  tsLib = require("typescript");
} catch (err) {
  tsLib = null;
}

export async function completeReturnType() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const position = editor.selection.active;
  const line = document.lineAt(position.line);
  const lineText = line.text;

  const funcRegex =
    /^(.*\basync\b[^\(]*\([^)]*\))\s*(?::\s*(Promise<[^>]+>|any|[^\s{]+))?\s*{/;
  const match = lineText.match(funcRegex);
  if (!match) {
    vscode.window.showInformationMessage(
      "No se encontró una función async válida en esta línea"
    );
    return;
  }

  const signature = match[1];
  const currentType = match[2];

  if (
    currentType &&
    currentType.includes("Promise<") &&
    !currentType.includes("any")
  ) {
    vscode.window.showInformationMessage(
      "La función ya tiene un tipo de retorno Promise definido"
    );
    return;
  }

  if (!tsLib) {
    await simpleTypeInference(editor, line, lineText);
    return;
  }

  await advancedTypeInference(editor, document, position, line, lineText);
}

async function simpleTypeInference(
  editor: vscode.TextEditor,
  line: vscode.TextLine,
  lineText: string
) {
  const document = editor.document;
  const text = document.getText();

  let inferredType = "any";

  if (text.includes(".create(") || text.includes(".save(")) {
    inferredType = getEntityNameFromFile() || "any";
  } else if (text.includes(".update(") || text.includes(".updateOne(")) {
    inferredType = "UpdateResult";
  } else if (text.includes(".remove(") || text.includes(".delete(")) {
    inferredType = "DeleteResult";
  } else if (text.includes(".findAll(") || text.includes(".find(")) {
    inferredType = `PaginatedResponseDto<${getEntityNameFromFile() || "any"}>`;
  } else if (text.includes(".findOne(") || text.includes(".findById(")) {
    inferredType = getEntityNameFromFile() || "any";
  }

  const newReturn = `: Promise<${inferredType}>`;
  const newLine = lineText.replace(
    /^(.*\))\s*(?::\s*(Promise<[^>]+>|any)?)?\s*{/,
    `$1${newReturn} {`
  );

  await editor.edit((edit) => {
    edit.replace(line.range, newLine);
  });

  vscode.window.showInformationMessage(
    `Tipo inferido: Promise<${inferredType}> (modo simple)`
  );
}

async function advancedTypeInference(
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  position: vscode.Position,
  line: vscode.TextLine,
  lineText: string
) {
  try {
    const sourceFile = tsLib.createSourceFile(
      document.fileName,
      document.getText(),
      tsLib.ScriptTarget.Latest,
      true
    );

    const inferred = inferReturnTypeFromFunctionBody(sourceFile, position.line);
    const finalType = inferred.type;
    const newReturn = `: Promise<${finalType}>`;

    const newLine = lineText.replace(
      /^(.*\))\s*(?::\s*(Promise<[^>]+>|any)?)?\s*{/,
      `$1${newReturn} {`
    );

    await editor.edit((edit) => {
      edit.replace(line.range, newLine);
    });

    vscode.window.showInformationMessage(
      `Tipo inferido: Promise<${finalType}>`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Error en inferencia de tipos: ${error}`);
    await simpleTypeInference(editor, line, lineText);
  }
}

function getEntityNameFromFile(): string | null {
  const fileName = vscode.window.activeTextEditor?.document.fileName;
  if (!fileName) return null;

  const baseName = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(".service.ts", "")
    .replace(".controller.ts", "");

  if (baseName) {
    const pascalName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    return pascalName;
  }

  const content = vscode.window.activeTextEditor?.document.getText() || "";
  const classMatch = content.match(/export class (\w+)(Service|Controller)/);
  if (classMatch) {
    return classMatch[1].replace("Service", "").replace("Controller", "");
  }

  return null;
}

function inferReturnTypeFromFunctionBody(
  sourceFile: any,
  cursorLine: number
): { type: string } {
  if (!tsLib) return { type: "any" };

  try {
    let returnType: string = "void";
    let foundReturn = false;

    const visit = (node: any) => {
      if (!node) return;

      try {
        if (
          tsLib.isMethodDeclaration(node) ||
          tsLib.isFunctionDeclaration(node)
        ) {
          const start = sourceFile.getLineAndCharacterOfPosition(
            node.getStart()
          );
          const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

          if (cursorLine >= start.line && cursorLine <= end.line && node.body) {
            tsLib.forEachChild(node.body, scanForReturn);
          }
        }
        tsLib.forEachChild(node, visit);
      } catch (error) {}
    };

    const scanForReturn = (node: any) => {
      if (!node) return;

      try {
        if (tsLib.isReturnStatement(node)) {
          foundReturn = true;

          if (!node.expression) {
            returnType = "void";
            return;
          }

          const expr = node.expression;

          if (
            tsLib.isAwaitExpression(expr) &&
            tsLib.isCallExpression(expr.expression)
          ) {
            const callText = expr.expression.expression.getText();

            if (callText.includes(".create(")) {
              returnType = getEntityNameFromFile() || "any";
            }
            if (callText.includes(".update(")) {
              returnType = "UpdateResult";
            }
            if (callText.includes(".remove(")) {
              returnType = "DeleteResult";
            }
          } else if (tsLib.isIdentifier(expr)) {
            const varName = expr.getText();

            if (varName === "updated") returnType = "UpdateResult";
            else if (varName === "deleted") returnType = "DeleteResult";
            else if (varName === "item")
              returnType = getEntityNameFromFile() || "any";
            else {
              const varType = inferVariableType(varName, sourceFile);
              if (varType) returnType = varType;
            }
          } else if (
            tsLib.isAwaitExpression(expr) &&
            tsLib.isCallExpression(expr.expression)
          ) {
            const callText = expr.expression.expression.getText();
            if (callText.includes(".findAll")) {
              returnType = `PaginatedResponseDto<${
                getEntityNameFromFile() || "any"
              }>`;
            }
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error en scanForRturn: ${error}`);
      }
    };

    visit(sourceFile);
    return { type: foundReturn ? returnType : "void" };
  } catch (error) {
    return { type: "any" };
  }
}

function inferVariableType(varName: string, sourceFile: any): string | null {
  if (!tsLib) return null;

  try {
    let type: string | null = null;
    sourceFile.forEachChild((node: any) => {
      try {
        if (tsLib.isVariableStatement(node)) {
          node.declarationList.declarations.forEach((decl: any) => {
            if (
              tsLib.isIdentifier(decl.name) &&
              decl.name.text === varName &&
              decl.type
            ) {
              type = decl.type.getText();
            }
          });
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error en inferVariableType: ${error}`);
      }
    });
    return type;
  } catch (error) {
    return null;
  }
}
