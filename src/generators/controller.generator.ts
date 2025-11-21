import { commonImports, swaggerImports } from "../types/types";
import { parseServiceMethods } from "./parser/service.parser";

export function generateControllerContentFromService(
  serviceContent: string,
  camelEntity: string,
  pascalEntity: string
): string {
  const methods = parseServiceMethods(serviceContent);

  const dtoImports = new Set<string>();
  const typeImports = new Set<string>();
  let needsEntity = false;
  let needsPaginated = false;

  methods.forEach((m) => {
    if (m.name === "create") {
      dtoImports.add(
        `import { Create${pascalEntity}Dto } from "../dto/${camelEntity}/create-${camelEntity}.dto";`
      );
      needsEntity = true;
    }
    if (m.name === "update") {
      dtoImports.add(
        `import { Update${pascalEntity}Dto } from "../dto/${camelEntity}/update-${camelEntity}.dto";`
      );
      typeImports.add("UpdateResult");
      needsEntity = true;
    }
    if (m.name === "remove") {
      typeImports.add("DeleteResult");
      needsEntity = true;
    }
    if (m.name === "findAll") needsPaginated = true;
    if (m.name === "findOne") needsEntity = true;
  });

  let content = `import { ${commonImports.join(
    ", "
  )} } from "@nestjs/common";\n`;
  content += `import { ${swaggerImports.join(
    ", "
  )} } from "@nestjs/swagger";\n\n`;
  content += `import { ${pascalEntity}Service } from "../services/${camelEntity}.service";\n`;

  if (needsEntity)
    content += `import { ${pascalEntity} } from "../entities/${camelEntity}.entity";\n`;
  if (needsPaginated)
    content += `import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";\n`;
  if (dtoImports.size > 0) content += [...dtoImports].join("\n") + "\n";
  if (typeImports.size > 0)
    content += `import { ${[...typeImports].join(", ")} } from "typeorm";\n`;

  content += `\n@ApiTags("${pascalEntity}")\n@Controller("${camelEntity}")\n`;
  content += `export class ${pascalEntity}Controller {\n`;
  content += `  constructor(private readonly service: ${pascalEntity}Service) {}\n\n`;

  methods.forEach((m) => {
    const route =
      m.name === "findAll" ? "" : m.name === "findOne" ? ":id" : ":id";
    const verb =
      m.name === "create"
        ? "Post"
        : m.name === "findAll"
        ? "Get"
        : m.name === "findOne"
        ? "Get"
        : m.name === "update"
        ? "Patch"
        : "Delete";

    content += `  @${verb}("${route}")\n`;
    content += `  @ApiOperation({ summary: "${getSummary(
      m.name,
      pascalEntity
    )}" })\n`;

    
    if (m.name === "create") {
      content += `  @ApiResponse({ status: 201, type: ${pascalEntity} })\n`;
    } else if (m.name === "findAll") {
      content += `  @ApiQuery({ name: "page", required: false, type: Number })\n`;
      content += `  @ApiQuery({ name: "limit", required: false, type: Number })\n`;
      content += `  @ApiResponse({ status: 200, type: () => PaginatedResponseDto<${pascalEntity}> })\n`;
    } else if (m.name === "findOne") {
      content += `  @ApiParam({ name: "id", type: Number })\n`;
      content += `  @ApiResponse({ status: 200, type: ${pascalEntity} })\n`;
      content += `  @ApiResponse({ status: 404, description: "${pascalEntity} not found" })\n`;
    } else if (m.name === "update") {
      content += `  @ApiParam({ name: "id", type: Number })\n`;
      content += `  @ApiResponse({ status: 200, type: UpdateResult })\n`;
      content += `  @ApiResponse({ status: 404, description: "${pascalEntity} not found" })\n`;
    } else if (m.name === "remove") {
      content += `  @ApiParam({ name: "id", type: Number })\n`;
      content += `  @ApiResponse({ status: 200, type: DeleteResult })\n`;
      content += `  @ApiResponse({ status: 404, description: "${pascalEntity} not found" })\n`;
    }

    const params = m.params
      .map(
        (p: any) =>
          `@${
            p.name === "createDto" || p.name === "updateDto" ? "Body" : "Param"
          }("${p.name === "id" ? "id" : ""}") ${p.name}: ${p.type}`
      )
      .join(", ");
    
    let returnType = "any";
    if (m.name === "create" || m.name === "findOne") {
      returnType = `Promise<${pascalEntity}>`;
    } else if (m.name === "findAll") {
      returnType = `Promise<PaginatedResponseDto<${pascalEntity}>>`;
    } else if (m.name === "update") {
      returnType = "Promise<UpdateResult>";
    } else if (m.name === "remove") {
      returnType = "Promise<DeleteResult>";
    }

    content += `  ${m.name}(${params || ""}): ${returnType} {\n`;
    content += `    return this.service.${m.name}(${m.params
      .map((p: any) => p.name)
      .join(", ")});\n`;
    content += `  }\n\n`;
  });

  content += `}\n`;
  return content;
}

function getSummary(name: string, entity: string): string {
  const map: Record<string, string> = {
    create: `Create a new ${entity}`,
    findAll: `Get all ${entity} entities`,
    findOne: `Get ${entity} by ID`,
    update: `Update ${entity} by ID`,
    remove: `Delete ${entity} by ID`,
  };
  return map[name] || name;
}