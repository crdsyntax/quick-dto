import * as ts from "typescript";

export function generateInterfaceFromReturn(functionCode: string, functionName: string): string {
    const sourceFile = ts.createSourceFile(
        "temp.ts",
        functionCode,
        ts.ScriptTarget.Latest,
        true
    );

    let interfaceContent = `export interface I${capitalize(functionName)}Response {\n`;
    let foundReturn = false;

    function visit(node: ts.Node) {
        if (foundReturn) return;

        if (ts.isReturnStatement(node)) {
            foundReturn = true;
            if (node.expression && ts.isObjectLiteralExpression(node.expression)) {
                node.expression.properties.forEach((prop) => {
                    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
                        const name = prop.name.getText();
                        let type = "any";

                        if (ts.isPropertyAssignment(prop)) {
                            type = inferType(prop.initializer);
                        } else {

                            type = inferTypeFromVariable(name, sourceFile);
                        }

                        interfaceContent += `  ${name}: ${type};\n`;
                    }
                });
            } else {
                interfaceContent += `  // Could not parse object literal from return statement\n`;
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    interfaceContent += `}\n`;
    return interfaceContent;
}

function inferType(node: ts.Expression): string {
    if (ts.isStringLiteral(node)) return "string";
    if (ts.isNumericLiteral(node)) return "number";
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return "boolean";
    if (ts.isArrayLiteralExpression(node)) return "any[]";
    if (ts.isObjectLiteralExpression(node)) return "object";

    if (ts.isCallExpression(node)) {
        const text = node.expression.getText();
        if (text.includes("findOne")) return "any";
        if (text.includes("find")) return "any[]";
    }

    if (ts.isAwaitExpression(node)) {
        return inferType(node.expression);
    }

    return "any";
}

function inferTypeFromVariable(varName: string, sourceFile: ts.SourceFile): string {
    let type = "any";
    // Simple scan for variable declaration
    function visitDecl(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && node.name.getText() === varName) {
            if (node.type) {
                type = node.type.getText();
            } else if (node.initializer) {
                type = inferType(node.initializer);
            }
        }
        ts.forEachChild(node, visitDecl);
    }
    visitDecl(sourceFile);
    return type;
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
