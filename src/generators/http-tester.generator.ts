import * as vscode from "vscode";
import axios, { AxiosRequestConfig, Method } from "axios";

export interface HttpRequest {
  url: string;
  method: Method;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: any;
  authType: "none" | "bearer" | "basic";
  authToken?: string;
  basicUsername?: string;
  basicPassword?: string;
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

function getDefaultValue(typeName: string): any {
  const type = typeName.toLowerCase();
  if (type.includes("string")) return "example string";
  if (type.includes("number") || type.includes("bigint")) return 123;
  if (type.includes("boolean")) return true;
  if (type.includes("date")) return "2025-12-07T05:00:00Z";
  // Manejo básico de arreglos y objetos
  if (type.includes("array") || type.includes("[]")) return [];
  if (type.includes("object") || type.includes("record")) return {};
  return null;
}

function parseDtoProperties(dtoContent: string): Record<string, any> {
  const body: Record<string, any> = {};

  // Regex: Busca (propiedad) opcional (?) o requerida, seguida de dos puntos (:) y el (tipo)
  // Captura: (propiedad) [?] : (tipo) [[]?];
  const propertyRegex = /(\w+)\??:\s*(\w+)(?:\[\])?\s*;/g;

  let match;
  while ((match = propertyRegex.exec(dtoContent)) !== null) {
    const [, propertyName, propertyType] = match;

    let finalType = propertyType;

    // Asignación de valor: se prefiere el valor basado en la decoración de Class Validator si está presente
    // Se busca en el texto inmediatamente anterior a la declaración de la propiedad.
    const prevCode = dtoContent.substring(
      Math.max(0, match.index - 200),
      match.index
    );

    if (prevCode.includes("@IsBoolean()")) {
      finalType = "boolean";
    } else if (prevCode.includes("@IsString()")) {
      finalType = "string";
    } else if (prevCode.includes("@IsNumber()")) {
      finalType = "number";
    } else if (prevCode.includes("@IsDate()")) {
      finalType = "date";
    }

    // Solo incluimos la propiedad si tiene un tipo inferible.
    if (finalType !== propertyType) {
      body[propertyName] = getDefaultValue(finalType);
    } else {
      // Si no se pudo inferir por decorador, usamos el tipo de TypeScript.
      body[propertyName] = getDefaultValue(propertyType);
    }
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

      const bodyMatch = paramsString.match(/@Body\s*\(\)\s*(\w+)/);
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

      const config: AxiosRequestConfig = {
        method: request.method,
        url: request.url,
        headers: this.prepareHeaders(request),
        params: request.queryParams,
        data: hasBody ? request.body : undefined,
        validateStatus: () => true,
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
