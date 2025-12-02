import * as vscode from "vscode";
import { SmartEntityGenerator } from "../generators/entity.generator";

export class EntityCommand {
  /**
   * Entry point for entity generation
   * Shows options for dictionary-based or manual creation
   */
  public static async generateEntity(uri?: vscode.Uri) {
    try {
      const options = [
        {
          label: "$(database) Desde Diccionario",
          description: "Usa plantillas predefinidas",
          detail: "Selecciona entre entidades comunes preconfiguradas",
        },
        {
          label: "$(edit) Manualmente",
          description: "Crear entidad desde cero",
          detail: "Define manualmente todos los campos y relaciones",
        },
      ];

      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: "¿Cómo quieres crear la entidad?",
        ignoreFocusOut: true,
      });

      if (!selection) {
        return;
      }

      if (selection.label.includes("Diccionario")) {
        await SmartEntityGenerator.generateEntityFromDictionary();
      } else {
          await EntityCommand.generateEntityManually(uri);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Error al iniciar creación de entidad: ${err.message}`
      );
      console.error("Error en generateEntity:", err);
    }
  }

  /**
   * Manual entity generation flow
   * Prompts user for entity details and creates files
   */
  private static async generateEntityManually(uri?: vscode.Uri) {
    try {
      // 1️⃣ Selección del ORM
      const orm = await vscode.window.showQuickPick(
        [
          {
            label: "TypeORM",
            description: "Para aplicaciones NestJS con TypeORM",
            detail: "Genera entidades con decoradores @Entity()",
          },
          {
            label: "Mongoose",
            description: "Para aplicaciones NestJS con MongoDB",
            detail: "Genera esquemas con @Schema()",
          },
        ],
        {
          placeHolder: "Selecciona el ORM",
          ignoreFocusOut: true,
        }
      );

      if (!orm) {
        return;
      }

      const ormType = orm.label;

      // 2️⃣ Nombre de la entidad
      const entityName = await vscode.window.showInputBox({
        prompt: "Nombre de la entidad (PascalCase)",
        placeHolder: "Ej: User, ProductCategory, OrderDetail",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "El nombre es requerido";
          }
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
            return "Debe estar en PascalCase (ej: User, ProductCategory)";
          }
          if (value.length < 2) {
            return "El nombre debe tener al menos 2 caracteres";
          }
          return null;
        },
        ignoreFocusOut: true,
      });

      if (!entityName) {
        return;
      }

      // 3️⃣ Nombre del módulo
      const defaultModule = this.toKebabCase(entityName);
      const moduleName = await vscode.window.showInputBox({
        prompt: "Nombre del módulo (carpeta donde se creará)",
        value: defaultModule,
        placeHolder: defaultModule,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "El nombre del módulo es requerido";
          }
          if (!/^[a-z0-9\-_]+$/.test(value)) {
            return "Solo minúsculas, números, guiones y guiones bajos";
          }
          if (value.includes(" ")) {
            return "No se permiten espacios";
          }
          return null;
        },
        ignoreFocusOut: true,
      });

      if (!moduleName) {
        return;
      }

      // 4️⃣ Confirmar creación
      const confirm = await vscode.window.showWarningMessage(
        `¿Crear entidad "${entityName}" en módulo "${moduleName}" con ${ormType}?`,
        { modal: true },
        "Sí, crear",
        "Cancelar"
      );

      if (confirm !== "Sí, crear") {
        return;
      }

      // 5️⃣ Determinar la ruta base
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage("No se encontró el workspace abierto");
        return;
      }

      // 6️⃣ Obtener estructura de directorios
      const structure = await SmartEntityGenerator["determinePaths"](
        moduleName,
        ormType,
        uri || workspaceRoot
      );

      // 7️⃣ Definición básica de la entidad
      const entityDef = {
        name: entityName,
        description: `${entityName} entity`,
        tableName: this.toSnakeCase(entityName),
        fields: [
          {
            name: "id",
            type: ormType === "TypeORM" ? "number" : "string",
            required: true,
            isRelation: false,
            isPrimary: true,
            decorator:
              ormType === "TypeORM" ? "@PrimaryGeneratedColumn()" : "@Prop()",
            description: "Identificador único",
          },
          {
            name: "name",
            type: "string",
            required: true,
            isRelation: false,
            decorator:
              ormType === "TypeORM" ? "@Column()" : "@Prop({ required: true })",
            description: "Nombre de la entidad",
          },
          {
            name: "isActive",
            type: "boolean",
            required: false,
            default: true,
            isRelation: false,
            decorator:
              ormType === "TypeORM"
                ? "@Column({ default: true })"
                : "@Prop({ default: true })",
            description: "Indica si la entidad está activa",
          },
          {
            name: "createdAt",
            type: "Date",
            required: false,
            default: ormType === "TypeORM" ? "CURRENT_TIMESTAMP" : "Date.now",
            isRelation: false,
            decorator:
              ormType === "TypeORM"
                ? "@CreateDateColumn()"
                : "@Prop({ default: Date.now })",
            description: "Fecha de creación",
          },
          {
            name: "updatedAt",
            type: "Date",
            required: false,
            isRelation: false,
            decorator:
              ormType === "TypeORM" ? "@UpdateDateColumn()" : "@Prop()",
            description: "Fecha de última actualización",
          },
        ],
        relations: [],
        orm: ormType,
      };

      // 8️⃣ Crear archivos
      await SmartEntityGenerator["createEntityFile"](
        entityDef,
        structure,
        ormType
      );
      await SmartEntityGenerator["createModuleFileIfNotExists"](
        entityDef,
        structure,
        ormType
      );

      // 9️⃣ Mostrar notificación de éxito
      vscode.window
        .showInformationMessage(
          `✅ Entidad ${entityName} creada exitosamente en módulo ${moduleName}`,
          "Abrir archivo",
          "Abrir carpeta"
        )
        .then(async (selection) => {
          const fileName = `${this.toKebabCase(entityName)}.${
            ormType === "TypeORM" ? "entity.ts" : "schema.ts"
          }`;
          const filePath = vscode.Uri.joinPath(
            vscode.Uri.file(structure.targetDir),
            fileName
          );

          if (selection === "Abrir archivo") {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
          } else if (selection === "Abrir carpeta") {
            vscode.commands.executeCommand(
              "revealFileInOS",
              vscode.Uri.file(structure.targetDir)
            );
          }
        });
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Error al crear la entidad: ${err.message || "Error desconocido"}`
      );
      console.error("Error detallado en generateEntityManually:", err);
    }
  }

  /**
   * Utility: Convert string to kebab-case
   */
  private static toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/^-/, "");
  }

  /**
   * Utility: Convert string to snake_case
   */
  private static toSnakeCase(str: string): string {
    return str
      .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1_$2")
      .toLowerCase()
      .replace(/^_/, "");
  }

  /**
   * Utility: Convert string to camelCase
   */
  private static toCamelCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
      .replace(/^./, (char) => char.toLowerCase());
  }
}
