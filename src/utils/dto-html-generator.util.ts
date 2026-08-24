import {
  CLASS_VALIDATOR_DECORATORS,
  CLASS_TRANSFORMER_DECORATORS,
} from "../constants/dto-sidebar.constants";

const BUILDER_SWAGGER = ["ApiProperty", "ApiPropertyOptional", "ApiHideProperty"];

const PROPERTY_TYPES = [
  "string",
  "number",
  "boolean",
  "Date",
  "object",
  "any",
  "unknown",
  "string[]",
  "number[]",
  "any[]",
  "Record<string, any>",
];

const optionList = (items: string[], placeholder: string): string =>
  `<option value="">${placeholder}</option>` +
  items.map((i) => `<option value="${i.replace(/"/g, "&quot;")}">${i}</option>`).join("");

export class DtoHtmlGenerator {
  public static generate(): string {
    const validatorHtml = CLASS_VALIDATOR_DECORATORS.map(
      (d) =>
        `<label class="check"><input type="checkbox" data-validator value="${d.replace(/"/g, "&quot;")}" /><span>${d}</span></label>`
    ).join("");
    const swaggerHtml = optionList(BUILDER_SWAGGER, "Selecciona swagger…");
    const transformerHtml = optionList(
      CLASS_TRANSFORMER_DECORATORS,
      "Selecciona transformer…"
    );
    const typeHtml = PROPERTY_TYPES.map(
      (i) => `<option value="${i}">${i}</option>`
    ).join("");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding:10px }
    h3 { margin: 0 0 4px; font-size: 13px }
    .hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 10px }
    .builder { display: flex; flex-direction: column; gap: 10px }
    .row { display: flex; flex-direction: column; gap: 3px }
    .row label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--vscode-descriptionForeground) }
    select, input {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 12px;
      box-sizing: border-box;
    }
    .checklist {
      max-height: 150px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 5px;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      cursor: pointer;
      padding: 1px 2px;
      border-radius: 3px;
    }
    .check:hover { background: var(--vscode-list-hoverBackground) }
    .check input {
      width: auto;
      margin: 0;
      cursor: pointer;
      accent-color: var(--vscode-focusBorder);
    }
    .check span { font-family: var(--vscode-editor-font-family, monospace) }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px }
    #propForm { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--vscode-panel-border) }
    button {
      padding: 8px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    button:hover { background: var(--vscode-button-hoverBackground) }
    button:disabled { opacity: 0.5; cursor: not-allowed }
    .preview {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 8px;
      white-space: pre;
      color: var(--vscode-textPreformat-foreground);
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <h3>Constructor de Propiedades DTO</h3>
  <div class="hint">Selecciona ApiProperty, uno o varios validadores de class-validator y opcionalmente un transformer. Luego indica el nombre y tipo, y envíalo al cursor del editor.</div>

  <div class="builder">
    <div class="cols">
      <div class="row">
        <label>@nestjs/swagger</label>
        <select id="selSwagger">${swaggerHtml}</select>
      </div>
      <div class="row">
        <label>class-validator (varios)</label>
        <div id="validatorList" class="checklist">${validatorHtml}</div>
      </div>
      <div class="row">
        <label>class-transformer</label>
        <select id="selTransformer">${transformerHtml}</select>
      </div>
      <div class="row">
        <label>Tipo</label>
        <select id="propType">${typeHtml}</select>
      </div>
    </div>

    <div id="propForm">
      <div class="row">
        <label>Nombre de la propiedad</label>
        <input id="propName" type="text" placeholder="ej. email" autocomplete="off" />
      </div>
      <div id="preview" class="preview"></div>
      <button id="sendBtn" disabled>Enviar al código</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const selSwagger = document.getElementById('selSwagger');
    const validatorList = document.getElementById('validatorList');
    const selTransformer = document.getElementById('selTransformer');
    const propType = document.getElementById('propType');
    const propName = document.getElementById('propName');
    const sendBtn = document.getElementById('sendBtn');
    const preview = document.getElementById('preview');

    const getValidators = () =>
      Array.from(validatorList.querySelectorAll('input[data-validator]:checked')).map(
        (c) => c.value
      );

    const hasSelection = () =>
      selSwagger.value || getValidators().length > 0 || selTransformer.value;

    const buildSnippet = () => {
      const decorators = [];
      if (selSwagger.value) decorators.push('@' + selSwagger.value + '()');
      getValidators().forEach((v) => decorators.push('@' + v));
      if (selTransformer.value) decorators.push('@' + selTransformer.value);
      const name = propName.value.trim();
      if (!name) return decorators.join('\\n');
      return decorators.join('\\n') + '\\n' + name + ': ' + propType.value + ';';
    };

    const update = () => {
      const name = propName.value.trim();
      const snippet = hasSelection() ? buildSnippet() : '';
      preview.textContent = snippet;
      preview.style.display = snippet ? 'block' : 'none';
      sendBtn.disabled = !name || !hasSelection();
    };

    [selSwagger, selTransformer, propType].forEach((el) =>
      el.addEventListener('change', update)
    );
    validatorList.addEventListener('change', (e) => {
      if (e.target && e.target.matches && e.target.matches('input[data-validator]')) update();
    });
    propName.addEventListener('input', update);

    sendBtn.addEventListener('click', () => {
      const name = propName.value.trim();
      if (!hasSelection()) {
        vscode.postMessage({ command: 'showWarning', text: 'Selecciona al menos un decorador.' });
        return;
      }
      if (!name) {
        vscode.postMessage({ command: 'showWarning', text: 'Ingresa el nombre de la propiedad.' });
        return;
      }

      const snippet = buildSnippet();

      // Determinar imports necesarios a partir de los decoradores usados
      const imports = { classValidator: [], swagger: [], transformer: [] };
      const matches = Array.from(snippet.matchAll(/@([A-Za-z0-9_]+)/g)).map((m) => m[1]);
      for (const dec of matches) {
        if (/^Is|^Validate|^Length|^Min|^Max|^Matches/.test(dec)) {
          imports.classValidator.push(dec);
        }
        if (/^Api/.test(dec)) {
          imports.swagger.push(dec);
        }
        if (/^Expose$|^Exclude$|^Type$|^Transform$/.test(dec)) {
          imports.transformer.push(dec);
        }
      }
      imports.classValidator = [...new Set(imports.classValidator)];
      imports.swagger = [...new Set(imports.swagger)];
      imports.transformer = [...new Set(imports.transformer)];

      vscode.postMessage({ command: 'insertSnippet', snippet, imports });
    });

    update();
  </script>
</body>
</html>`;
  }
}
