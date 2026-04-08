import * as vscode from "vscode";
import axios, { AxiosRequestConfig, Method } from "axios";

export interface HttpRequest {
  url: string;
  method: Method;
  headers: Record<string, string>;
  queryParams: Record<string, string | string[]>;
  body: any;
  authType: "none" | "bearer" | "basic";
  authToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  contentType?: "json" | "formdata";
  files?: Array<{ fieldName: string; fileName: string; fileData: string }>;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time: number;
  size: number;
  // new properties for file downloads
  isBinary?: boolean;
  fileName?: string;
}

export interface HttpCollection {
  name: string;
  type: "http" | "socket";
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  body: string; // JSON string
  queryParams: { key: string; value: string }[];
  headers: { key: string; value: string }[];
  authType: "none" | "bearer" | "basic";
  authToken: string;
  basicUsername: string;
  basicPassword: string;
}

// Mocks de DTOs (simulación de la lectura de DTOs)
const mockDtos: Record<string, any> = {
  CreateNotificationDto: {
    recipientId: "user-uuid-12345",
    message: "This is a sample notification message.",
    type: "alert",
    isRead: false,
  },
  UpdateNotificationDto: {
    isRead: true,
    message: "Optional new message",
  },
};

function getDefaultValue(typeName: string, propertyName?: string): any {
  const type = typeName.toLowerCase();

  // Valores específicos basados en el nombre de la propiedad
  if (propertyName) {
    const propLower = propertyName.toLowerCase();
    if (propLower.includes("email")) return "user@example.com";
    if (propLower.includes("name")) return "Example Name";
    if (propLower.includes("id") && !propLower.includes("uuid")) return 1;
    if (propLower.includes("uuid") || propLower.includes("guid"))
      return "123e4567-e89b-12d3-a456-426614174000";
    if (propLower.includes("phone") || propLower.includes("telefono"))
      return "+1234567890";
    if (propLower.includes("url") || propLower.includes("link"))
      return "https://example.com";
    if (propLower.includes("description") || propLower.includes("descripcion"))
      return "Example description";
  }

  // Valores basados en el tipo
  if (type.includes("email")) return "user@example.com";
  if (type.includes("string")) return "example string";
  if (type.includes("number") || type.includes("bigint")) return 123;
  if (type.includes("boolean")) return true;
  if (type.includes("date")) return "2025-12-08T00:00:00Z";
  if (type.includes("array") || type.includes("[]")) return [];
  if (type.includes("object") || type.includes("record")) return {};

  return null;
}

function parseDtoProperties(dtoContent: string): Record<string, any> {
  const body: Record<string, any> = {};

  // Regex mejorado: captura decoradores previos (incluye @ApiProperty y @ApiPropertyOptional),
  // el nombre de la propiedad y el tipo (soporta tipos más complejos y arrays)
  // Captura todos los decoradores (cada uno puede o no tener paréntesis) y la declaración de propiedad
  const propertyBlockRegex = /((?:@\w+(?:\([\s\S]*?\))?\s*)*)\s*(?:public|private|protected)?\s*(\w+)\??\s*:\s*([^;]+)\s*;/g;

  let match;
  while ((match = propertyBlockRegex.exec(dtoContent)) !== null) {
    const [fullMatch, decoratorsBlock, propertyName, propertyTypeRaw] = match;
    const propertyType = propertyTypeRaw.trim();

    // Encontrar si dentro de los decoradores existe @ApiProperty o @ApiPropertyOptional
    const apiPropertyMatch = /@ApiProperty(?:Optional)?\([\s\S]*?}\s*\)/s.exec(decoratorsBlock || "");
    const apiPropertyDecorator = apiPropertyMatch ? apiPropertyMatch[0] : null;

    let value: any = null;

    // 1. Intentar extraer el valor de ejemplo de @ApiProperty
    if (apiPropertyDecorator) {
      const exampleMatch = apiPropertyDecorator.match(/example:\s*([^,}\n]+)/);
      if (exampleMatch) {
        const exampleValue = exampleMatch[1].trim();
        // Limpiar el valor (remover comillas, espacios, etc.)
        if (exampleValue.startsWith('"') || exampleValue.startsWith("'")) {
          value = exampleValue.slice(1, -1);
        } else if (exampleValue === "true" || exampleValue === "false") {
          value = exampleValue === "true";
        } else if (!isNaN(Number(exampleValue))) {
          value = Number(exampleValue);
        } else {
          value = exampleValue;
        }
      }
    }

    // 2. Si no hay ejemplo, inferir por los decoradores (declarados justo antes de la propiedad)
    if (value === null) {
      const decorators = decoratorsBlock || "";
      let inferredType = propertyType;

      if (/\bIsBoolean\b/.test(decorators)) inferredType = 'boolean';
      else if (/\bIsDateString\b|\bIsDate\b/.test(decorators)) inferredType = 'date';
      else if (/\bIsEmail\b/.test(decorators)) inferredType = 'email';
      else if (/\bIsArray\b/.test(decorators)) inferredType = 'array';
      else if (/\bIsInt\b|\bIsNumber\b|\bIsNumberString\b/.test(decorators)) inferredType = 'number';
      else if (/@Type\s*\(\s*\(\s*\)\s*=>\s*Number\s*\)/.test(decorators)) inferredType = 'number';

      // Si el tipo es array o contiene Array<>, devolver arreglo vacío
      if (/\[\]$/.test(propertyType) || /Array<|\barray\b/i.test(propertyType) || inferredType === 'array') {
        value = [];
      } else {
        value = getDefaultValue(inferredType, propertyName);
      }
    }

    body[propertyName] = value;
  }

  return body;
}
export class HttpTesterGenerator {
  private static instance: HttpTesterGenerator;

  private constructor() {}

  public static generateCollectionsFromController(
    controllerCode: string,
    baseUrl: string,
    dtoContents: Record<string, string> // Aceptar contenido de DTOs
  ): HttpCollection[] {
    const collections: HttpCollection[] = [];

    const controllerMatch = controllerCode.match(
      /@Controller\((?:'|")([^'"]+)(?:'|")\)/
    );
    const basePath = controllerMatch ? controllerMatch[1] : "default";

    const endpointRegex = /@(Get|Post|Patch|Put|Delete|Options|Head)\(\s*(['"`])?([^'"\)]*)\2?\s*\)\s*(?:@ApiOperation\(\s*{[^}]*summary:\s*["']([^"']+)["'][^}]*}\)\s*)?[\s\S]*?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)/gi;

    let match;
    while ((match = endpointRegex.exec(controllerCode)) !== null) {
      const [
        ,
        httpMethodDecorator,
        ,
        pathSegment,
        summary,
        functionName,
        paramsString,
      ] = match;

      const httpMethod =
        httpMethodDecorator.toUpperCase() as HttpCollection["method"];
      let fullPath = `/${basePath}/${pathSegment || ""}`
        .replace(/\/+/g, "/")
        .replace(/\/$/, "");

      const bodyMatch = paramsString.match(/@Body\s*\(\)\s*\w+:\s*(\w+)/);
      const paramMatch = paramsString.match(/@Param\("([^"]+)"\)\s*(\w+)/);

      const bodyDtoName = bodyMatch ? bodyMatch[1] : null;
      let bodyContent = "";

      if (bodyDtoName && dtoContents[bodyDtoName]) {
        const parsedBody = parseDtoProperties(dtoContents[bodyDtoName]);
        bodyContent = JSON.stringify(parsedBody, null, 2);
      } else if (
        httpMethod !== "GET" &&
        httpMethod !== "HEAD" &&
        httpMethod !== "OPTIONS"
      ) {
        bodyContent = "{}";
      }

      const queryParams: { key: string; value: string }[] = [];

      if (paramMatch) {
        const paramName = paramMatch[1];
        if (pathSegment && pathSegment.includes(`:${paramName}`)) {
          fullPath = fullPath.replace(`:${paramName}`, `example-${paramName}`);
        }
      }

      const collection: HttpCollection = {
        name: `${basePath.toUpperCase()}: ${summary || functionName}`,
        type: "http",
        url: `${baseUrl}${fullPath}`,
        method: httpMethod,
        body: ["POST", "PUT", "PATCH"].includes(httpMethod) ? bodyContent : "",
        queryParams: queryParams,
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Accept", value: "application/json" },
        ],
        authType: "bearer",
        authToken: "{{YOUR_AUTH_TOKEN}}",
        basicUsername: "",
        basicPassword: "",
      };

      collections.push(collection);
    }

    return collections;
  }

  public static getInstance(): HttpTesterGenerator {
    if (!HttpTesterGenerator.instance) {
      HttpTesterGenerator.instance = new HttpTesterGenerator();
    }
    return HttpTesterGenerator.instance;
  }

  public async execute(request: HttpRequest): Promise<HttpResponse> {
    return await this.sendRequest(request);
  }

  public async sendRequest(request: HttpRequest): Promise<HttpResponse> {
    try {
      const hasBody = ["POST", "PUT", "PATCH"].includes(
        request.method.toUpperCase()
      );

      let requestData: any;
      const headers = this.prepareHeaders(request);

      // Handle FormData
      if (request.contentType === "formdata" && hasBody) {
        const FormData = require("form-data");
        const formData = new FormData();

        // Add files if present
        if (request.files && request.files.length > 0) {
          for (const file of request.files) {
            const buffer = Buffer.from(file.fileData, "base64");
            formData.append(file.fieldName, buffer, file.fileName);
          }
        }

        // Add JSON body fields as form fields
        if (request.body && typeof request.body === "object") {
          for (const [key, value] of Object.entries(request.body)) {
            formData.append(key, value as string);
          }
        }

        requestData = formData;
        // FormData sets its own Content-Type with boundary
        Object.assign(headers, formData.getHeaders());
      } else {
        requestData = hasBody ? request.body : undefined;
      }

      // always request an arraybuffer so we can handle binary downloads
      const config: AxiosRequestConfig = {
        method: request.method,
        url: request.url,
        headers: headers,
        params: request.queryParams,
        data: requestData,
        validateStatus: () => true,
        timeout: 10000,
        responseType: "arraybuffer",
      };

      const startTime = Date.now();
      const response = await axios(config);
      const endTime = Date.now();

      const formattedHeaders = this.formatHeaders(response.headers);
      const contentType = (formattedHeaders["content-type"] || "").toLowerCase();
      let responseBody: any = response.data;
      let isBinary = false;
      let fileName: string | undefined;

      // attempt to extract filename from content-disposition
      if (formattedHeaders["content-disposition"]) {
        fileName = this.getFileNameFromDisposition(
          formattedHeaders["content-disposition"]
        );
      }

      // convert the ArrayBuffer to Buffer for inspection
      if (response.data && (response.data instanceof ArrayBuffer || Buffer.isBuffer(response.data))) {
        const buffer = Buffer.from(response.data as ArrayBuffer);

        // determine if the response should be treated as binary or text
        const textualContent =
          contentType.startsWith("application/json") ||
          contentType.startsWith("text/") ||
          contentType.includes("xml") ||
          contentType.includes("javascript") ||
          // if content-type is missing we assume text
          contentType === "";

        // some known binary prefixes
        const binaryPrefixes = [
          "application/octet-stream",
          "application/pdf",
          "image/",
          "audio/",
          "video/",
        ];
        const isKnownBinary = binaryPrefixes.some((p) =>
          contentType.startsWith(p)
        );

        if (!isKnownBinary) {
          // treat as text even if content-type is unusual
          const text = buffer.toString("utf-8");
          if (textualContent) {
            try {
              responseBody = JSON.parse(text);
            } catch {
              responseBody = text;
            }
          } else {
            // if content-type isn't clearly text we still try to parse, otherwise fall back
            try {
              responseBody = JSON.parse(text);
            } catch {
              responseBody = text;
            }
          }
        } else {
          // binary payload - return base64 so the webview can download it
          isBinary = true;
          responseBody = buffer.toString("base64");
        }
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: formattedHeaders,
        data: responseBody,
        time: endTime - startTime,
        size: this.calculateResponseSize(response),
        isBinary,
        fileName,
      };
    } catch (error: any) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  private prepareHeaders(request: HttpRequest): Record<string, string> {
    const headers: Record<string, string> = { ...request.headers };

    if (
      ["POST", "PUT", "PATCH"].includes(request.method.toUpperCase()) &&
      request.body &&
      request.body !== "null"
    ) {
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    switch (request.authType) {
      case "bearer":
        if (request.authToken) {
          headers["Authorization"] = `Bearer ${request.authToken}`;
        }
        break;
      case "basic":
        if (request.basicUsername && request.basicPassword) {
          const credentials = Buffer.from(
            `${request.basicUsername}:${request.basicPassword}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;
    }

    return headers;
  }

  private formatHeaders(headers: any): Record<string, string> {
    const formatted: Record<string, string> = {};

    if (headers) {
      Object.keys(headers).forEach((key) => {
        formatted[key.toLowerCase()] = headers[key];
      });
    }

    return formatted;
  }

  /**
   * Extrae el nombre de archivo de un header Content-Disposition si existe.
   */
  private getFileNameFromDisposition(disposition: string): string | undefined {
    try {
      const match = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/.exec(
        disposition
      );
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private calculateResponseSize(response: any): number {
    try {
      const headers = JSON.stringify(response.headers);
      let data;
      if (response.data && typeof response.data === "string") {
        data = response.data;
      } else if (response.data && response.data instanceof ArrayBuffer) {
        data = Buffer.from(response.data).toString("binary");
      } else {
        data = JSON.stringify(response.data);
      }
      return new Blob([headers + data]).size;
    } catch {
      return 0;
    }
  }

  public formatJson(data: any): string {
    try {
      if (typeof data === "string") {
        return JSON.stringify(JSON.parse(data), null, 2);
      }
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  public isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  public parseUrl(url: string): {
    baseUrl: string;
    queryParams: Record<string, string>;
  } {
    try {
      const urlObj = new URL(url);
      const queryParams: Record<string, string> = {};

      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      return {
        baseUrl: `${urlObj.origin}${urlObj.pathname}`,
        queryParams,
      };
    } catch {
      return { baseUrl: url, queryParams: {} };
    }
  }
}
