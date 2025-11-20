// src/types/types.ts

/**
 * Información de una propiedad extraída de la entidad TypeORM
 */
export interface PropertyInfo {
  name: string;
  type: string;
  isOptional?: boolean;
  isRelationId?: boolean;
  description?: string;
}

/**
 * Información de un parámetro de método del servicio
 */
export interface ServiceParamInfo {
  name: string;
  type: string;
  isOptional?: boolean;
  defaultValue?: string;
}

/**
 * Información de un método detectado en el servicio
 */
export interface ServiceMethodInfo {
  name: string;
  params: ServiceParamInfo[];
  returnType: string;
}

/**
 * Decoradores comunes de @nestjs/common usados en controladores
 */
export const commonImports: string[] = [
  "Controller",
  "Get",
  "Post",
  "Patch",
  "Delete",
  "Body",
  "Param",
  "Query",
  "ParseIntPipe",
];

/**
 * Decoradores de @nestjs/swagger usados en controladores
 */
export const swaggerImports: string[] = [
  "ApiTags",
  "ApiOperation",
  "ApiResponse",
  "ApiParam",
  "ApiQuery",
];