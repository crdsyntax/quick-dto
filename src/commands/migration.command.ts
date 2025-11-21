import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class MongooseToTypeOrmMigrator {
  public static async migrateToTypeOrm() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Abre un archivo .schema.ts o .entity.ts");
      return;
    }

    const filePath = editor.document.fileName;
    const content = editor.document.getText();

    const isMongoose = /\.(schema|entity)\.ts$/.test(filePath) && (content.includes("@Schema") || content.includes("@Prop"));
    const isTypeorm = /\.(entity|schema)\.ts$/.test(filePath) && content.includes("@Entity");

    if (!isMongoose && !isTypeorm) {
      vscode.window.showErrorMessage("El archivo no es un schema de Mongoose ni una entity de TypeORM");
      return;
    }

    const newContent = isMongoose ? this.mongooseToTypeorm(content) : this.typeormToMongoose(content);
    const dir = path.dirname(filePath);

    const baseName = path.basename(filePath, path.extname(filePath));
    const cleanName = baseName.replace(/\.schema$|\.entity$/g, "");

    const newFileName = isMongoose ? `${cleanName}.entity.ts` : `${cleanName}.schema.ts`;
    const newPath = path.join(dir, newFileName);

    fs.writeFileSync(newPath, newContent, "utf8");
    fs.renameSync(filePath, filePath + ".backup");

    const doc = await vscode.workspace.openTextDocument(newPath);
    await vscode.window.showTextDocument(doc, { preview: false });

    vscode.window.showInformationMessage(
      `${isMongoose ? "Mongoose → TypeORM" : "TypeORM → Mongoose"}: ${newFileName}`
    );
  }

  private static mongooseToTypeorm(content: string): string {
    let result = content
      .replace(/import\s*{\s*[^}]*Prop[^}]*}\s*from\s*['"]@nestjs\/mongoose['"]\s*;?/g, "")
      .replace(/import\s*{\s*[^}]*Schema[^}]*}\s*from\s*['"]@nestjs\/mongoose['"]\s*;?/g, "")
      .replace(/import\s*{\s*[^}]*SchemaFactory[^}]*}\s*from\s*['"]@nestjs\/mongoose['"]\s*;?/g, "")
      .replace(/import\s*{\s*Document\s*}\s*from\s*['"]mongoose['"]\s*;?/g, "")
      .replace(/export\s+type\s+\w+Document[\s\S]*?Document;\s*/g, "")
      .replace(/@Schema\([^)]*\)/g, "@Entity()")
      .replace(/export\s+const\s+\w+Schema[\s\S]*?createForClass\([^;]+;\s*/g, "");

    const classNameMatch = content.match(/export\s+class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : "Unknown";

    result = result.replace(
      new RegExp(`export class ${className}`),
      `import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';\n\n@Entity()\nexport class ${className}`
    );

    if (!result.includes("PrimaryGeneratedColumn")) {
      result = result.replace(
        /(@Entity\(\)\s*\n\s*export class \w+)/,
        `@PrimaryGeneratedColumn('uuid')\n  id!: string;\n\n  $1`
      );
    }

    if (content.includes("timestamps: true")) {
      result = result.replace(
        /(@Entity\(\)\s*\n\s*export class \w+)/,
        `  @CreateDateColumn()\n  createdAt!: Date;\n\n  @UpdateDateColumn()\n  updatedAt!: Date;\n\n  $1`
      );
    }

    result = result.replace(/@Prop\(({[\s\S]*?})\)/g, (_, options: string) => {
      const opts = options.replace(/\s/g, "");
      const required = opts.includes("required:true");
      const unique = opts.includes("unique:true");
      const def = /default:([^,)}]+)/.exec(opts);
      const typeMatch = /type:(\w+)|type:\[(\w+)\]/.exec(opts);
      const mongooseType = typeMatch ? (typeMatch[1] || typeMatch[2]) : "String";
      const sqlType = this.mapMongooseToSql(mongooseType);

      let col = `type: '${sqlType}'`;
      if (!required) col += ", nullable: true";
      if (unique) col += ", unique: true";
      if (def) col += `, default: ${def[1]}`;

      return `@Column({ ${col} })`;
    });

    return result.trim() + "\n";
  }

  private static typeormToMongoose(content: string): string {
    let result = content
      .replace(/import\s*{[^}]*Entity[^}]*}\s*from\s*['"]typeorm['"].*;?/g, "")
      .replace(/import\s*{[^}]*Column[^}]*}\s*from\s*['"]typeorm['"].*;?/g, "")
      .replace(/import\s*{[^}]*PrimaryGeneratedColumn[^}]*}\s*from\s*['"]typeorm['"].*;?/g, "")
      .replace(/import\s*{[^}]*CreateDateColumn[^}]*}\s*from\s*['"]typeorm['"].*;?/g, "")
      .replace(/import\s*{[^}]*UpdateDateColumn[^}]*}\s*from\s*['"]typeorm['"].*;?/g, "")
      .replace(/@Entity\([^)]*\)/g, "@Schema({ timestamps: true })")
      .replace(/@PrimaryGeneratedColumn[\s\S]*?;\s*/g, "");

    const classNameMatch = content.match(/export\s+class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : "Unknown";

    result = result.replace(
      new RegExp(`export class ${className}`),
      `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';\nimport { Document } from 'mongoose';\n\n` +
      `export type ${className}Document = ${className} & Document;\n\n` +
      `@Schema({ timestamps: true })\nexport class ${className}`
    );

    result = result.replace(/@Column\(({[\s\S]*?})\)/g, (_, options: string) => {
      const opts = options.replace(/\s/g, "");
      const type = /type:'([^']+)'/.exec(opts)?.[1] || "varchar";
      const nullable = opts.includes("nullable:true");
      const unique = opts.includes("unique:true");
      const def = /default:([^,]+)(?:,|}|$)/.exec(opts);

      const mongooseType = this.mapSqlToMongoose(type);
      let prop = `type: ${mongooseType}`;
      if (!nullable) prop += ", required: true";
      if (unique) prop += ", unique: true";
      if (def) prop += `, default: ${def[1]}`;

      return `@Prop({ ${prop} })`;
    });

    result = result.replace(/@CreateDateColumn[\s\S]*?;\s*/g, "");
    result = result.replace(/@UpdateDateColumn[\s\S]*?;\s*/g, "");

    result += `\n\nexport const ${className}Schema = SchemaFactory.createForClass(${className});`;

    return result.trim() + "\n";
  }

  private static mapMongooseToSql(type: string): string {
    const map: Record<string, string> = {
      String: "varchar",
      Number: "int",
      Boolean: "boolean",
      Date: "timestamp",
      ObjectId: "varchar",
      Mixed: "json",
    };
    return map[type] || "varchar";
  }

  private static mapSqlToMongoose(type: string): string {
    const map: Record<string, string> = {
      varchar: "String",
      text: "String",
      int: "Number",
      bigint: "Number",
      float: "Number",
      decimal: "Number",
      boolean: "Boolean",
      timestamp: "Date",
      date: "Date",
      json: "Object",
      jsonb: "Object",
    };
    return map[type] || "String";
  }
}