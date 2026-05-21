export interface PropertyTemplate {
  name: string;
  snippet: string;
}

export interface DtoImports {
  classValidator: string[];
  swagger: string[];
  transformer: string[];
}

export interface WebviewMessage {
  command: string;
  snippet?: string;
  imports?: DtoImports;
  text?: string;
}
