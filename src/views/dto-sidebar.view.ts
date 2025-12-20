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
    const classValidator = [
      "IsDefined()",
      "IsOptional()",
      "IsString()",
      "IsNumber()",
      "IsInt()",
      "IsBoolean()",
      "IsDate()",
      "IsArray()",
      "ValidateNested()",
      "IsEnum()",
      "Length(1, 255)",
      "MinLength(1)",
      "MaxLength(255)",
      "Min(0)",
      "Max(100)",
      "Matches(/regex/)",
      "IsEmail()",
      "IsUUID()",
      "IsPhoneNumber(null)",
      "IsUrl()",
      "IsNotEmpty()",
      "IsPositive()",
      "IsNegative()",
      "IsEmpty()",
      "IsIn([])",
      "IsNotIn([])"
    ];

    const swagger = [
      "ApiProperty({ description: \"Description\", example: \"example\" })",
      "ApiPropertyOptional({ description: \"Description\", example: \"example\" })",
      "ApiHideProperty()"
    ];

    const classTransformer = [
      "Expose()",
      "Exclude()",
      "Type(() => Type)",
      "Transform((value) => value)"
    ];

    const propertyTemplates = [
      {
        name: 'string optional',
        snippet: `@IsOptional()\n@IsString()\n@ApiPropertyOptional({ description: \"Example string\", example: \"text\" })\nmyProp?: string;\n`
      },
      {
        name: 'string required',
        snippet: `@IsString()\n@ApiProperty({ description: \"Example string\", example: \"text\" })\nmyProp: string;\n`
      },
      {
        name: 'number optional',
        snippet: `@IsOptional()\n@IsNumber()\n@ApiPropertyOptional({ description: \"Example number\", example: 1 })\nmyProp?: number;\n`
      },
      {
        name: 'boolean optional',
        snippet: `@IsOptional()\n@IsBoolean()\n@ApiPropertyOptional({ description: \"Example boolean\", example: true })\nmyProp?: boolean;\n`
      },
      {
        name: 'date optional',
        snippet: `@IsOptional()\n@IsDate()\n@ApiPropertyOptional({ description: \"Example date\", example: \"2020-01-01\" })\nmyProp?: Date;\n`
      },
      {
        name: 'array of strings',
        snippet: `@IsOptional()\n@IsArray()\n@IsString({ each: true })\n@ApiPropertyOptional({ isArray: true, example: [\"a\", \"b\"] })\nmyProp?: string[];\n`
      },
      {
        name: 'nested object',
        snippet: `@ValidateNested()\n@Type(() => NestedDto)\n@ApiProperty({ type: () => NestedDto })\nmyProp: NestedDto;\n`
      }
    ];

    function makeItemHtml(name, snippet) {
      return `<div class=\"item\" draggable=\"true\" data-snippet=\"${snippet.replace(/\"/g, '&quot;')}\">${name}</div>`;
    }

    const validatorHtml = classValidator.map((d) => makeItemHtml(d, `@${d}\n`)).join('');
    const swaggerHtml = swagger.map((d) => makeItemHtml(d, `@${d}\n`)).join('');
    const transformerHtml = classTransformer.map((d) => makeItemHtml(d, `@${d}\n`)).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding:8px }
    .section { margin-bottom: 12px }
    .item { padding:6px; border-radius:4px; background:var(--vscode-sideBar-background); cursor:grab; margin:4px 0 }
    .item:active { cursor:grabbing }
    .columns { display:flex; gap:12px }
    .col { flex:1; min-width:120px }
    .col h4 { margin:4px 0 }
    button { margin-top:8px }
    .sub { padding-left:8px; margin-top:6px }
  </style>
</head>
<body>
  <div class="section">
    <h3>DTO Properties</h3>
    <div class="columns">
      <div class="col">
        <h4>class-validator</h4>
        ${validatorHtml}
      </div>
      <div class="col">
        <h4>@nestjs/swagger</h4>
        ${swaggerHtml}
      </div>
      <div class="col">
        <h4>class-transformer</h4>
        ${transformerHtml}
      </div>
      <div class="col">
        <h4>Property Snippets</h4>
        ${propertyTemplates.map(p => makeItemHtml(p.name, p.snippet)).join('')}
      </div>
    </div>
    <div style="margin-top:8px">
      <button id="insertBtn">Insert selected into active editor</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let lastSnippet = null;

    document.querySelectorAll('.item').forEach(it => {
      it.addEventListener('click', () => {
        document.querySelectorAll('.item').forEach(i => i.style.outline = '');
        it.style.outline = '2px solid var(--vscode-focusBorder)';
        lastSnippet = it.getAttribute('data-snippet');
      });
      it.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', it.getAttribute('data-snippet'));
      });
    });

    document.getElementById('insertBtn').addEventListener('click', () => {
      if (!lastSnippet) {
        vscode.postMessage({ command: 'showWarning', text: 'Seleccione un decorador o plantilla para insertar.' });
        return;
      }

      // determine imports required by scanning snippet (collect all decorator names)
      const imports = { classValidator: [], swagger: [], transformer: [] };
      const s = lastSnippet;
      // find all @DecoratorName occurrences
      const matches = Array.from(s.matchAll(/@([A-Za-z0-9_]+)/g)).map(m => m[1]);
      for (const name of matches) {
        if (/^Is|^Validate|^Length|^Min|^Max|^Matches|^Is/.test(name)) {
          imports.classValidator.push(name);
        }
        if (/^Api/.test(name)) {
          imports.swagger.push(name);
        }
        if (/^Expose$|^Exclude$|^Type$|^Transform$/.test(name)) {
          imports.transformer.push(name);
        }
      }

      // dedupe
      imports.classValidator = [...new Set(imports.classValidator)];
      imports.swagger = [...new Set(imports.swagger)];
      imports.transformer = [...new Set(imports.transformer)];

      vscode.postMessage({ command: 'insertSnippet', snippet: lastSnippet, imports });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'setSnippet') {
        lastSnippet = msg.snippet;
      }
    });
  </script>
</body>
</html>`;
  }

  private async insertSnippetAndEnsureImports(
    snippet: string,
    imports: { classValidator: string[]; swagger: string[]; transformer?: string[] }
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

    // class-transformer
    if (imports.transformer && imports.transformer.length > 0) {
      const ctRegex = /import\s+\{([\s\S]*?)\}\s+from\s+['"]class-transformer['"];?/;
      const matchCt = text.match(ctRegex);
      if (matchCt) {
        const existing = matchCt[1];
        const missing = imports.transformer.filter((i) => !new RegExp('\\b' + i + '\\b').test(existing));
        if (missing.length > 0) {
          const newImport = existing.trim() + (existing.trim() ? ', ' : '') + missing.join(', ');
          const replaceRange = new vscode.Range(doc.positionAt(matchCt.index || 0), doc.positionAt((matchCt.index || 0) + matchCt[0].length));
          const newText = `import { ${newImport} } from 'class-transformer';`;
          edit.replace(doc.uri, replaceRange, newText);
        }
      } else {
        edit.insert(doc.uri, new vscode.Position(0, 0), `import { ${imports.transformer.join(', ')} } from 'class-transformer';\n`);
      }
    }

    await vscode.workspace.applyEdit(edit);
  }
}

export default DtoSidebarProvider;
