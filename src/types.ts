export interface ServiceParamInfo {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface PropertyInfo {
  name: string;
  type: string;
  isOptional: boolean;
  isRelationId?: boolean;
  description?: string;
}

export interface ServiceMethodInfo {
  name: string;
  params: ServiceParamInfo[];
  returnType: string;
}

export const commonImports = [
  "Controller",
  "Get",
  "Post",
  "Body",
  "Param",
  "Patch",
  "Delete",
  "ParseIntPipe",
  "Query",
];
export const swaggerImports = [
  "ApiTags",
  "ApiOperation",
  "ApiResponse",
  "ApiQuery",
  "ApiParam",
];
