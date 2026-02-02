import * as vscode from "vscode";

export async function addLoggerDebugCommand() {
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
        "Could not determine where to add logger in the class",
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
      `Logger debug statement added for: ${functionName}`,
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error: ${error.message}`);
  }
}

async function getCurrentFunctionName(
  editor: vscode.TextEditor,
  position: vscode.Position,
): Promise<string> {
  const document = editor.document;
  let currentLine = position.line;
  while (currentLine >= 0) {
    const lineText = document.lineAt(currentLine).text;
    const functionMatch = lineText.match(
      /(public|private|protected)?\s*(async)?\s*(\w+)\s*\([^)]*\)/,
    );
    const arrowFunctionMatch = lineText.match(
      /(public|private|protected)?\s*(\w+)\s*=\s*\([^)]*\)\s*=>/,
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
  className: string,
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
  className: string,
): Promise<boolean | null> {
  const document = editor.document;
  const text = document.getText();
  const classMatch = text.match(/class\s+(\w+)/);
  if (!classMatch || !classMatch.index) {
    return null;
  }

  const openBraceIndex = text.indexOf("{", classMatch.index);
  if (openBraceIndex === -1) {
    return null;
  }

  const insertPosition = document.positionAt(openBraceIndex + 1);
  const classLine = document.positionAt(classMatch.index).line;
  const baseIndentation = getIndentationAtLine(document, classLine);

  // Try to detect if the class uses tabs or spaces
  const indentType = text.includes("\t") ? "\t" : "  ";
  const innerIndentation = baseIndentation + indentType;

  await editor.edit((editBuilder) => {
    const loggerProperty = `\n${innerIndentation}private readonly logger = new Logger(${className}.name);\n`;
    editBuilder.insert(insertPosition, loggerProperty);
  });

  return true;
}

function getIndentationAtLine(
  document: vscode.TextDocument,
  line: number,
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
