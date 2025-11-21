import * as fs from 'fs';
import * as path from 'path';
import { toPascalCase } from './case.util';

function findModuleFile(moduleFolder: string): string | null {
  const files = fs.readdirSync(moduleFolder);
  const mod = files.find(f => f.endsWith('.module.ts'));
  return mod ? path.join(moduleFolder, mod) : null;
}

function createBasicModule(moduleFolder: string, moduleClassName: string): string {
  const content = `import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: []
})
export class ${moduleClassName} {}
`;
  const modulePath = path.join(moduleFolder, `${moduleClassName.replace(/Module$/, '').toLowerCase()}.module.ts`);
  fs.writeFileSync(modulePath, content, 'utf8');
  return modulePath;
}

function ensureImportExists(fileContent: string, importStatement: string): string {
  if (fileContent.includes(importStatement)) return fileContent;
  return importStatement + '\n' + fileContent;
}

function addToArrayInModule(fileContent: string, arrayName: string, entry: string): string {
  const moduleStart = fileContent.indexOf('@Module');
  if (moduleStart === -1) return fileContent;

  const start = fileContent.indexOf('{', moduleStart);
  const end = fileContent.indexOf('})', start);
  if (start === -1 || end === -1) return fileContent;

  const block = fileContent.substring(start + 1, end);
  const regex = new RegExp(`${arrayName}\s*:\s*\[([\s\S]*?)\]`);
  const match = block.match(regex);

  if (!match) {
    const insertion = `  ${arrayName}: [${entry}],\n`;
    const newBlock = block + '\n' + insertion;
    return fileContent.substring(0, start + 1) + newBlock + fileContent.substring(end);
  }

  const arrayContent = match[1];
  if (arrayContent.includes(entry)) return fileContent; // already present

  const newArrayContent = arrayContent.trim().length > 0 ? arrayContent.trim() + ', ' + entry : entry;
  const newBlock = block.replace(match[0], `${arrayName}: [${newArrayContent}]`);
  return fileContent.substring(0, start + 1) + newBlock + fileContent.substring(end);
}

export function ensureModuleRegisters(moduleFolder: string, entityFilePath: string, options: { registerController?: boolean; registerService?: boolean; registerRepository?: boolean; }) {
  const moduleFile = findModuleFile(moduleFolder) || createBasicModule(moduleFolder, toPascalCase(path.basename(moduleFolder)) + 'Module');
  let content = fs.readFileSync(moduleFile, 'utf8');

  const entityName = path.basename(entityFilePath, '.entity.ts');
  const pascalEntity = toPascalCase(entityName);
  const camelEntity = entityName.replace(/-([a-z])/g, g => g[1].toUpperCase());

  const entityContent = fs.readFileSync(entityFilePath, 'utf8');
  const isTypeORM = entityContent.includes("from 'typeorm'") || entityContent.includes('typeorm');
  const isMongoose = entityContent.includes("from '@nestjs/mongoose'") || entityContent.includes('SchemaFactory');

  const relEntityPath = `./entities/${entityName}.entity`;
  const entityImport = `import { ${pascalEntity} } from '${relEntityPath}';`;
  content = ensureImportExists(content, entityImport);

  if (isTypeORM && !content.includes("TypeOrmModule")) {
    content = ensureImportExists(content, `import { TypeOrmModule } from '@nestjs/typeorm';`);
    content = addToArrayInModule(content, 'imports', `TypeOrmModule.forFeature([${pascalEntity}])`);
  }
  if (isMongoose && !content.includes("MongooseModule")) {
    content = ensureImportExists(content, `import { MongooseModule } from '@nestjs/mongoose';`);
    content = addToArrayInModule(content, 'imports', `MongooseModule.forFeature([{ name: ${pascalEntity}.name, schema: ${pascalEntity}Schema }])`);
  }

  if (options.registerController) {
    const controllerImport = `import { ${pascalEntity}Controller } from './controllers/${camelEntity}.controller';`;
    content = ensureImportExists(content, controllerImport);
    content = addToArrayInModule(content, 'controllers', `${pascalEntity}Controller`);
  }

  if (options.registerService) {
    const serviceImport = `import { ${pascalEntity}Service } from './services/${camelEntity}.service';`;
    content = ensureImportExists(content, serviceImport);
    content = addToArrayInModule(content, 'providers', `${pascalEntity}Service`);
    content = addToArrayInModule(content, 'exports', `${pascalEntity}Service`);
  }

  if (options.registerRepository) {
    const repoImport = `import { ${pascalEntity}Repository } from './repositories/${camelEntity}.repository';`;
    content = ensureImportExists(content, repoImport);
    content = addToArrayInModule(content, 'providers', `${pascalEntity}Repository`);
  }

  fs.writeFileSync(moduleFile, content, 'utf8');
}

export default { ensureModuleRegisters };
