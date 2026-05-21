import { 
  CLASS_VALIDATOR_DECORATORS, 
  SWAGGER_DECORATORS, 
  CLASS_TRANSFORMER_DECORATORS, 
  PROPERTY_TEMPLATES 
} from "../constants/dto-sidebar.constants";

export class DtoHtmlGenerator {
  public static generate(): string {
    const makeItemHtml = (name: string, snippet: string) => 
      `<div class="item" draggable="true" data-snippet="${snippet.replace(/"/g, '&quot;')}">${name}</div>`;

    const validatorHtml = CLASS_VALIDATOR_DECORATORS.map((d) => makeItemHtml(d, `@${d}\n`)).join('');
    const swaggerHtml = SWAGGER_DECORATORS.map((d) => makeItemHtml(d, `@${d}\n`)).join('');
    const transformerHtml = CLASS_TRANSFORMER_DECORATORS.map((d) => makeItemHtml(d, `@${d}\n`)).join('');
    const templatesHtml = PROPERTY_TEMPLATES.map(p => makeItemHtml(p.name, p.snippet)).join('');

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
        ${templatesHtml}
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

      const imports = { classValidator: [], swagger: [], transformer: [] };
      const s = lastSnippet;
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
}
