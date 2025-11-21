import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SmartEntityGenerator } from '../generators/entity.generator';
import { DataDictionary } from '../dictionaries/data.dictionary';

// Interfaces para los items del QuickPick
interface QuickPickModuleItem extends vscode.QuickPickItem {
    module: any;
}

interface QuickPickEntityItem extends vscode.QuickPickItem {
    entity: any;
}

interface QuickPickFieldItem extends vscode.QuickPickItem {
    field: any;
}

interface QuickPickRelationItem extends vscode.QuickPickItem {
    relation: any;
}

export class EntityGenerator {
    public static async generateEntity() {
        const options = [
            {
                label: '$(database) Desde Diccionario',
                description: 'Seleccionar entidad predefinida del diccionario',
                detail: 'Usa plantillas predefinidas con campos y relaciones comunes'
            },
            {
                label: '$(edit) Manualmente',
                description: 'Crear entidad personalizada desde cero',
                detail: 'Define todos los campos y relaciones manualmente'
            }
        ];

        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: '¿Cómo quieres crear la entidad?',
        });

        if (!selection) return;

        if (selection.label.includes('Diccionario')) {
            await SmartEntityGenerator.generateEntityFromDictionary();
        } else {
            
            await this.generateEntityManually();
        }
    }

    private static async generateEntityManually() {
        const entityName = await vscode.window.showInputBox({
            prompt: 'Nombre de la entidad (ej: User, Product, Category)',
            placeHolder: 'Ingresa el nombre de la entidad en PascalCase',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) return 'El nombre de la entidad es requerido';
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) return 'El nombre debe estar en PascalCase (ej: User, ProductCategory)';
                return null;
            }
        });

        if (!entityName) return;

        const defaultModule = entityName.toLowerCase();
        const moduleName = await vscode.window.showInputBox({
            prompt: 'Nombre del módulo (carpeta donde se creará la entidad)',
            placeHolder: `Ingresa el nombre del módulo (por defecto: ${defaultModule})`,
            value: defaultModule,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) return 'El nombre del módulo es requerido';
                if (!/^[a-zA-Z0-9\-_]+$/.test(value)) return 'Solo letras, números, guiones y guiones bajos';
                return null;
            }
        });

        if (!moduleName) return;

        const orm = await vscode.window.showQuickPick(['TypeORM', 'Mongoose'], { placeHolder: 'Selecciona el ORM a utilizar' });
        if (!orm) return;

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No se encontró la carpeta del workspace');
            return;
        }

        const moduleDir = path.join(workspaceRoot, 'src', moduleName);
    const entityDir = orm === 'Mongoose' ? path.join(moduleDir, 'schemas') : path.join(moduleDir, 'entities'); // usar 'schemas' para Mongoose

        try {
            fs.mkdirSync(entityDir, { recursive: true });

            const kebabEntity = this.pascalToKebab(entityName);
            const entityFile = path.join(entityDir, orm === 'Mongoose' ? `${kebabEntity}.schema.ts` : `${kebabEntity}.entity.ts`);

            const moduleFile = path.join(moduleDir, `${this.toKebabCase(moduleName)}.module.ts`);

            const entityContent = this.generateEntityTemplateForManual(entityName, orm);
            fs.writeFileSync(entityFile, entityContent, 'utf8');

            const moduleContent = this.generateModuleTemplateForManual(entityName, moduleName, orm);
            fs.writeFileSync(moduleFile, moduleContent, 'utf8');

            vscode.window.showInformationMessage(`Entidad ${entityName} creada en ${entityDir}`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Error al crear la entidad: ${err?.message || err}`);
        }
    }

    private static generateEntityTemplateForManual(entityName: string, orm: string): string {
        const kebab = this.pascalToKebab(entityName);
        if (orm === 'TypeORM') {
            return `import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('${kebab}')
export class ${entityName} {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
`;
        }

        return `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ${entityName}Document = ${entityName} & Document;

@Schema({ timestamps: true, collection: '${kebab}' })
export class ${entityName} {
    @Prop({ required: true })
    name: string;

    @Prop({ default: true })
    isActive: boolean;

    createdAt?: Date;
    updatedAt?: Date;
}

export const ${entityName}Schema = SchemaFactory.createForClass(${entityName});
`;
    }

    private static generateModuleTemplateForManual(entityName: string, moduleName: string, orm: string): string {
        const moduleClass = this.toPascalCase(moduleName) + 'Module';
        const kebabEntity = this.pascalToKebab(entityName);

                        if (orm === 'TypeORM') {
                                return `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${entityName} } from './entities/${kebabEntity}.entity';

@Module({
    imports: [TypeOrmModule.forFeature([${entityName}])],
    exports: [TypeOrmModule]
})
export class ${moduleClass} {}
`;
                        }

                        return `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${entityName}, ${entityName}Schema } from './schemas/${kebabEntity}.schema';

@Module({
    imports: [MongooseModule.forFeature([{ name: ${entityName}.name, schema: ${entityName}Schema }])],
    exports: [MongooseModule]
})
export class ${moduleClass} {}
`;
    }

    private static pascalToKebab(str: string): string {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
            .replace(/[_ ]/g, '-')
            .toLowerCase();
    }

    private static toKebabCase(str: string): string {
        return this.pascalToKebab(str);
    }

    private static toPascalCase(str: string): string {
        return str
            .split(/[-_ ]+/)
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join('');
    }

    public static async showDataDictionary() {
        const modules = DataDictionary.getModuleDefinitions();
        const moduleItems: QuickPickModuleItem[] = Array.from(modules.entries()).map(([name, module]) => ({
            label: `$(package) ${name}`,
            description: module.description,
            detail: `${module.entities.length} entidades, ${module.dependencies.length} dependencias`,
            module: module
        }));

        const selected = await vscode.window.showQuickPick(moduleItems, {
            placeHolder: 'Explora el diccionario de datos disponible',
        });

        if (selected) {
            await this.showModuleDetails(selected.module);
        }
    }

    private static async showModuleDetails(module: any) {
        const entityItems: QuickPickEntityItem[] = module.entities.map((entity: any) => ({
            label: `$(circuit-board) ${entity.name}`,
            description: entity.description,
            detail: `${entity.fields.length} campos, ${entity.relations.length} relaciones`,
            entity: entity
        }));

        const selected = await vscode.window.showQuickPick(entityItems, {
            placeHolder: `Entidades del módulo ${module.name}`,
        });

        if (selected) {
            await this.showEntityDetails(selected.entity);
        }
    }

    private static async showEntityDetails(entity: any) {
        const fieldItems: QuickPickFieldItem[] = entity.fields.map((field: any) => ({
            label: `$(symbol-field) ${field.name}`,
            description: field.type,
            detail: `${field.required ? 'Requerido' : 'Opcional'} - ${field.description}`,
            field: field
        }));

        const relationItems: QuickPickRelationItem[] = entity.relations.map((relation: any) => ({
            label: `$(git-compare) ${relation.name}`,
            description: relation.relationType || 'N/A',
            detail: `→ ${relation.targetEntity || 'N/A'} - ${relation.description}`,
            relation: relation
        }));

        const items: vscode.QuickPickItem[] = [
            { label: '$(list-tree) CAMPOS', kind: vscode.QuickPickItemKind.Separator },
            ...fieldItems,
            { label: '$(git-branch) RELACIONES', kind: vscode.QuickPickItemKind.Separator },
            ...relationItems
        ];

        await vscode.window.showQuickPick(items, {
            placeHolder: `Detalles de ${entity.name}`,
        });
    }
}