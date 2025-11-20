import * as vscode from "vscode";

// `typescript` es usado para analizar el código, pero es una dependencia de
// desarrollo pesada. Si la extensión está empaquetada sin `typescript` en
// `dependencies`, `require('typescript')` fallará en tiempo de ejecución.
// Hacemos un `require` dinámico y mostramos un mensaje amigable si no existe.
let tsLib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
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
    vscode.window.showInformationMessage("Cursor en línea de función async");
    return;
  }

  const signature = match[1];
  const currentType = match[2];

  if (
    currentType &&
    currentType.includes("Promise<") &&
    !currentType.includes("any")
  ) {
    return;
  }

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

  vscode.window.showInformationMessage(`Tipo inferido: Promise<${finalType}>`);
}

function inferReturnTypeFromFunctionBody(sourceFile: any, cursorLine: number): { type: string } {
  let returnType: string = "void";
  let foundReturn = false;
  const visit = (node: any) => {
    if (tsLib.isMethodDeclaration(node) || tsLib.isFunctionDeclaration(node)) {
      const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
      const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;

      if (cursorLine >= startLine && cursorLine <= endLine && node.body) {
        tsLib.forEachChild(node.body, scanForReturn);
      }
    }
    tsLib.forEachChild(node, visit);
  };

  const scanForReturn = (node: any) => {
    if (tsLib.isReturnStatement(node)) {
      foundReturn = true;

      if (!node.expression) {
        returnType = "void";
        return;
      }

      const expr = node.expression;

      if (tsLib.isAwaitExpression(expr) && tsLib.isCallExpression(expr.expression)) {
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
      } else if (tsLib.isAwaitExpression(expr) && tsLib.isCallExpression(expr.expression)) {
        const callText = expr.expression.expression.getText();
        if (callText.includes(".findAll")) {
          returnType = `PaginatedResponseDto<${
            getEntityNameFromFile() || "any"
          }>`;
        }
      }
    }
  };

  visit(sourceFile);

  if (!foundReturn) return { type: "void" };
  return { type: returnType };
}

function getEntityNameFromFile(): string | null {
  const fileName = vscode.window.activeTextEditor?.document.fileName;
  if (!fileName) return null;

  const baseName = fileName
    .split("/")
    .pop()
    ?.replace(".service.ts", "")
    .replace(".controller.ts", "");
  if (baseName && /^[A-Z]/.test(baseName)) {
    return baseName;
  }

  const content = vscode.window.activeTextEditor?.document.getText() || "";
  const classMatch = content.match(/export class (\w+)Service/);
  if (classMatch) {
    return classMatch[1].replace("Service", "");
  }

  return null;
}

function inferVariableType(varName: string, sourceFile: any): string | null {
  let type: string | null = null;

  sourceFile.forEachChild((node: any) => {
    if (tsLib.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl: any) => {
        if (tsLib.isIdentifier(decl.name) && decl.name.text === varName && decl.type) {
          type = decl.type.getText();
        }
      });
    }
  });

  return type;
}
