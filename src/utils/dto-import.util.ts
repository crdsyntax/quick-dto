import * as vscode from 'vscode';
import { DtoImports } from '../types/dto-sidebar.types';

export class ImportManager {
  public static async ensureImports(document: vscode.TextDocument, imports: DtoImports): Promise<void> {
    const text = document.getText();
    const edit = new vscode.WorkspaceEdit();

    this.processImport(edit, document, text, 'class-validator', imports.classValidator);
    this.processImport(edit, document, text, '@nestjs/swagger', imports.swagger);
    this.processImport(edit, document, text, 'class-transformer', imports.transformer);

    await vscode.workspace.applyEdit(edit);
  }

  private static processImport(
    edit: vscode.WorkspaceEdit,
    doc: vscode.TextDocument,
    text: string,
    library: string,
    neededImports: string[]
  ): void {
    if (!neededImports || neededImports.length === 0) return;

    const regex = new RegExp(`import\\s+\\{([\\s\\S]*?)\\}\\s+from\\s+['"]${library.replace('/', '\\/')}['"];?`);
    const match = text.match(regex);

    if (match) {
      const existing = match[1];
      const missing = neededImports.filter((i) => !new RegExp('\\b' + i + '\\b').test(existing));
      if (missing.length > 0) {
        const newImport = existing.trim() + (existing.trim() ? ', ' : '') + missing.join(', ');
        const replaceRange = new vscode.Range(
          doc.positionAt(match.index || 0),
          doc.positionAt((match.index || 0) + match[0].length)
        );
        const newText = `import { ${newImport} } from '${library}';`;
        edit.replace(doc.uri, replaceRange, newText);
      }
    } else {
      edit.insert(doc.uri, new vscode.Position(0, 0), `import { ${neededImports.join(', ')} } from '${library}';\n`);
    }
  }
}
