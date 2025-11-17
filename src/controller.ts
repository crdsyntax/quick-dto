interface ServiceMethodInfo {
  name: string;
  httpMethod: string; // 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
  route?: string;
  params: ParamInfo[];
  bodyType?: string;
  returnType: string;
  isCustom?: boolean;
  description?: string;
}

interface ParamInfo {
  name: string;
  type: string;
  source: 'param' | 'query' | 'body' | 'custom';
  isObject?: boolean;
}

function parseServiceMethods(serviceContent: string): ServiceMethodInfo[] {
  const methods: ServiceMethodInfo[] = [];
  const lines = serviceContent.split('\n');
  
  let currentMethod: Partial<ServiceMethodInfo> = {};
  let inMethod = false;
  let methodBody = '';
  let commentBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Capturar comentarios
    if (line.startsWith('//')) {
      commentBuffer += line.substring(2).trim() + ' ';
      continue;
    }

    // Detectar inicio de método
    const methodMatch = line.match(/async\s+(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>/);
    if (methodMatch && !line.includes('constructor')) {
      inMethod = true;
      const [, name, params, returnType] = methodMatch;
      
      currentMethod = {
        name,
        returnType,
        params: parseParams(params),
        description: commentBuffer.trim() || undefined
      };
      
      // Determinar HTTP method basado en el nombre y parámetros
      currentMethod.httpMethod = determineHttpMethod(name, currentMethod.params);
      currentMethod.route = determineRoute(name, currentMethod.params);
      currentMethod.bodyType = determineBodyType(currentMethod.params);
      
      commentBuffer = '';
      methodBody = '';
      continue;
    }

    // Capturar cuerpo del método
    if (inMethod) {
      methodBody += line + '\n';
      
      // Detectar fin del método (línea con solo '}')
      if (line === '}' && methodBody.includes('{')) {
        inMethod = false;
        
        // Analizar el cuerpo para más información
        analyzeMethodBody(currentMethod, methodBody);
        methods.push(currentMethod as ServiceMethodInfo);
        
        currentMethod = {};
        methodBody = '';
      }
    }

    // Resetear comentario si no es para un método
    if (line && !line.startsWith('//') && !inMethod) {
      commentBuffer = '';
    }
  }
  
  return methods;
}

function parseParams(paramsString: string): ParamInfo[] {
  if (!paramsString.trim()) return [];
  
  const params: ParamInfo[] = [];
  const paramList = paramsString.split(',').map(p => p.trim()).filter(p => p);
  
  for (const param of paramList) {
    const match = param.match(/(\w+)(\??):\s*([^,]+)/);
    if (match) {
      const [, name, optional, type] = match;
      
      let source: ParamInfo['source'] = 'custom';
      let isObject = false;
      
      // Determinar el tipo de parámetro
      if (type.includes('Dto') || type.includes('DTO')) {
        source = 'body';
        isObject = true;
      } else if (name === 'id' || name.includes('Id')) {
        source = 'param';
      } else if (['page', 'limit', 'skip', 'take'].includes(name)) {
        source = 'query';
      } else if (type === 'number' || type === 'string' || type === 'boolean') {
        source = 'query';
      }
      
      params.push({
        name,
        type,
        source,
        isObject
      });
    }
  }
  
  return params;
}

function determineHttpMethod(methodName: string, params: ParamInfo[]): string {
  const lowerName = methodName.toLowerCase();
  
  if (lowerName.startsWith('create') || lowerName.startsWith('add') || lowerName.startsWith('assign')) {
    return 'POST';
  }
  if (lowerName.startsWith('update') || lowerName.startsWith('modify') || lowerName.startsWith('change')) {
    return 'PATCH';
  }
  if (lowerName.startsWith('delete') || lowerName.startsWith('remove')) {
    return 'DELETE';
  }
  if (lowerName.startsWith('find') || lowerName.startsWith('get') || lowerName.startsWith('search')) {
    return 'GET';
  }
  
  // Por defecto basado en parámetros
  const hasBody = params.some(p => p.source === 'body');
  if (hasBody) return 'POST';
  
  return 'GET';
}

function determineRoute(methodName: string, params: ParamInfo[]): string {
  const lowerName = methodName.toLowerCase();
  const idParam = params.find(p => p.source === 'param');
  
  let baseRoute = '';
  
  // Rutas para métodos CRUD estándar
  if (lowerName === 'create') return '';
  if (lowerName === 'findall') return '';
  if (lowerName === 'findone' && idParam) return ':id';
  if (lowerName === 'update' && idParam) return ':id';
  if (lowerName === 'remove' && idParam) return ':id';
  
  // Métodos personalizados
  if (idParam) {
    baseRoute = `:id/`;
  }
  
  // Convertir camelCase a kebab-case
  const routeName = methodName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
  
  return baseRoute + routeName;
}

function determineBodyType(params: ParamInfo[]): string | undefined {
  const bodyParam = params.find(p => p.source === 'body');
  return bodyParam?.type;
}

function analyzeMethodBody(method: Partial<ServiceMethodInfo>, body: string): void {
  // Detectar si es una operación de asignación/relación
  if (method.name?.includes('assign') || method.name?.includes('relate')) {
    method.isCustom = true;
    
    // Buscar patrones comunes en el cuerpo
    if (body.includes('map(') && body.includes('create(')) {
      method.description = method.description || `Assign ${method.name.replace('assign', '')} to entity`;
    }
  }
  
  // Detectar operaciones de búsqueda complejas
  if (body.includes('findAndCount') || body.includes('createQueryBuilder')) {
    method.description = method.description || 'Complex search operation';
  }
  
  // Detectar si maneja arrays
  if (method.returnType?.includes('[]')) {
    method.description = method.description || 'Returns multiple items';
  }
}

// Y ahora actualizamos generateControllerContent para usar esta información detallada
function generateControllerContent(
  camelEntity: string,
  pascalEntity: string,
  serviceMethods: ServiceMethodInfo[]
): string {
  let imports = `import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  Query,`;
  
  // Agregar HttpCode si hay métodos POST/PUT/DELETE
  const hasNonGetMethods = serviceMethods.some(m => 
    m.httpMethod !== 'GET'
  );
  if (hasNonGetMethods) {
    imports += `\n  HttpCode,`;
    imports += `\n  HttpStatus,`;
  }
  
  imports += `\n} from "@nestjs/common";\n`;
  imports += `import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from "@nestjs/swagger";\n`;
  imports += `import { ${pascalEntity}Service } from "../services/${camelEntity}.service";\n`;
  imports += `import { ${pascalEntity} } from "../entities/${camelEntity}.entity";\n`;

  // Agregar imports de DTOs dinámicamente
  const usedDtos = new Set<string>();
  serviceMethods.forEach(method => {
    if (method.bodyType && method.bodyType.includes('Dto')) {
      usedDtos.add(method.bodyType);
    }
  });

  usedDtos.forEach(dtoType => {
    const dtoName = dtoType.replace('[]', '');
    const importPath = `../dto/${camelEntity}/${dtoName.toLowerCase().replace('dto', '')}.dto`;
    imports += `import { ${dtoName} } from "${importPath}";\n`;
  });

  // Agregar imports adicionales según los tipos de retorno
  if (serviceMethods.some(m => m.returnType.includes('PaginatedResponseDto'))) {
    imports += `import { PaginatedResponseDto } from "@/common/dto/generic-response.dto";\n`;
  }
  if (serviceMethods.some(m => m.returnType.includes('UpdateResult') || m.returnType.includes('DeleteResult'))) {
    imports += `import { DeleteResult, UpdateResult } from "typeorm";\n`;
  }

  let controllerClass = `\n@ApiTags("${pascalEntity}")
@Controller("${camelEntity}")
export class ${pascalEntity}Controller {
  constructor(private readonly service: ${pascalEntity}Service) {}\n`;

  // Generar endpoints basados en el análisis detallado
  serviceMethods.forEach(method => {
    const decorator = getHttpDecorator(method.httpMethod);
    const route = method.route || '';
    
    controllerClass += `\n  ${decorator}("${route}")`;
    
    // Agregar HttpCode para métodos no GET
    if (method.httpMethod !== 'GET') {
      controllerClass += `\n  @HttpCode(HttpStatus.OK)`;
    }
    
    controllerClass += `\n  @ApiOperation({ summary: "${method.description || `${method.name} ${pascalEntity}`}" })`;
    
    // Configurar ApiResponse basado en el tipo de retorno
    if (method.returnType.includes('[]')) {
      controllerClass += `\n  @ApiResponse({ status: 200, description: "Operación exitosa", type: [${pascalEntity}] })`;
    } else if (method.returnType !== 'void' && method.returnType !== 'Promise<void>') {
      controllerClass += `\n  @ApiResponse({ status: 200, description: "Operación exitosa", type: ${method.returnType.replace('Promise<', '').replace('>', '')} })`;
    }
    
    // Agregar ApiBody para métodos con body
    if (method.bodyType) {
      controllerClass += `\n  @ApiBody({ type: ${method.bodyType}, description: "Datos para ${method.name}" })`;
    }
    
    // Agregar ApiQuery para parámetros de query
    const queryParams = method.params.filter(p => p.source === 'query');
    queryParams.forEach(param => {
      controllerClass += `\n  @ApiQuery({ name: "${param.name}", type: ${param.type}, required: ${!param.name.includes('?')} })`;
    });
    
    // Generar la firma del método
    controllerClass += `\n  ${method.name}(`;
    
    const paramStrings = method.params.map(param => {
      const decorator = getParamDecorator(param.source);
      const pipe = param.type === 'number' ? ', ParseIntPipe' : '';
      
      if (param.source === 'body') {
        return `@Body() ${param.name}: ${param.type}`;
      } else if (param.source === 'param') {
        return `@Param("${param.name}"${pipe}) ${param.name}: ${param.type}`;
      } else if (param.source === 'query') {
        return `@Query("${param.name}"${pipe}) ${param.name}: ${param.type}`;
      } else {
        return `${param.name}: ${param.type}`;
      }
    });
    
    controllerClass += paramStrings.join(', ');
    controllerClass += `): ${method.returnType} {\n`;
    controllerClass += `    return this.service.${method.name}(${method.params.map(p => p.name).join(', ')});\n`;
    controllerClass += `  }\n`;
  });

  controllerClass += `}\n`;

  return imports + controllerClass;
}

function getHttpDecorator(httpMethod: string): string {
  switch (httpMethod) {
    case 'POST': return '@Post';
    case 'GET': return '@Get';
    case 'PUT': return '@Put';
    case 'PATCH': return '@Patch';
    case 'DELETE': return '@Delete';
    default: return '@Get';
  }
}

function getParamDecorator(source: ParamInfo['source']): string {
  switch (source) {
    case 'body': return 'Body';
    case 'param': return 'Param';
    case 'query': return 'Query';
    default: return 'Param';
  }
}