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

  // Regex mejorado: Busca propiedades con sus decoradores
  // Captura todo el bloque desde @ApiProperty hasta la declaración de la propiedad
  const propertyBlockRegex =
    /(@ApiProperty\([^)]*\)[\s\S]*?)?(\w+)\??:\s*(\w+)(?:\[\])?\s*;/g;

  let match;
  while ((match = propertyBlockRegex.exec(dtoContent)) !== null) {
    const [fullMatch, apiPropertyDecorator, propertyName, propertyType] = match;

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

    // 2. Si no hay ejemplo, buscar en el código anterior por decoradores de class-validator
    if (value === null) {
      const prevCode = dtoContent.substring(
        Math.max(0, match.index - 300),
        match.index
      );

      let finalType = propertyType;

      if (prevCode.includes("@IsBoolean()")) {
        finalType = "boolean";
      } else if (prevCode.includes("@IsString()")) {
        finalType = "string";
      } else if (prevCode.includes("@IsNumber()")) {
        finalType = "number";
      } else if (prevCode.includes("@IsDate()")) {
        finalType = "date";
      } else if (prevCode.includes("@IsEmail()")) {
        finalType = "email";
      } else if (prevCode.includes("@IsArray()")) {
        finalType = "array";
      }

      value = getDefaultValue(
        finalType !== propertyType ? finalType : propertyType,
        propertyName
      );
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

    const endpointRegex =
      /@(Get|Post|Patch|Put|Delete|Options|Head)\((?:'|")?([^'"]*)?(?:'|")?\)\s*\n\s*@ApiOperation\({ summary: "([^"]+)" }\)\s*\n(?:.|\n)*?\s*(?:async)?\s*(\w+)\s*\(([^)]*)\)/g;

    let match;
    while ((match = endpointRegex.exec(controllerCode)) !== null) {
      const [
        ,
        httpMethodDecorator,
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

      const config: AxiosRequestConfig = {
        method: request.method,
        url: request.url,
        headers: headers,
        params: request.queryParams,
        data: requestData,
        validateStatus: () => true,
        timeout: 10000,
      };

      const startTime = Date.now();
      const response = await axios(config);
      const endTime = Date.now();

      return {
        status: response.status,
        statusText: response.statusText,
        headers: this.formatHeaders(response.headers),
        data: response.data,
        time: endTime - startTime,
        size: this.calculateResponseSize(response),
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
        formatted[key] = headers[key];
      });
    }

    return formatted;
  }

  private calculateResponseSize(response: any): number {
    try {
      const headers = JSON.stringify(response.headers);
      const data =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
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
