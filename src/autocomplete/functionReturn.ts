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
    /^(?:\s*(?:export\s+)?(?:public|private|protected)?\s*(?:async\s+)?(?:function\s+)?\s*)(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\{]+))?\s*\{/;
  const match = lineText.match(funcRegex);

  if (!match) {
    vscode.window.showInformationMessage(
      "No se encontró una función válida en esta línea"
    );
    return;
  }

  const functionName = match[1];
  const parameters = match[2];
  const currentType = match[3];

  if (currentType && currentType !== "any" && !currentType.includes("void")) {
    vscode.window.showInformationMessage(
      "La función ya tiene un tipo de retorno definido"
    );
    return;
  }

  if (!tsLib) {
    await simpleTypeInference(editor, line, lineText, functionName);
    return;
  }

  await advancedTypeInference(
    editor,
    document,
    position,
    line,
    lineText,
    functionName
  );
}

async function simpleTypeInference(
  editor: vscode.TextEditor,
  line: vscode.TextLine,
  lineText: string,
  functionName: string
) {
  const document = editor.document;
  const text = document.getText();

  let inferredType = "any";
  const isAsync = lineText.includes("async");

  const functionNameLower = functionName.toLowerCase();

  if (
    functionNameLower.includes("get") ||
    functionNameLower.includes("find") ||
    functionNameLower.includes("search") ||
    functionNameLower.includes("fetch")
  ) {
    if (
      functionNameLower.includes("all") ||
      functionNameLower.includes("list") ||
      functionNameLower.includes("search")
    ) {
      inferredType = `PaginatedResponseDto<${
        getEntityNameFromFile() || "any"
      }>`;
    } else if (
      functionNameLower.includes("by") ||
      functionNameLower.includes("one")
    ) {
      inferredType = getEntityNameFromFile() || "any";
    } else {
      inferredType = getEntityNameFromFile() || "any";
    }
  } else if (
    functionNameLower.includes("create") ||
    functionNameLower.includes("add") ||
    functionNameLower.includes("insert")
  ) {
    inferredType = getEntityNameFromFile() || "any";
  } else if (
    functionNameLower.includes("update") ||
    functionNameLower.includes("modify") ||
    functionNameLower.includes("edit")
  ) {
    inferredType = "UpdateResult";
  } else if (
    functionNameLower.includes("delete") ||
    functionNameLower.includes("remove") ||
    functionNameLower.includes("destroy")
  ) {
    inferredType = "DeleteResult";
  } else if (
    functionNameLower.includes("validate") ||
    functionNameLower.includes("check")
  ) {
    inferredType = "boolean";
  } else if (
    functionNameLower.includes("calculate") ||
    functionNameLower.includes("compute")
  ) {
    inferredType = "number";
  } else if (
    functionNameLower.includes("generate") ||
    functionNameLower.includes("create")
  ) {
    inferredType = "string";
  }

  if (text.includes(".create(") || text.includes(".save(")) {
    inferredType = getEntityNameFromFile() || "any";
  } else if (text.includes(".update(") || text.includes(".updateOne(")) {
    inferredType = "UpdateResult";
  } else if (text.includes(".remove(") || text.includes(".delete(")) {
    inferredType = "DeleteResult";
  } else if (text.includes(".find(") || text.includes(".findAll(")) {
    inferredType = `PaginatedResponseDto<${getEntityNameFromFile() || "any"}>`;
  } else if (text.includes(".findOne(") || text.includes(".findById(")) {
    inferredType = getEntityNameFromFile() || "any";
  }

  const returnType = isAsync ? `Promise<${inferredType}>` : inferredType;
  const newLine = lineText.replace(
    /^(.*\))\s*(?::\s*([^\{]+))?\s*\{/,
    `$1 : ${returnType} {`
  );

  await editor.edit((edit) => {
    edit.replace(line.range, newLine);
  });

  vscode.window.showInformationMessage(
    `Tipo inferido: ${returnType} (modo simple)`
  );
}

async function advancedTypeInference(
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  position: vscode.Position,
  line: vscode.TextLine,
  lineText: string,
  functionName: string
) {
  try {
    const sourceFile = tsLib.createSourceFile(
      document.fileName,
      document.getText(),
      tsLib.ScriptTarget.Latest,
      true
    );

    const isAsync = lineText.includes("async");
    const inferred = inferReturnTypeFromFunctionBody(
      sourceFile,
      position.line,
      functionName,
      isAsync
    );

    const finalType = inferred.type;
    const returnType = isAsync ? `Promise<${finalType}>` : finalType;

    const newLine = lineText.replace(
      /^(.*\))\s*(?::\s*([^\{]+))?\s*\{/,
      `$1 : ${returnType} {`
    );

    await editor.edit((edit) => {
      edit.replace(line.range, newLine);
    });

    vscode.window.showInformationMessage(`Tipo inferido: ${returnType}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Error en inferencia de tipos: ${error}`);
    await simpleTypeInference(editor, line, lineText, functionName);
  }
}

function getEntityNameFromFile(): string | null {
  const fileName = vscode.window.activeTextEditor?.document.fileName;
  if (!fileName) return null;

  const baseName = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.(service|controller|component|util|helper)\.ts$/, "")
    .replace(/\.(js|ts|tsx|jsx)$/, "");

  if (baseName) {
    const pascalName = baseName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    return pascalName;
  }

  const content = vscode.window.activeTextEditor?.document.getText() || "";

  const classMatch = content.match(
    /export class (\w+)(?:Service|Controller|Component)?/
  );
  if (classMatch) {
    return classMatch[1];
  }

  const interfaceMatch = content.match(/export interface (\w+)/);
  if (interfaceMatch) {
    return interfaceMatch[1];
  }

  const typeMatch = content.match(/export type (\w+)/);
  if (typeMatch) {
    return typeMatch[1];
  }

  return null;
}

function inferReturnTypeFromFunctionBody(
  sourceFile: any,
  cursorLine: number,
  functionName: string,
  isAsync: boolean
): { type: string } {
  if (!tsLib) return { type: "any" };

  try {
    let returnType: string = "void";
    let foundReturn = false;
    let hasMultipleReturnTypes = false;
    const returnTypes = new Set<string>();

    const visit = (node: any) => {
      if (!node) return;

      try {
        if (
          tsLib.isMethodDeclaration(node) ||
          tsLib.isFunctionDeclaration(node) ||
          tsLib.isFunctionExpression(node) ||
          tsLib.isArrowFunction(node)
        ) {
          const start = sourceFile.getLineAndCharacterOfPosition(
            node.getStart()
          );
          const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

          if (cursorLine >= start.line && cursorLine <= end.line && node.body) {
            tsLib.forEachChild(node.body, (child: any) => {
              scanForReturn(child, returnTypes);
            });
          }
        }
        tsLib.forEachChild(node, visit);
      } catch (error) {
        // Silenciar errores en el análisis
      }
    };

    const scanForReturn = (node: any, typesSet: Set<string>) => {
      if (!node) return;

      try {
        if (tsLib.isReturnStatement(node)) {
          foundReturn = true;

          if (!node.expression) {
            typesSet.add("void");
            return;
          }

          const expr = node.expression;
          let inferredType = "any";

          if (tsLib.isAwaitExpression(expr)) {
            const awaitedType = analyzeExpression(expr.expression);
            inferredType = awaitedType;
          } else if (tsLib.isCallExpression(expr)) {
            inferredType = analyzeCallExpression(expr);
          } else if (tsLib.isObjectLiteralExpression(expr)) {
            inferredType = analyzeObjectLiteral(expr);
          } else if (tsLib.isArrayLiteralExpression(expr)) {
            inferredType = analyzeArrayLiteral(expr);
          } else if (tsLib.isIdentifier(expr)) {
            inferredType =
              inferVariableType(expr.getText(), sourceFile) || "any";
          } else if (tsLib.isStringLiteral(expr)) {
            inferredType = "string";
          } else if (tsLib.isNumericLiteral(expr)) {
            inferredType = "number";
          } else if (
            expr.kind === tsLib.SyntaxKind.TrueKeyword ||
            expr.kind === tsLib.SyntaxKind.FalseKeyword
          ) {
            inferredType = "boolean";
          } else {
            inferredType = inferTypeFromFunctionName(functionName);
          }

          typesSet.add(inferredType);
        }

        tsLib.forEachChild(node, (child: any) => {
          scanForReturn(child, typesSet);
        });
      } catch (error) {
        // Silenciar errores en el escaneo
      }
    };

    visit(sourceFile);

    if (returnTypes.size === 0) {
      returnType = "void";
    } else if (returnTypes.size === 1) {
      returnType = Array.from(returnTypes)[0];
    } else {
      returnType = Array.from(returnTypes).join(" | ");
      hasMultipleReturnTypes = true;
    }

    if (!foundReturn && returnType === "void") {
      returnType = inferTypeFromFunctionName(functionName);
    }

    return { type: returnType };
  } catch (error) {
    return { type: inferTypeFromFunctionName(functionName) };
  }
}

function analyzeExpression(expr: any): string {
  if (!tsLib) return "any";

  if (tsLib.isCallExpression(expr)) {
    return analyzeCallExpression(expr);
  } else if (tsLib.isPropertyAccessExpression(expr)) {
    return analyzePropertyAccess(expr);
  } else if (tsLib.isIdentifier(expr)) {
    return inferVariableType(expr.getText(), expr.getSourceFile()) || "any";
  }

  return "any";
}

function analyzeCallExpression(expr: any): string {
  const callText = expr.expression.getText();

  if (callText.includes(".create") || callText.includes(".save")) {
    return getEntityNameFromFile() || "any";
  } else if (callText.includes(".update")) {
    return "UpdateResult";
  } else if (callText.includes(".remove") || callText.includes(".delete")) {
    return "DeleteResult";
  } else if (callText.includes(".find") || callText.includes(".search")) {
    if (callText.includes(".findAll") || callText.includes(".findMany")) {
      return `PaginatedResponseDto<${getEntityNameFromFile() || "any"}>`;
    } else {
      return getEntityNameFromFile() || "any";
    }
  } else if (callText.includes(".query") || callText.includes(".execute")) {
    return "any[]";
  } else if (callText.includes(".then") || callText.includes(".catch")) {
    return "Promise<any>";
  }

  return "any";
}

function analyzePropertyAccess(expr: any): string {
  const propertyName = expr.name.getText();

  switch (propertyName) {
    case "length":
      return "number";
    case "toString":
      return "string";
    case "then":
      return "Promise<any>";
    default:
      return "any";
  }
}

function analyzeObjectLiteral(expr: any): string {
  return "object";
}

function analyzeArrayLiteral(expr: any): string {
  if (expr.elements && expr.elements.length > 0) {
    const firstElementType = analyzeExpression(expr.elements[0]);
    return `${firstElementType}[]`;
  }
  return "any[]";
}

function inferVariableType(varName: string, sourceFile: any): string | null {
  if (!tsLib) return null;

  try {
    let type: string | null = null;

    const visit = (node: any) => {
      if (type) return;

      try {
        if (tsLib.isVariableStatement(node)) {
          node.declarationList.declarations.forEach((decl: any) => {
            if (tsLib.isIdentifier(decl.name) && decl.name.text === varName) {
              if (decl.type) {
                type = decl.type.getText();
              } else if (decl.initializer) {
                if (tsLib.isStringLiteral(decl.initializer)) {
                  type = "string";
                } else if (tsLib.isNumericLiteral(decl.initializer)) {
                  type = "number";
                } else if (tsLib.isArrayLiteralExpression(decl.initializer)) {
                  type = "any[]";
                } else if (tsLib.isObjectLiteralExpression(decl.initializer)) {
                  type = "object";
                }
              }
            }
          });
        }

        tsLib.forEachChild(node, visit);
      } catch (error) {
        // Silenciar errores
      }
    };

    visit(sourceFile);
    return type;
  } catch (error) {
    return null;
  }
}

function inferTypeFromFunctionName(functionName: string): string {
  const nameLower = functionName.toLowerCase();

  if (
    nameLower.includes("get") ||
    nameLower.includes("find") ||
    nameLower.includes("fetch")
  ) {
    if (nameLower.includes("all") || nameLower.includes("list")) {
      return "any[]";
    }
    return "any";
  } else if (nameLower.includes("create") || nameLower.includes("add")) {
    return "any";
  } else if (nameLower.includes("update") || nameLower.includes("modify")) {
    return "UpdateResult";
  } else if (nameLower.includes("delete") || nameLower.includes("remove")) {
    return "DeleteResult";
  } else if (nameLower.includes("validate") || nameLower.includes("check")) {
    return "boolean";
  } else if (nameLower.includes("calculate") || nameLower.includes("compute")) {
    return "number";
  } else if (nameLower.includes("generate") || nameLower.includes("create")) {
    return "string";
  } else if (nameLower.includes("handle") || nameLower.includes("process")) {
    return "void";
  }

  return "any";
}
