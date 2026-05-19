export interface KeyValuePair {
  key: string;
  value: string;
}

export interface FileData {
  fieldName: string;
  fileName: string;
  fileData: string; // base64
}

export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string | string[]>;
  body: any;
  authType: string;
  authToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  contentType: string;
  files: FileData[];
}

export interface SocketRequest {
  url: string;
  token: string;
  userId: string;
  eventName: string;
  payload: string;
  path: string;
  transports?: ('websocket' | 'polling')[];
}

export interface Collection {
  name: string;
  type: 'http' | 'socket';
  group?: string;
  // Common
  url?: string;
  // HTTP
  method?: string;
  body?: string;
  queryParams?: KeyValuePair[];
  headers?: KeyValuePair[];
  authType?: string;
  authToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  // Socket
  token?: string;
  userId?: string;
  eventName?: string;
  payload?: string;
  path?: string;
  transports?: ('websocket' | 'polling')[];
}

export interface HttpResponse {
  status: number;
  statusText: string;
  time: number;
  size: number;
  data: any;
}
