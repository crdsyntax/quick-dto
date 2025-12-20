import * as vscode from "vscode";

export class DtoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "nest-tools.dtoPropertiesView";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case "insertSnippet":
          await this.insertSnippetAndEnsureImports(msg.snippet, msg.imports);
          break;
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const snippet = `  @IsOptional()\n  @IsString()\n  @ApiPropertyOptional({\n    description: \"Example code propert DTO \",\n    example: \"example propert\",\n  })\n  proper?: string;\n`;

    // Simple sidebar UI with draggable item
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding:8px }
    .section { margin-bottom: 12px }
    .item { padding:6px; border-radius:4px; background:var(--vscode-sideBar-background); cursor:grab }
    .item:active { cursor:grabbing }
    button { margin-top:8px }
    .sub { padding-left:8px; margin-top:6px }
  </style>
</head>
<body>
  <div class="section">
    <h3>DTO Properties</h3>
    <div class="sub">
      <div class="item" draggable="true" id="properItem">proper?: string;</div>
      <button id="insertBtn">Insert into active editor</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const snippet = ${JSON.stringify(snippet)};
    const imports = {
      classValidator: ["IsOptional","IsString"],
      swagger: ["ApiPropertyOptional"]
    };

    const item = document.getElementById('properItem');
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', snippet);
    });

    document.getElementById('insertBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'insertSnippet', snippet, imports });
    });
  </script>
</body>
</html>`;
  }

  private async insertSnippetAndEnsureImports(
    snippet: string,
    imports: { classValidator: string[]; swagger: string[] }
  ) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor to insert DTO property.');
      return;
    }

    const doc = editor.document;
    await editor.edit((eb) => {
      const sel = editor.selection;
      eb.insert(sel.active, '\n' + snippet + '\n');
    });

    // Ensure imports
    const text = doc.getText();
    const edit = new vscode.WorkspaceEdit();

    // class-validator
    const cvRegex = /import\s+\{([\s\S]*?)\}\s+from\s+['"]class-validator['"];?/;
    const matchCv = text.match(cvRegex);
    if (matchCv) {
      const existing = matchCv[1];
      const missing = imports.classValidator.filter((i) => !new RegExp('\\b' + i + '\\b').test(existing));
      if (missing.length > 0) {
        const newImport = existing.trim() + (existing.trim() ? ', ' : '') + missing.join(', ');
        const replaceRange = new vscode.Range(doc.positionAt(matchCv.index || 0), doc.positionAt((matchCv.index || 0) + matchCv[0].length));
        const newText = `import { ${newImport} } from 'class-validator';`;
        edit.replace(doc.uri, replaceRange, newText);
      }
    } else {
      // add at top
      edit.insert(doc.uri, new vscode.Position(0, 0), `import { ${imports.classValidator.join(', ')} } from 'class-validator';\n`);
    }

    // @nestjs/swagger
    const swRegex = /import\s+\{([\s\S]*?)\}\s+from\s+['"]@nestjs\/swagger['"];?/;
    const matchSw = text.match(swRegex);
    if (matchSw) {
      const existing = matchSw[1];
      const missing = imports.swagger.filter((i) => !new RegExp('\\b' + i + '\\b').test(existing));
      if (missing.length > 0) {
        const newImport = existing.trim() + (existing.trim() ? ', ' : '') + missing.join(', ');
        const replaceRange = new vscode.Range(doc.positionAt(matchSw.index || 0), doc.positionAt((matchSw.index || 0) + matchSw[0].length));
        const newText = `import { ${newImport} } from '@nestjs/swagger';`;
        edit.replace(doc.uri, replaceRange, newText);
      }
    } else {
      edit.insert(doc.uri, new vscode.Position(0, 0), `import { ${imports.swagger.join(', ')} } from '@nestjs/swagger';\n`);
    }

    await vscode.workspace.applyEdit(edit);
  }
}

export default DtoSidebarProvider;
