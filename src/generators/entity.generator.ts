import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  DataDictionary,
  EntityDefinition,
} from "../dictionaries/data.dictionary";

export class SmartEntityGenerator {
  public static async generateEntityFromDictionary() {
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel:
        "Seleccionar carpeta del módulo (Cancelar para usar diccionario)",
    });

    let selectedModuleName: string | undefined;
    let selectedModuleUri: vscode.Uri | undefined;

    if (folderUris && folderUris.length > 0) {
      selectedModuleUri = folderUris[0];
      selectedModuleName = path.basename(selectedModuleUri.fsPath);
    } else {
      const availableModules = DataDictionary.getAvailableModules();
      const selectedModule = await vscode.window.showQuickPick(
        availableModules,
        {
          placeHolder: "Selecciona un módulo del diccionario",
        }
      );
      if (!selectedModule) return;
      selectedModuleName = selectedModule;
    }

    const moduleEntities =
      DataDictionary.getModuleEntities(selectedModuleName || "") || [];
    const entityOptions = moduleEntities.map((e) => ({
      label: e.name,
      description: e.description,
      detail: `${e.fields.length} campos • ${e.relations.length} relaciones`,
    }));

    const selectedORM = await vscode.window.showQuickPick(
      ["TypeORM", "Mongoose"],
      {
        placeHolder: "Selecciona el ORM",
      }
    );
    if (!selectedORM) return;

    const convention = this.determineNamingConventionFromModuleName(
      selectedModuleName || ""
    );

    const structure = await this.determinePaths(
      selectedModuleName || "",
      selectedORM,
      selectedModuleUri
    );

    try {
      while (true) {
        let entityDef: EntityDefinition | undefined;

        if (entityOptions.length > 0) {
          const selectedEntity = await vscode.window.showQuickPick(
            entityOptions,
            {
              placeHolder:
                "Selecciona la entidad a generar (Esc para cancelar)",
            }
          );
          if (!selectedEntity) break;
          entityDef = moduleEntities.find(
            (e) => e.name === selectedEntity.label
          );
          if (!entityDef) break;
        } else {
          const inputName = await vscode.window.showInputBox({
            prompt: "Nombre de la entidad (Cancelar para salir)",
          });
          if (!inputName) break;

          entityDef = {
            name: inputName,
            description: "",
            tableName: "",
            fields: [],
            relations: [],
          } as unknown as EntityDefinition;
        }

        await this.createEntityFile(entityDef, structure, selectedORM);
        await this.createModuleFileIfNotExists(
          entityDef,
          structure,
          selectedORM
        );

        vscode.window.showInformationMessage(
          `Entidad ${entityDef.name} generada en ${structure.moduleDir}`
        );

        const again = await vscode.window.showQuickPick(
          ["Crear otra entidad", "Terminar"],
          { placeHolder: "¿Crear otra entidad en este módulo?" }
        );
        if (again !== "Crear otra entidad") break;
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  }

  private static async determinePaths(
    moduleName: string,
    orm: string,
    moduleUri?: vscode.Uri
  ) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot)
      throw new Error("No se encontró la carpeta del proyecto");

    const moduleDirName = moduleUri
      ? path.basename(moduleUri.fsPath)
      : this.toKebabCase(moduleName);
    const moduleDir = moduleUri
      ? moduleUri.fsPath
      : path.join(workspaceRoot, "src", moduleDirName);

    const entitiesDir = path.join(moduleDir, "entities");
    const schemasDir = path.join(moduleDir, "schemas");

    return {
      workspaceRoot,
      moduleDir,
      moduleDirName,
      entitiesDir,
      schemasDir,
      orm,
      targetDir: orm === "TypeORM" ? entitiesDir : schemasDir,
    };
  }

  private static async createEntityFile(
    entityDef: EntityDefinition,
    structure: any,
    orm: string
  ) {
    if (!fs.existsSync(structure.targetDir)) {
      fs.mkdirSync(structure.targetDir, { recursive: true });
    }

    const fileName = `${this.toKebabCase(entityDef.name)}${
      orm === "TypeORM" ? ".entity.ts" : ".schema.ts"
    }`;
    const filePath = path.join(structure.targetDir, fileName);

    if (fs.existsSync(filePath)) {
      const overwrite = await vscode.window.showWarningMessage(
        `El archivo ya existe: ${fileName}`,
        { modal: true },
        "Sobrescribir"
      );
      if (overwrite !== "Sobrescribir") return;
    }

    const content =
      orm === "TypeORM"
        ? this.generateTypeORMEntity(entityDef)
        : this.generateMongooseSchema(entityDef);

    fs.writeFileSync(filePath, content, "utf8");
  }

  private static async createModuleFileIfNotExists(
    entityDef: EntityDefinition,
    structure: any,
    orm: string
  ) {
    const modulePath = path.join(
      structure.moduleDir,
      `${structure.moduleDirName}.module.ts`
    );
    if (!fs.existsSync(modulePath)) {
      const moduleContent =
        orm === "TypeORM"
          ? this.generateTypeORMModule(entityDef, structure.moduleDirName)
          : this.generateMongooseModule(entityDef, structure.moduleDirName);

      fs.writeFileSync(modulePath, moduleContent, "utf8");
      return;
    }

    try {
      const content = fs.readFileSync(modulePath, "utf8");
      const updated = this.updateModuleFileWithEntity(
        content,
        entityDef,
        structure,
        orm
      );
      if (updated !== content) {
        fs.writeFileSync(modulePath, updated, "utf8");
      }
    } catch (err) {}
  }

  private static updateModuleFileWithEntity(
    content: string,
    entityDef: EntityDefinition,
    structure: any,
    orm: string
  ) {
    let updated = content;
    const entityImportPath =
      orm === "TypeORM"
        ? `./entities/${this.toKebabCase(entityDef.name)}.entity`
        : `./schemas/${this.toKebabCase(entityDef.name)}.schema`;

    const importLine =
      orm === "TypeORM"
        ? `import { ${entityDef.name} } from '${entityImportPath}';`
        : `import { ${entityDef.name}, ${entityDef.name}Schema } from '${entityImportPath}';`;

    if (!new RegExp(`import\s+\{[^}]*${entityDef.name}[^}]*\}`).test(updated)) {
      const importsEnd = updated.lastIndexOf("import ");
      const firstNewlineAfter = updated.indexOf("\n", importsEnd);

      updated = importLine + "\n" + updated;
    }

    if (orm === "TypeORM") {
      const forFeatureRegex =
        /TypeOrmModule\.forFeature\s*\(\s*\[([\s\S]*?)\]\s*\)/m;
      const match = updated.match(forFeatureRegex);
      if (match) {
        const inside = match[1];
        if (!new RegExp(`\b${entityDef.name}\b`).test(inside)) {
          const newInside =
            inside.trim().length === 0
              ? `  ${entityDef.name} `
              : inside + `, ${entityDef.name}`;
          updated = updated.replace(
            forFeatureRegex,
            `TypeOrmModule.forFeature([${newInside}])`
          );
        }
      } else {
        const moduleImportsRegex =
          /@Module\s*\(\s*\{([\s\S]*?)\}\s*\)\s*export\s+class/m;
        const m = updated.match(moduleImportsRegex);
        if (m) {
          const moduleBody = m[1];
          if (/imports\s*:\s*\[/.test(moduleBody)) {
            updated = updated.replace(
              /imports\s*:\s*\[/,
              `imports: [TypeOrmModule.forFeature([${entityDef.name}]), `
            );
          } else {
            updated = updated.replace(
              moduleImportsRegex,
              `@Module({${moduleBody}, imports: [TypeOrmModule.forFeature([${entityDef.name}])] }) export class`
            );
          }
        }
      }
    } else {
      const forFeatureRegex =
        /MongooseModule\.forFeature\s*\(\s*\[([\s\S]*?)\]\s*\)/m;
      const schemaEntry = `{ name: ${entityDef.name}.name, schema: ${entityDef.name}Schema }`;
      const match = updated.match(forFeatureRegex);
      if (match) {
        const inside = match[1];
        if (!inside.includes(schemaEntry)) {
          const newInside =
            inside.trim().length === 0
              ? `  ${schemaEntry} `
              : inside + `, ${schemaEntry}`;
          updated = updated.replace(
            forFeatureRegex,
            `MongooseModule.forFeature([${newInside}])`
          );
        }
      } else {
        const moduleImportsRegex =
          /@Module\s*\(\s*\{([\s\S]*?)\}\s*\)\s*export\s+class/m;
        const m = updated.match(moduleImportsRegex);
        if (m) {
          const moduleBody = m[1];
          if (/imports\s*:\s*\[/.test(moduleBody)) {
            updated = updated.replace(
              /imports\s*:\s*\[/,
              `imports: [MongooseModule.forFeature([${schemaEntry}]), `
            );
          } else {
            updated = updated.replace(
              moduleImportsRegex,
              `@Module({${moduleBody}, imports: [MongooseModule.forFeature([${schemaEntry}])] }) export class`
            );
          }
        }
      }
    }

    return updated;
  }

  private static generateTypeORMEntity(entityDef: EntityDefinition): string {
    const tableName = entityDef.tableName || this.toSnakeCase(entityDef.name);
    const kebabName = this.toKebabCase(entityDef.name);

    let imports = `import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';\n`;
    let content = `\n@Entity('${tableName}')\nexport class ${entityDef.name} {\n`;
    content += `  @PrimaryGeneratedColumn('uuid')\n  id!: string;\n\n`;

    entityDef.fields.forEach((field) => {
      if (field.isRelation) return;

      const type = this.mapTsToSqlType(field.type);
      const options: string[] = [`type: '${type}'`];
      if (!field.required) options.push("nullable: true");
      if (field.default !== undefined)
        options.push(`default: ${JSON.stringify(field.default)}`);
      if (field.validation?.includes("unique")) options.push("unique: true");

      content += `  @Column({ ${options.join(", ")} })\n`;
      content += `  ${field.name}${field.required ? "" : "?"}: ${
        field.type
      };\n\n`;
    });

    if (entityDef.fields.some((f) => f.name === "createdAt")) {
      content += `  @CreateDateColumn()\n  createdAt!: Date;\n\n`;
    }
    if (entityDef.fields.some((f) => f.name === "updatedAt")) {
      content += `  @UpdateDateColumn()\n  updatedAt!: Date;\n\n`;
    }

    content += `}\n`;
    return imports + content;
  }

  private static generateMongooseSchema(entityDef: EntityDefinition): string {
    const collectionName =
      entityDef.tableName || this.toSnakeCase(entityDef.name);

    let content = `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';\nimport { Document } from 'mongoose';\n\n`;
    content += `export type ${entityDef.name}Document = ${entityDef.name} & Document;\n\n`;
    content += `@Schema({ timestamps: true, collection: '${collectionName}' })\n`;
    content += `export class ${entityDef.name} {\n`;

    entityDef.fields.forEach((field) => {
      if (field.isRelation) return;

      const type = this.mapTsToMongooseType(field.type);
      const options: string[] = [`type: ${type}`];
      if (field.required) options.push("required: true");
      if (field.default !== undefined)
        options.push(`default: ${JSON.stringify(field.default)}`);
      if (field.validation?.includes("unique")) options.push("unique: true");

      content += `  @Prop({ ${options.join(", ")} })\n`;
      content += `  ${field.name}${field.required ? "" : "?"}: ${
        field.type
      };\n\n`;
    });

    content += `}\n\n`;
    content += `export const ${entityDef.name}Schema = SchemaFactory.createForClass(${entityDef.name});\n`;
    return content;
  }

  private static generateTypeORMModule(
    entityDef: EntityDefinition,
    moduleDirName: string
  ): string {
    const className = this.toPascalCase(moduleDirName) + "Module";
    const entityImport = this.toKebabCase(entityDef.name);
    return `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${entityDef.name} } from './entities/${entityImport}.entity';

@Module({
  imports: [TypeOrmModule.forFeature([${entityDef.name}])],
  exports: [TypeOrmModule],
})
export class ${className} {}
`;
  }

  private static generateMongooseModule(
    entityDef: EntityDefinition,
    moduleDirName: string
  ): string {
    const className = this.toPascalCase(moduleDirName) + "Module";
    const schemaImport = this.toKebabCase(entityDef.name);
    return `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${entityDef.name}, ${entityDef.name}Schema } from './schemas/${schemaImport}.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ${entityDef.name}.name, schema: ${entityDef.name}Schema }
    ])
  ],
  exports: [MongooseModule],
})
export class ${className} {}
`;
  }

  private static toKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }

  private static toSnakeCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  }

  private static toPascalCase(str: string): string {
    return str.replace(/(^\w|-\w)/g, (c) => c.replace("-", "").toUpperCase());
  }

  private static mapTsToSqlType(type: string): string {
    const map: Record<string, string> = {
      string: "varchar",
      number: "int",
      boolean: "boolean",
      Date: "timestamp",
      text: "text",
      json: "json",
    };
    return map[type] || "varchar";
  }

  private static mapTsToMongooseType(type: string): string {
    const map: Record<string, string> = {
      string: "String",
      number: "Number",
      boolean: "Boolean",
      Date: "Date",
    };
    return map[type] || "String";
  }

  private static determineNamingConventionFromModuleName(
    moduleName: string
  ): string {
    if (!moduleName) return "kebab-case";
    const lower = moduleName.toLowerCase();
    if (moduleName.includes("-")) return "kebab-case";
    if (moduleName.includes("_")) return "snake_case";
    if (moduleName[0] && moduleName[0] === moduleName[0].toUpperCase())
      return "PascalCase";
    if (/[A-Z]/.test(moduleName)) return "camelCase";
    if (lower === "manual") return "kebab-case";
    return "kebab-case";
  }
}
