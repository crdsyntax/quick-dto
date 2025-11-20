export function generateRepositoryContent(camelEntity: string, pascalEntity: string): string {
  return `import { Repository, DataSource, UpdateResult, DeleteResult } from "typeorm";
import { Injectable } from "@nestjs/common";
import { ${pascalEntity} } from "../entities/${camelEntity}.entity";
import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";

@Injectable()
export class ${pascalEntity}Repository extends Repository<${pascalEntity}> {
  constructor(private dataSource: DataSource) {
    super(${pascalEntity}, dataSource.createEntityManager());
  }

  async createEntity(dto: Partial<${pascalEntity}>): Promise<${pascalEntity}> {
    const entity = this.create(dto);
    return await this.save(entity);
  }

  async updateEntity(id: number, dto: Partial<${pascalEntity}>): Promise<UpdateResult> {
    return await this.update(id, dto);
  }

  async findAllEntities(page = 1, limit = 10): Promise<PaginatedResponseDto<${pascalEntity}>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.findAndCount({ skip, take: limit });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneEntity(id: number): Promise<${pascalEntity} | null> {
    return await this.findOne({ where: { id } });
  }

  async removeEntity(id: number): Promise<DeleteResult> {
    return await this.delete(id);
  }
}
`;
}