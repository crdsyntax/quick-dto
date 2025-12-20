import * as fs from "fs";
import * as path from "path";

export function generateServiceContent(
  camelEntity: string,
  pascalEntity: string,
  entityPath: string,
  isMongoose: boolean
): string {
  const fileContent = fs.readFileSync(entityPath, "utf8");

  const relations: { name: string; type: string; isArray: boolean }[] = [];

  if (isMongoose) {
    const relationRegex = /@Prop\([^)]*ref:\s*['"]([^'"]+)['"][^)]*\)\s*\n\s*(\w+):\s*([^;]+);/g;
    let match;
    while ((match = relationRegex.exec(fileContent)) !== null) {
      const [, ref, name, type] = match;
      relations.push({ name, type: ref, isArray: type.includes("[]") });
    }
  } else {
    const relationRegex =
      /@(OneToOne|OneToMany|ManyToOne|ManyToMany)\([^)]*\)\s*\n\s*(\w+):\s*([^;]+);/g;
    let match;
    while ((match = relationRegex.exec(fileContent)) !== null) {
      const [, , name, type] = match;
      relations.push({ name, type, isArray: type.includes("[]") });
    }
  }

  const repositoryName = `${pascalEntity}Repository`;
  const repositoryVar = `private readonly ${camelEntity}Repository: ${repositoryName}`;

  let imports = `import { Injectable, NotFoundException } from "@nestjs/common";\n`;
  if (isMongoose) {
    imports += `import { ${pascalEntity} } from "../entities/${camelEntity}.schema";\n`;
  } else {
    imports += `import { ${pascalEntity} } from "../entities/${camelEntity}.entity";\n`;
    imports += `import { UpdateResult, DeleteResult } from "typeorm";\n`;
    imports += `import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";\n`;
  }
  imports += `import { ${repositoryName} } from "../repositories/${camelEntity}.repository";\n`;
  imports += `import { Create${pascalEntity}Dto } from "../dto/${camelEntity}/create-${camelEntity}.dto";\n`;
  imports += `import { Update${pascalEntity}Dto } from "../dto/${camelEntity}/update-${camelEntity}.dto";\n\n`;

  const relationAssignmentsCreate = relations
    .map(
      (r) =>
        `    ${r.isArray ? "createDto." + r.name + " = createDto." + r.name + " || [];" : ""}`
    )
    .join("\n");

  const relationAssignmentsUpdate = relations
    .map(
      (r) =>
        `    ${r.isArray ? "updateDto." + r.name + " = updateDto." + r.name + " || [];" : ""}`
    )
    .join("\n");

  return `${imports}
@Injectable()
export class ${pascalEntity}Service {
  constructor(${repositoryVar}) {}

  async create(createDto: Create${pascalEntity}Dto): Promise<${pascalEntity}> {
${relationAssignmentsCreate ? relationAssignmentsCreate : ""}
    const exists = await this.${camelEntity}Repository.findOneEntity(createDto.id || 0);
    if (exists) throw new NotFoundException(\`${pascalEntity} already exists\`);
    return await this.${camelEntity}Repository.createEntity(createDto);
  }

  async findAll(page = 1, limit = 10): Promise<${isMongoose ? pascalEntity + "[]" : "PaginatedResponseDto<" + pascalEntity + ">"}> {
    return await this.${camelEntity}Repository.findAllEntities(page, limit);
  }

  async findOne(id: number): Promise<${pascalEntity}> {
    const entity = await this.${camelEntity}Repository.findOneEntity(id);
    if (!entity) throw new NotFoundException(\`${pascalEntity} with ID \${id} not found\`);
    return entity;
  }

  async update(id: number, updateDto: Update${pascalEntity}Dto): Promise<${
    isMongoose ? pascalEntity : "UpdateResult"
  }> {
    const entity = await this.findOne(id);
${relationAssignmentsUpdate ? relationAssignmentsUpdate : ""}
    return await this.${camelEntity}Repository.updateEntity(id, updateDto);
  }

  async remove(id: number): Promise<${isMongoose ? pascalEntity : "DeleteResult"}> {
    await this.findOne(id);
    return await this.${camelEntity}Repository.removeEntity(id);
  }
}
`;
}
