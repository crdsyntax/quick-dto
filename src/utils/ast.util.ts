// src/utils/astUtils.ts
import * as ts from "typescript";

export function getInferredReturnType(sourceFile: ts.SourceFile, position: ts.LineAndCharacter): string {
  let inferred = "void";

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

      if (
        start.line <= position.line &&
        position.line <= end.line &&
        node.body
      ) {
        ts.forEachChild(node.body, bodyNode => {
          inferFromNode(bodyNode);
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  const inferFromNode = (node: ts.Node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      inferred = getTypeFromExpression(node.expression) || inferred;
    }

    if (ts.isAwaitExpression(node) && node.expression) {
      const awaited = getTypeFromExpression(node.expression);
      if (awaited) inferred = awaited;
    }

    if (ts.isCallExpression(node)) {
      const callSig = node.expression.getText();
      const typeArg = node.typeArguments?.[0];

      // save(...) → retorna la entidad
      if (callSig.includes(".save(")) {
        const arg = node.arguments[0];
        if (arg) inferred = getTypeFromExpression(arg) || inferred;
      }

      // findOne(...) → retorna entidad | null → Promise<Entidad>
      if (callSig.includes(".findOne")) {
        const entityType = extractEntityFromRepositoryCall(callSig);
        if (entityType) inferred = entityType;
      }

      // find(...) → Promise<Entidad[]>
      if (callSig.includes(".find(")) {
        const entityType = extractEntityFromRepositoryCall(callSig);
        if (entityType) inferred = `${entityType}[]`;
      }
    }
  };

  const getTypeFromExpression = (expr: ts.Expression): string | null => {
    const text = expr.getText();

    // new Product() → Product
    if (text.startsWith("new ")) {
      return text.split("new ")[1].split("(")[0].trim();
    }

    // repository.save(product) → product es Product
    if (ts.isPropertyAccessExpression(expr) && text.includes(".save")) {
      const obj = (expr.expression as any).getText();
      if (obj.match(/^[a-z]/)) {
        return inferTypeFromVariable(obj);
      }
    }

    // Directo: product, user, etc.
    if (ts.isIdentifier(expr)) {
      return inferTypeFromVariable(text);
    }

    return null;
  };

  const extractEntityFromRepositoryCall = (call: string): string | null => {
    const match = call.match(/(\w+)Repository\.\w+/);
    if (match) {
      const repoName = match[1];
      return repoName.replace("Repository", "");
    }
    return null;
  };

  const inferTypeFromVariable = (varName: string): string | null => {
    let found: string | null = null;

    const findInParams = (node: ts.Node) => {
      if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === varName) {
        if (node.type && ts.isTypeReferenceNode(node.type)) {
          found = node.type.typeName.getText();
        }
      }
      ts.forEachChild(node, findInParams);
    };

    ts.forEachChild(sourceFile, node => {
      if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.parameters) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        if (start.line <= position.line && position.line <= end.line) {
          node.parameters.forEach(p => findInParams(p));
        }
      }
    });

    return found;
  };

  visit(sourceFile);
  return inferred;
}