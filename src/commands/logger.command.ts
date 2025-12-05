import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('nest-tools.addLoggerDebug', async () => {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            vscode.window.showWarningMessage('Please select some text first');
            return;
        }

        try {
            const functionName = await getCurrentFunctionName(editor, selection.start);
            
            const loggerExists = await checkLoggerExists(editor);
            
            if (!loggerExists) {
                vscode.window.showWarningMessage('Logger not found in class. Add: private readonly logger = new Logger(ClassName.name)');
                return;
            }

            const className = await getClassName(editor);
            
            const debugStatement = `this.logger.debug("${functionName}", ${selectedText});`;
            
            await editor.edit(editBuilder => {
                const currentLine = editor.document.lineAt(selection.end.line + 1);
                editBuilder.insert(currentLine.range.start, `\n\t\t${debugStatement}`);
            });

            vscode.window.showInformationMessage(`Logger debug statement added for: ${functionName}`);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

async function getCurrentFunctionName(editor: vscode.TextEditor, position: vscode.Position): Promise<string> {
    const document = editor.document;
    let currentLine = position.line;
    
    while (currentLine >= 0) {
        const lineText = document.lineAt(currentLine).text;
        
        const functionMatch = lineText.match(/(public|private|protected)?\s*(async)?\s*(\w+)\s*\([^)]*\)/);
        const arrowFunctionMatch = lineText.match(/(public|private|protected)?\s*(\w+)\s*=\s*\([^)]*\)\s*=>/);
        
        if (functionMatch && functionMatch[3]) {
            return functionMatch[3];
        } else if (arrowFunctionMatch && arrowFunctionMatch[2]) {
            return arrowFunctionMatch[2];
        }
        
        currentLine--;
    }
    
    return 'anonymousFunction';
}

async function checkLoggerExists(editor: vscode.TextEditor): Promise<boolean> {
    const document = editor.document;
    const text = document.getText();
    
    const loggerPatterns = [
        /private\s+readonly\s+logger\s*=\s*new\s+Logger\([^)]+\.name\)/,
        /private\s+logger\s*=\s*new\s+Logger\([^)]+\.name\)/,
        /protected\s+readonly\s+logger\s*=\s*new\s+Logger\([^)]+\.name\)/,
        /readonly\s+logger\s*=\s*new\s+Logger\([^)]+\.name\)/,
        /logger\s*=\s*new\s+Logger\([^)]+\)/
    ];
    
    return loggerPatterns.some(pattern => pattern.test(text));
}

async function getClassName(editor: vscode.TextEditor): Promise<string> {
    const document = editor.document;
    const text = document.getText();
    
    const classMatch = text.match(/class\s+(\w+)/);
    if (classMatch && classMatch[1]) {
        return classMatch[1];
    }
    
    return 'UnknownClass';
}

export function deactivate() {}