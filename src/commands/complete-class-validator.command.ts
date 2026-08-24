import * as vscode from "vscode";
import { ImportManager } from "../utils/dto-import.util";
import { DtoImports } from "../types/dto-sidebar.types";

const PRIMITIVES: Record<string, string> = {
  number: "number",
  string: "string",
  boolean: "boolean",
  Date: "date",
};

const EXISTING_VALIDATOR =
  /^\s*@(Is[A-Z]\w*|Validate\w*|Min\(|Max\(|Length\(|Matches\(|Type\(|Expose|Transform)/;

const PROP_DECLARATION =
  /^(\s*)(?:readonly\s+)?([A-Za-z_]\w*)(\?)?\s*[!]?\s*:\s*(.+?);\s*$/;

interface PropInfo {
  line: number;
  indent: string;
  typeText: string;
  optional: boolean;
  enumName?: string;
}

function collectPropInfo(
  lines: string[],
  index: number,
  match: RegExpMatchArray
): PropInfo | null {
  const blockLines: string[] = [];
  let hasValidator = false;
  let j = index - 1;
  while (j >= 0 && /^\s*@/.test(lines[j])) {
    if (EXISTING_VALIDATOR.test(lines[j])) {
      hasValidator = true;
    }
    blockLines.unshift(lines[j]);
    j--;
  }
  if (hasValidator) return null;

  const block = blockLines.join("\n");
  const enumMatch = block.match(/enum:\s*([A-Za-z_]\w*)/);
  const requiredFalse = /required:\s*false/.test(block);
  const nullableTrue = /nullable:\s*true/.test(block);

  let typeText = match[4].trim();
  const optional =
    !!match[3] || /\|\s*(null|undefined)\b/.test(typeText) || requiredFalse || nullableTrue;

  return {
    line: index,
    indent: match[1],
    typeText,
    optional,
    enumName: enumMatch ? enumMatch[1] : undefined,
  };
}

function buildValidatorLines(info: PropInfo, imports: DtoImports): string[] {
  const { indent } = info;

  const raw = info.typeText.replace(/\|\s*(null|undefined)\b/g, "").trim();
  const tokens = raw.split("|").map((t) => t.trim()).filter(Boolean);
  if (tokens.length !== 1) return [];
  const t = tokens[0];

  const pushPrimitive = (type: string) => {
    let name: string;
    let line: string;
    if (type === "number") {
      // IsNumber(options: IsNumberOptions, validationOptions?: ValidationOptions)
      name = "IsNumber";
      line = `${indent}@IsNumber({}, { message: "Please chose a valid number." })`;
    } else {
      name =
        type === "string" ? "IsString" : type === "boolean" ? "IsBoolean" : "IsDate";
      // IsString/IsBoolean/IsDate(validationOptions?: ValidationOptions)
      line = `${indent}@${name}({ message: "Please chose a valid ${type}." })`;
    }
    imports.classValidator.push(name);
    return line;
  };

  const pushNested = (name: string, each = false): string[] => {
    imports.classValidator.push("ValidateNested");
    imports.transformer.push("Type");
    return [
      `${indent}@ValidateNested(${each ? "{ each: true }" : ""})`,
      `${indent}@Type(() => ${name})`,
    ];
  };

  const lines: string[] = [];

  const arrayMatch = t.match(/^(?:Array<([\s\S]+)>|(.+)\[\])$/);
  if (arrayMatch) {
    const inner = (arrayMatch[1] || arrayMatch[2] || "").trim();
    imports.classValidator.push("IsArray");
    lines.push(`${indent}@IsArray({ message: "Please chose a valid list." })`);

    if (/^\{[\s\S]*\}$/.test(inner)) {
      // arreglo de objetos inline: solo IsArray
    } else if (PRIMITIVES[inner]) {
      lines.push(pushPrimitive(PRIMITIVES[inner]));
    } else if (/^[A-Za-z_]\w*$/.test(inner)) {
      if (info.enumName === inner) {
        imports.classValidator.push("IsEnum");
        lines.push(
          `${indent}@IsEnum(${inner}, { message: "Please chose a valid value." })`
        );
      } else {
        lines.push(...pushNested(inner, true));
      }
    }
  } else if (info.enumName && /^[A-Za-z_]\w*$/.test(t)) {
    imports.classValidator.push("IsEnum");
    lines.push(
      `${indent}@IsEnum(${info.enumName}, { message: "Please chose a valid value." })`
    );
  } else if (PRIMITIVES[t]) {
    lines.push(pushPrimitive(PRIMITIVES[t]));
  } else if (/^[A-Za-z_]\w*$/.test(t)) {
    lines.push(...pushNested(t));
  } else {
    return [];
  }

  if (info.optional) {
    imports.classValidator.push("IsOptional");
    lines.unshift(`${indent}@IsOptional()`);
  }

  return lines;
}

export async function completeClassValidatorCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No hay un archivo abierto.");
    return;
  }

  const document = editor.document;
  if (
    document.languageId !== "typescript" &&
    document.languageId !== "javascript"
  ) {
    vscode.window.showWarningMessage(
      "Este comando solo aplica a archivos TypeScript/JavaScript."
    );
    return;
  }

  const lines = document.getText().split(/\r?\n/);
  const edits: Array<{ position: vscode.Position; text: string }> = [];
  const imports: DtoImports = { classValidator: [], swagger: [], transformer: [] };

  // depth === 1 => dentro del cuerpo de una clase (evita claves de objetos inline)
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(PROP_DECLARATION);

    if (match && depth === 1) {
      const info = collectPropInfo(lines, i, match);
      if (info) {
        const validatorLines = buildValidatorLines(info, imports);
        if (validatorLines.length > 0) {
          edits.push({
            position: new vscode.Position(i, 0),
            text: validatorLines.join("\n") + "\n",
          });
        }
      }
    }

    for (const ch of line) {
      if (ch === "{" || ch === "(" || ch === "[") depth++;
      else if (ch === "}" || ch === ")" || ch === "]") depth--;
    }
  }

  if (edits.length === 0) {
    vscode.window.showInformationMessage(
      "No se encontraron propiedades sin validar para completar."
    );
    return;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    workspaceEdit.insert(document.uri, edit.position, edit.text);
  }
  await vscode.workspace.applyEdit(workspaceEdit);

  imports.classValidator = [...new Set(imports.classValidator)];
  imports.swagger = [...new Set(imports.swagger)];
  imports.transformer = [...new Set(imports.transformer)];
  await ImportManager.ensureImports(document, imports);

  vscode.window.showInformationMessage(
    `✅ ${edits.length} propiedad(es) completadas con class-validator.`
  );
}
