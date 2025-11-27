import * as path from "path";

export interface ResponseInterfacePayload {
  interfaceName: string;
  content: string;
}

export function buildResponseInterfaces(
  functionText: string
): ResponseInterfacePayload | null {
  const trimmed = functionText.trim();
  if (!trimmed) {
    return null;
  }

  const returnObject = extractReturnBlock(functionText);
  if (!returnObject) {
    return null;
  }

  const interfaces = generateInterfaces(returnObject);
  const fnName = extractFunctionName(functionText) || "ResponseGenerated";

  return {
    interfaceName: fnName,
    content: interfaces.join("\n\n"),
  };
}

function extractFunctionName(fnText: string): string | null {
  const match = fnText.match(/async\s+(\w+)\s*\(/) || fnText.match(/function\s+(\w+)\s*\(/);
  return match ? match[1] : null;
}

function extractReturnBlock(code: string): string | null {
  const idx = code.indexOf("return");
  if (idx < 0) return null;

  const sliced = code.slice(idx);
  const start = sliced.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let endIndex = -1;

  for (let i = start; i < sliced.length; i++) {
    if (sliced[i] === "{") depth++;
    if (sliced[i] === "}") depth--;
    if (depth === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return null;

  return sliced.slice(start, endIndex + 1);
}


function generateInterfaces(returnObj: string): string[] {
  const cleaned = clean(returnObj);
  const structures = extractAllObjectLiterals(cleaned);
  return structures.map((s) => objectLiteralToInterface(s));
}

function extractAllObjectLiterals(text: string): string[] {
  const out: string[] = [];
  const regex = /{[^{}]*}/g;

  function recurse(block: string) {
    let match;
    while ((match = regex.exec(block))) {
      const obj = match[0];
      out.push(obj);
      const inner = block.slice(match.index + 1, match.index + obj.length - 1);
      recurse(inner);
    }
  }

  recurse(text);
  return dedupe(out);
}

function dedupe(arr: string[]) {
  return [...new Set(arr)];
}

function clean(code: string): string {
  return code
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\(.*?\)=>/g, "")
    .replace(/\bas\b\s+\w+/g, "")
    .replace(/\.\.\.[^,}]+/g, "")
    .trim();
}

function objectLiteralToInterface(obj: string): string {
  const entries = extractKeyValues(obj);
  const inferred = entries.map(
    (e) => `  ${e.key}: ${inferType(e.value)};`
  );

  const name = inferInterfaceName(entries);

  return `export interface ${name} {\n${inferred.join("\n")}\n}`;
}

function extractKeyValues(obj: string): { key: string; value: string }[] {
  const inside = obj.slice(1, -1);
  const parts = splitTopLevel(inside);

  return parts
    .map((chunk) => {
      const [key, ...rest] = chunk.split(":");
      if (!rest.length) return null;
      return { key: key.trim(), value: rest.join(":").trim() };
    })
    .filter(Boolean) as any;
}

function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    if (c === "}") depth--;

    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function inferType(value: string): string {
  if (value === "null") return "null";
  if (value.match(/^\d+$/)) return "number";
  if (value.match(/^\d+\.\d+$/)) return "number";
  if (value.match(/true|false/)) return "boolean";
  if (value.match(/['"].*?['"]/)) return "string";
  if (value.startsWith("{")) return inferInterfaceName(extractKeyValues(value));
  if (value.startsWith("[")) return inferArrayType(value);
  if (value.includes(".")) return "any";
  return "any";
}

function inferArrayType(value: string): string {
  const inside = value.slice(1, -1).trim();
  if (!inside) return "any[]";
  return inferType(inside) + "[]";
}

function inferInterfaceName(entries: any[]): string {
  const first = entries[0]?.key || "Anon";
  return capitalize(first);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function findModuleFolder(file: string): string | null {
  const parts = file.split(path.sep);
  const srcIndex = parts.indexOf("src");
  if (srcIndex === -1) return null;

  return path.join(...parts.slice(0, srcIndex + 2));
}
