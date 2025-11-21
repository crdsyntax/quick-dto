import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class OrmConverter {
  public static async convertOrm() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No hay archivo abierto");
      return;
    }

    const document = editor.document;
    const fileContent = document.getText();
    const fileName = path.basename(document.fileName);

    const isTypeORM =
      fileContent.includes("typeorm") || fileContent.includes("@Entity");
    const isMongoose =
      fileContent.includes("mongoose") || fileContent.includes("@Schema");

    if (!isTypeORM && !isMongoose) {
      vscode.window.showErrorMessage(
        "No se detectó entidad TypeORM o Mongoose"
      );
      return;
    }

    const options = [];
    if (isTypeORM) {
      options.push({
        label: "$(arrow-right) TypeORM → Mongoose",
        description: "Convertir entidad TypeORM a Mongoose",
        detail: "Generará schema de Mongoose con decoradores @Prop",
      });
    }
    if (isMongoose) {
      options.push({
        label: "$(arrow-left) Mongoose → TypeORM",
        description: "Convertir entidad Mongoose a TypeORM",
        detail: "Generará entidad TypeORM con decoradores @Column",
      });
    }

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: "Selecciona el tipo de conversión",
    });

    if (!selected) return;

    try {
      let convertedContent: string;
      let newFileName: string;

      if (selected.label.includes("TypeORM → Mongoose")) {
        convertedContent = this.typeormToMongoose(fileContent, fileName);
        newFileName = fileName
          .replace(".entity.ts", ".schema.ts")
          .replace(".ts", ".schema.ts");
      } else {
        convertedContent = this.mongooseToTypeorm(fileContent, fileName);
        newFileName = fileName
          .replace(".schema.ts", ".entity.ts")
          .replace(".ts", ".entity.ts");
      }

      const newFilePath = path.join(
        path.dirname(document.fileName),
        newFileName
      );
      fs.writeFileSync(newFilePath, convertedContent, "utf8");

      const doc = await vscode.workspace.openTextDocument(newFilePath);
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        `✅ Conversión completada: ${newFileName}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Error en conversión: ${error}`);
    }
  }

  private static typeormToMongoose(content: string, fileName: string): string {
    const entityName = this.extractEntityName(content);
    const tableName = this.extractTableName(content);

    let converted = `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';\n`;
    converted += `import { Document, Types } from 'mongoose';\n\n`;
    converted += `export type ${entityName}Document = ${entityName} & Document;\n\n`;
    converted += `@Schema({ \n`;
    converted += `    timestamps: true,\n`;
    if (tableName) {
      converted += `    collection: '${tableName}',\n`;
    }
    converted += `})\n`;
    converted += `export class ${entityName} {\n`;
    const fields = this.extractTypeORMFields(content);
    const relations = this.extractTypeORRelations(content);
    fields.forEach((field) => {
      if (["id", "createdAt", "updatedAt"].includes(field.name)) return;

      let propOptions = this.getMongoosePropOptions(field);
      converted += `    @Prop(${propOptions})\n`;
      converted += `    ${field.name}: ${this.getMongooseType(
        field.type
      )};\n\n`;
    });

    relations.forEach((relation) => {
      const propOptions = this.getMongooseRelationOptions(relation);
      converted += `    @Prop(${propOptions})\n`;
      converted += `    ${relation.name}: ${this.getMongooseRelationType(
        relation
      )};\n\n`;
    });

    converted += `}\n\n`;
    converted += `export const ${entityName}Schema = SchemaFactory.createForClass(${entityName});\n\n`;

    const indexes = this.extractIndexes(content);
    if (indexes.length > 0) {
      indexes.forEach((index) => {
        converted += `${entityName}Schema.index({ ${index.field}: ${index.direction} });\n`;
      });
      converted += `\n`;
    }

    return converted;
  }

  private static mongooseToTypeorm(content: string, fileName: string): string {
    const entityName = this.extractSchemaName(content);
    const collectionName = this.extractCollectionName(content);

    let converted = `import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn`;

    const relations = this.extractMongooseRelations(content);
    if (relations.length > 0) {
      converted += `, ${relations
        .map((r) => r.relationType)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ")}`;
      converted += `, JoinColumn, JoinTable`;
    }

    converted += ` } from 'typeorm';\n\n`;

    converted += `@Entity('${
      collectionName || this.camelToSnake(entityName)
    }')\n`;
    converted += `export class ${entityName} {\n`;

    converted += `    @PrimaryGeneratedColumn('uuid')\n`;
    converted += `    id: string;\n\n`;

    const fields = this.extractMongooseFields(content);
    fields.forEach((field) => {
      if (["_id", "createdAt", "updatedAt", "__v"].includes(field.name)) return;

      const columnOptions = this.getTypeORMColumnOptions(field);
      converted += `    @Column(${columnOptions})\n`;
      converted += `    ${field.name}: ${this.getTypeORMType(field.type)};\n\n`;
    });

    if (content.includes("timestamps: true")) {
      converted += `    @CreateDateColumn({ type: 'timestamp' })\n`;
      converted += `    createdAt: Date;\n\n`;
      converted += `    @UpdateDateColumn({ type: 'timestamp' })\n`;
      converted += `    updatedAt: Date;\n\n`;
    }

    relations.forEach((relation) => {
      converted += `    ${this.getTypeORRelationDecorator(relation)}\n`;
      if (["OneToOne", "ManyToOne"].includes(relation.relationType)) {
        converted += `    @JoinColumn()\n`;
      } else if (relation.relationType === "ManyToMany") {
        converted += `    @JoinTable()\n`;
      }
      converted += `    ${relation.name}: ${relation.type};\n\n`;
    });

    converted += `    constructor(partial?: Partial<${entityName}>) {\n`;
    converted += `        if (partial) {\n`;
    converted += `            Object.assign(this, partial);\n`;
    converted += `        }\n`;
    converted += `    }\n`;

    converted += `}\n`;

    return converted;
  }

  private static extractTypeORMFields(content: string): any[] {
    const fields = [];
    const fieldRegex = /@Column\(([^)]*)\)\s*\n\s*(\w+):\s*([^;]+);/g;
    let match;

    while ((match = fieldRegex.exec(content)) !== null) {
      const [, options, name, type] = match;
      fields.push({
        name,
        type: type.trim(),
        options: this.parseColumnOptions(options),
      });
    }

    return fields;
  }

  private static extractTypeORRelations(content: string): any[] {
    const relations = [];
    const relationRegex =
      /@(OneToOne|OneToMany|ManyToOne|ManyToMany)\([^)]*\)\s*\n(?:\s*@JoinColumn\(\)\s*\n)?\s*@JoinTable\(\)\s*\n\?\s*(\w+):\s*([^;]+);/g;
    let match;

    while ((match = relationRegex.exec(content)) !== null) {
      const [, relationType, name, type] = match;
      relations.push({
        name,
        type: type.trim(),
        relationType,
        isArray: type.includes("[]"),
      });
    }

    return relations;
  }

  private static getMongoosePropOptions(field: any): string {
    const options = [];

    if (field.options?.type === "json") {
      options.push(`type: Object`);
    } else if (field.type === "string") {
      options.push(`type: String`);
    } else if (field.type === "number") {
      options.push(`type: Number`);
    } else if (field.type === "boolean") {
      options.push(`type: Boolean`);
    } else if (field.type === "Date") {
      options.push(`type: Date`);
    } else if (field.type.includes("[]")) {
      options.push(`type: [String]`);
    } else {
      options.push(`type: String`);
    }

    if (field.options?.nullable === false) {
      options.push(`required: true`);
    }
    if (field.options?.default !== undefined) {
      options.push(`default: ${JSON.stringify(field.options.default)}`);
    }
    if (field.options?.unique) {
      options.push(`unique: true`);
    }

    return `{ ${options.join(", ")} }`;
  }

  private static extractMongooseFields(content: string): any[] {
    const fields = [];
    const propRegex = /@Prop\(([^)]*)\)\s*\n\s*(\w+):\s*([^;]+);/g;
    let match;

    while ((match = propRegex.exec(content)) !== null) {
      const [, options, name, type] = match;
      fields.push({
        name,
        type: type.trim(),
        options: this.parseMongooseOptions(options),
      });
    }

    return fields;
  }

  private static extractMongooseRelations(content: string): any[] {
    const relations = [];
    const relationRegex =
      /@Prop\([^)]*ref:\s*'([^']+)'[^)]*\)\s*\n\s*(\w+):\s*([^;]+);/g;
    let match;

    while ((match = relationRegex.exec(content)) !== null) {
      const [, ref, name, type] = match;
      const isArray = type.includes("[]");
      const relationType = this.inferRelationType(name, isArray);

      relations.push({
        name,
        type: ref + (isArray ? "[]" : ""),
        relationType,
        isArray,
      });
    }

    return relations;
  }

  private static getTypeORMColumnOptions(field: any): string {
    const options = [];

    if (field.type === "string") {
      options.push(`type: 'varchar'`);
    } else if (field.type === "number") {
      options.push(`type: 'decimal'`);
    } else if (field.type === "boolean") {
      options.push(`type: 'boolean'`);
    } else if (field.type === "Date") {
      options.push(`type: 'timestamp'`);
    } else if (field.type.includes("[]")) {
      options.push(`type: 'json'`);
    } else {
      options.push(`type: 'varchar'`);
    }

    if (field.options?.required) {
      options.push(`nullable: false`);
    } else {
      options.push(`nullable: true`);
    }
    if (field.options?.default !== undefined) {
      options.push(`default: ${JSON.stringify(field.options.default)}`);
    }
    if (field.options?.unique) {
      options.push(`unique: true`);
    }

    return `{ ${options.join(", ")} }`;
  }

  private static extractEntityName(content: string): string {
    const match = content.match(/export class (\w+)/);
    return match ? match[1] : "UnknownEntity";
  }

  private static extractSchemaName(content: string): string {
    const match = content.match(/export class (\w+)/);
    return match ? match[1] : "UnknownSchema";
  }

  private static extractTableName(content: string): string {
    const match = content.match(/@Entity\(['"]([^'"]+)['"]\)/);
    return match ? match[1] : "";
  }

  private static extractCollectionName(content: string): string {
    const match = content.match(/collection:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : "";
  }

  private static extractIndexes(content: string): any[] {
    const indexes = [];
    const indexRegex = /\.index\(\{ ([^}]+) \}\)/g;
    let match;

    while ((match = indexRegex.exec(content)) !== null) {
      const [, indexDef] = match;
      const [field, direction] = indexDef.split(":").map((s) => s.trim());
      indexes.push({ field, direction: parseInt(direction) });
    }

    return indexes;
  }

  private static parseColumnOptions(options: string): any {
    const result: any = {};
    if (options.includes("nullable: false")) result.nullable = false;
    if (options.includes("nullable: true")) result.nullable = true;
    if (options.includes("unique: true")) result.unique = true;

    const defaultMatch = options.match(/default:\s*([^,}]+)/);
    if (defaultMatch) result.default = defaultMatch[1].trim();

    const typeMatch = options.match(/type:\s*'([^']+)'/);
    if (typeMatch) result.type = typeMatch[1];

    return result;
  }

  private static parseMongooseOptions(options: string): any {
    const result: any = {};
    if (options.includes("required: true")) result.required = true;
    if (options.includes("unique: true")) result.unique = true;

    const defaultMatch = options.match(/default:\s*([^,}]+)/);
    if (defaultMatch) result.default = eval(defaultMatch[1].trim());

    return result;
  }

  private static inferRelationType(
    fieldName: string,
    isArray: boolean
  ): string {
    if (isArray) return "ManyToMany";
    if (fieldName.includes("parent") || fieldName.includes("owner"))
      return "ManyToOne";
    return "OneToOne";
  }

  private static getTypeORRelationDecorator(relation: any): string {
    return `@${relation.relationType}(() => ${relation.type.replace(
      "[]",
      ""
    )})`;
  }

  private static getMongooseType(type: string): string {
    const typeMap: { [key: string]: string } = {
      string: "string",
      number: "number",
      boolean: "boolean",
      Date: "Date",
      "string[]": "string[]",
    };
    return typeMap[type] || "any";
  }

  private static getTypeORMType(type: string): string {
    return type;
  }

  private static getMongooseRelationType(relation: any): string {
    return relation.isArray ? "Types.ObjectId[]" : "Types.ObjectId";
  }

  private static getMongooseRelationOptions(relation: any): string {
    const options = [`ref: '${relation.type.replace("[]", "")}'`];
    if (relation.isArray) {
      options.push("type: [Types.ObjectId]");
    } else {
      options.push("type: Types.ObjectId");
    }
    return `{ ${options.join(", ")} }`;
  }

  private static camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, "_$1").toLowerCase();
  }
}
