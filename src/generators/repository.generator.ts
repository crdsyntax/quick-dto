export function generateRepositoryContent(
  camelEntity: string,
  pascalEntity: string,
  repoType: "TypeORM" | "Mongoose" = "TypeORM"
): string {
  if (repoType === "Mongoose") {
    return `import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ${pascalEntity}, ${pascalEntity}Document } from "../entities/${camelEntity}.schema";
import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";

@Injectable()
export class ${pascalEntity}Repository {
  constructor(@InjectModel(${pascalEntity}.name) private model: Model<${pascalEntity}Document>) {}

  async createEntity(dto: Partial<${pascalEntity}>): Promise<${pascalEntity}> {
    const entity = new this.model(dto);
    return await entity.save();
  }

  async updateEntity(id: string, dto: Partial<${pascalEntity}>): Promise<${pascalEntity} | null> {
    return await this.model.findByIdAndUpdate(id, dto, { new: true });
  }

  async findAllEntities(page = 1, limit = 10): Promise<PaginatedResponseDto<${pascalEntity}>> {
    const skip = (page - 1) * limit;
    const data = await this.model.find().skip(skip).limit(limit).exec();
    const total = await this.model.countDocuments().exec();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneEntity(id: string): Promise<${pascalEntity} | null> {
    return await this.model.findById(id).exec();
  }

  async removeEntity(id: string): Promise<${pascalEntity} | null> {
    return await this.model.findByIdAndDelete(id).exec();
  }
}
`;
  }

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
