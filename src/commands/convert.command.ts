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

    

    const options: { label: string; description: string; detail: string }[] = [];
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
        convertedContent = OrmConverter.typeormToMongoose(fileContent, fileName);
        newFileName = fileName
          .replace(".entity.ts", ".schema.ts")
          .replace(".ts", ".schema.ts");
        newFileName = newFileName.replace(/\.schema\.schema\.ts$/, ".schema.ts");
      } else {
        convertedContent = OrmConverter.mongooseToTypeorm(fileContent, fileName);
        newFileName = fileName
          .replace(".schema.ts", ".entity.ts")
          .replace(".ts", ".entity.ts");
        newFileName = newFileName.replace(/\.entity\.entity\.ts$/, ".entity.ts");
      }

      const newFilePath = path.join(path.dirname(document.fileName), newFileName);
      fs.writeFileSync(newFilePath, convertedContent, "utf8");

      const doc = await vscode.workspace.openTextDocument(newFilePath);
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(`✅ Conversión completada: ${newFileName}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`❌ Error en conversión: ${error.message || error}`);
    }
  }

  private static getTypeORMType(type: string): string {
    return type;
}

  private static typeormToMongoose(content: string, fileName: string): string {
    const entityName = OrmConverter.extractEntityName(content);
    const tableName = OrmConverter.extractTableName(content);

    let converted = `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';\n`;
    converted += `import { Document, Types } from 'mongoose';\n\n`;
    converted += `export type ${entityName}Document = ${entityName} & Document;\n\n`;
    converted += `@Schema({\n    timestamps: true,\n`;
    if (tableName) converted += `    collection: '${tableName}',\n`;
    converted += `})\n`;
    converted += `export class ${entityName} {\n`;

    const fields = OrmConverter.extractTypeORMFields(content);
    const relations = OrmConverter.extractTypeORRelations(content);

    fields.forEach((field) => {
      if (["id", "createdAt", "updatedAt"].includes(field.name)) return;
      const propOptions = OrmConverter.getMongoosePropOptions(field);
      converted += `    @Prop(${propOptions})\n`;
      converted += `    ${field.name}: ${OrmConverter.getMongooseType(field.type)};\n\n`;
    });

    relations.forEach((relation) => {
      const propOptions = OrmConverter.getMongooseRelationOptions(relation);
      converted += `    @Prop(${propOptions})\n`;
      converted += `    ${relation.name}: ${OrmConverter.getMongooseRelationType(relation)};\n\n`;
    });

    converted += `}\n\n`;
    converted += `export const ${entityName}Schema = SchemaFactory.createForClass(${entityName});\n`;

    return converted;
  }

  private static mongooseToTypeorm(content: string, fileName: string): string {
    const entityName = OrmConverter.extractSchemaName(content);
    const collectionName = OrmConverter.extractCollectionName(content);

    let converted = `import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn`;

    const relations = OrmConverter.extractMongooseRelations(content);
    if (relations.length > 0) {
      converted += `, ${relations
        .map((r) => r.relationType)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ")}, JoinColumn, JoinTable`;
    }
    converted += ` } from 'typeorm';\n\n`;

    converted += `@Entity('${collectionName || OrmConverter.camelToSnake(entityName)}')\n`;
    converted += `export class ${entityName} {\n`;

    converted += `    @PrimaryGeneratedColumn('uuid')\n    id: string;\n\n`;

    const fields = OrmConverter.extractMongooseFields(content);
    fields.forEach((field) => {
      if (["_id", "createdAt", "updatedAt", "__v"].includes(field.name)) return;
      const columnOptions = OrmConverter.getTypeORMColumnOptions(field);
      converted += `    @Column(${columnOptions})\n`;
      converted += `    ${field.name}: ${OrmConverter.getTypeORMType(field.type)};\n\n`;
    });

    if (content.includes("timestamps: true")) {
      converted += `    @CreateDateColumn({ type: 'timestamp' })\n    createdAt: Date;\n\n`;
      converted += `    @UpdateDateColumn({ type: 'timestamp' })\n    updatedAt: Date;\n\n`;
    }

    relations.forEach((relation) => {
      converted += `    ${OrmConverter.getTypeORRelationDecorator(relation)}\n`;
      if (["OneToOne", "ManyToOne"].includes(relation.relationType)) converted += `    @JoinColumn()\n`;
      else if (relation.relationType === "ManyToMany") converted += `    @JoinTable()\n`;
      converted += `    ${relation.name}: ${relation.type};\n\n`;
    });

    converted += `    constructor(partial?: Partial<${entityName}>) {\n`;
    converted += `        if (partial) Object.assign(this, partial);\n    }\n`;
    converted += `}\n`;

    return converted;
  }

  private static extractTypeORMFields(content: string) {
    const fields = [];
    const fieldRegex = /@Column(?:\(([\s\S]*?)\))?\s*\n\s*(\w+)\s*:\s*([^;]+);/g;
    let match;
    while ((match = fieldRegex.exec(content)) !== null) {
      const [, options, name, type] = match;
      fields.push({ name, type: type.trim(), options: OrmConverter.parseColumnOptions(options) });
    }
    return fields;
  }

  private static extractTypeORRelations(content: string) {
    const relations = [];
    const relationRegex = /@(OneToOne|OneToMany|ManyToOne|ManyToMany)\(([\s\S]*?)\)\s*\n([\s\S]*?)\n\s*(\w+)\s*:\s*([^;]+);/g;
    let match;
    while ((match = relationRegex.exec(content)) !== null) {
      const [, relationType, , , name, type] = match;
      relations.push({ name, type: type.trim(), relationType, isArray: type.includes("[]") });
    }
    return relations;
  }

  private static extractMongooseFields(content: string) {
    const fields = [];
    const propRegex = /@Prop\(([^)]*)\)\s*\n\s*(\w+):\s*([^;]+);/g;
    let match;
    while ((match = propRegex.exec(content)) !== null) {
      const [, options, name, type] = match;
      fields.push({ name, type: type.trim(), options: OrmConverter.parseMongooseOptions(options) });
    }
    return fields;
  }

  private static extractMongooseRelations(content: string) {
    const relations = [];
    const relationRegex = /@Prop\([^)]*ref:\s*'([^']+)'[^)]*\)\s*\n\s*(\w+):\s*([^;]+);/g;
    let match;
    while ((match = relationRegex.exec(content)) !== null) {
      const [, ref, name, type] = match;
      const isArray = type.includes("[]");
      relations.push({ name, type: ref + (isArray ? "[]" : ""), relationType: OrmConverter.inferRelationType(name, isArray), isArray });
    }
    return relations;
  }

  private static getMongoosePropOptions(field: any): string {
    const options = [];
    if (field.type === "string") options.push("type: String");
    else if (field.type === "number") options.push("type: Number");
    else if (field.type === "boolean") options.push("type: Boolean");
    else if (field.type === "Date") options.push("type: Date");
    else if (field.type.includes("[]")) options.push("type: [String]");
    else options.push("type: String");

    if (field.options?.nullable === false) options.push("required: true");
    if (field.options?.default !== undefined) options.push(`default: ${JSON.stringify(field.options.default)}`);
    if (field.options?.unique) options.push("unique: true");

    return `{ ${options.join(", ")} }`;
  }

  private static getMongooseRelationOptions(relation: any): string {
    const options = [`ref: '${relation.type.replace("[]", "")}'`];
    if (relation.isArray) options.push("type: [Types.ObjectId]");
    else options.push("type: Types.ObjectId");
    return `{ ${options.join(", ")} }`;
  }

  private static getMongooseType(type: string): string {
    const map: Record<string, string> = { string: "string", number: "number", boolean: "boolean", Date: "Date", "string[]": "string[]" };
    return map[type] || "any";
  }

  private static getMongooseRelationType(relation: any): string {
    return relation.isArray ? "Types.ObjectId[]" : "Types.ObjectId";
  }

  private static getTypeORMColumnOptions(field: any): string {
    const options = [];
    if (field.type === "string") options.push("type: 'varchar'");
    else if (field.type === "number") options.push("type: 'decimal'");
    else if (field.type === "boolean") options.push("type: 'boolean'");
    else if (field.type === "Date") options.push("type: 'timestamp'");
    else if (field.type.includes("[]")) options.push("type: 'json'");
    else options.push("type: 'varchar'");

    options.push(field.options?.required ? "nullable: false" : "nullable: true");
    if (field.options?.default !== undefined) options.push(`default: ${JSON.stringify(field.options.default)}`);
    if (field.options?.unique) options.push("unique: true");

    return `{ ${options.join(", ")} }`;
  }

  private static extractEntityName(content: string) {
    const match = content.match(/export class (\w+)/);
    return match ? match[1] : "UnknownEntity";
  }

  private static extractSchemaName(content: string) {
    const match = content.match(/export class (\w+)/);
    return match ? match[1] : "UnknownSchema";
  }

  private static extractTableName(content: string) {
    const match = content.match(/@Entity\(['"]([^'"]+)['"]\)/);
    return match ? match[1] : "";
  }

  private static extractCollectionName(content: string) {
    const match = content.match(/collection:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : "";
  }

  private static parseColumnOptions(options: string) {
    const result: any = {};
    if (!options) return result;
    if (options.includes("nullable: false")) result.nullable = false;
    if (options.includes("nullable: true")) result.nullable = true;
    if (options.includes("unique: true")) result.unique = true;
    const defaultMatch = options.match(/default:\s*([^,}]+)/);
    if (defaultMatch) result.default = defaultMatch[1].trim();
    const typeMatch = options.match(/type:\s*'([^']+)'/);
    if (typeMatch) result.type = typeMatch[1];
    return result;
  }

  private static parseMongooseOptions(options: string) {
    const result: any = {};
    if (!options) return result;
    if (options.includes("required: true")) result.required = true;
    if (options.includes("unique: true")) result.unique = true;
    const defaultMatch = options.match(/default:\s*([^,}]+)/);
    if (defaultMatch) result.default = eval(defaultMatch[1].trim());
    return result;
  }

  private static inferRelationType(fieldName: string, isArray: boolean) {
    if (isArray) return "ManyToMany";
    if (fieldName.toLowerCase().includes("parent") || fieldName.toLowerCase().includes("owner")) return "ManyToOne";
    return "OneToOne";
  }

  private static getTypeORRelationDecorator(relation: any) {
    return `@${relation.relationType}(() => ${relation.type.replace("[]", "")})`;
  }

  private static camelToSnake(str: string) {
    return str.replace(/([A-Z])/g, "_$1").toLowerCase();
  }
}
