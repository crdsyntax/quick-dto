import * as vscode from "vscode";

export const VAULT_STORAGE_KEY = "quickDto.vaultNotes";

interface VaultNotes {
  [key: string]: string[];
}

export function initializeVault(context: vscode.ExtensionContext) {
  try {
    context.globalState.setKeysForSync([VAULT_STORAGE_KEY]);
  } catch {
    // ignore if sync is not available
  }
}

export async function addNoteToVault(
  context: vscode.ExtensionContext,
  key: string,
  note: string,
): Promise<void> {
  const current = (context.globalState.get<VaultNotes>(VAULT_STORAGE_KEY) ??
    {}) as VaultNotes;

  const normalizedKey = key.trim();
  if (!normalizedKey) {
    throw new Error("La clave no puede estar vacía.");
  }

  const notes = current[normalizedKey] ?? [];
  notes.push(note);
  current[normalizedKey] = notes;

  await context.globalState.update(VAULT_STORAGE_KEY, current);
}

export function getNotesFromVault(
  context: vscode.ExtensionContext,
  key: string,
): string[] | undefined {
  const current = (context.globalState.get<VaultNotes>(VAULT_STORAGE_KEY) ??
    {}) as VaultNotes;
  const normalizedKey = key.trim();
  if (!normalizedKey) return undefined;
  return current[normalizedKey];
}

export async function saveNoteFlow(context: vscode.ExtensionContext) {
  const key = await vscode.window.showInputBox({
    prompt: "Clave del baúl donde guardar la anotación",
    placeHolder: "p.ej. cliente-XYZ, sprint-45, idea-api",
    ignoreFocusOut: true,
  });
  if (!key) {
    return;
  }

  const note = await vscode.window.showInputBox({
    prompt: "Escribe la anotación a guardar",
    placeHolder: "Texto de la nota",
    ignoreFocusOut: true,
  });
  if (!note) {
    return;
  }

  try {
    await addNoteToVault(context, key, note);
    vscode.window.showInformationMessage(
      `Anotación guardada en el baúl "${key}".`,
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `No se pudo guardar la anotación: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export async function readNotesFlow(context: vscode.ExtensionContext) {
  const key = await vscode.window.showInputBox({
    prompt: "Clave del baúl a consultar",
    placeHolder: "Misma clave usada al guardar",
    ignoreFocusOut: true,
  });
  if (!key) {
    return;
  }

  const notes = getNotesFromVault(context, key);
  if (!notes || notes.length === 0) {
    vscode.window.showInformationMessage(
      `No hay anotaciones para la clave "${key}".`,
    );
    return;
  }

  const content = notes.map((n, i) => `#${i + 1} ${n}`).join("\n\n---\n\n");
  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: false });
}

