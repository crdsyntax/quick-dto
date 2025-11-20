export function generateServiceContent(camelEntity: string, pascalEntity: string): string {
  return `import { Injectable, NotFoundException } from "@nestjs/common";
import { ${pascalEntity}Repository } from "../repositories/${camelEntity}.repository";
import { ${pascalEntity} } from "../entities/${camelEntity}.entity";
import { Create${pascalEntity}Dto } from "../dto/${camelEntity}/create-${camelEntity}.dto";
import { Update${pascalEntity}Dto } from "../dto/${camelEntity}/update-${camelEntity}.dto";
import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";
import { UpdateResult, DeleteResult } from "typeorm";

@Injectable()
export class ${pascalEntity}Service {
  constructor(private readonly repository: ${pascalEntity}Repository) {}

  async create(createDto: Create${pascalEntity}Dto): Promise<${pascalEntity}> {
    return await this.repository.createEntity(createDto);
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedResponseDto<${pascalEntity}>> {
    return await this.repository.findAllEntities(page, limit);
  }

  async findOne(id: number): Promise<${pascalEntity}> {
    const entity = await this.repository.findOneEntity(id);
    if (!entity) {
      throw new NotFoundException(\`${pascalEntity} with ID \${id} not found\`);
    }
    return entity;
  }

  async update(id: number, updateDto: Update${pascalEntity}Dto): Promise<UpdateResult> {
    await this.findOne(id);
    return await this.repository.updateEntity(id, updateDto);
  }

  async remove(id: number): Promise<DeleteResult> {
    await this.findOne(id);
    return await this.repository.removeEntity(id);
  }
}
`;
}