import * as vscode from 'vscode';
import axios, { AxiosRequestConfig, Method } from 'axios';

export interface HttpRequest {
    url: string;
    method: Method;
    headers: Record<string, string>;
    queryParams: Record<string, string>;
    body: any;
    authType: 'none' | 'bearer' | 'basic';
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

export class HttpTesterGenerator {
    private static instance: HttpTesterGenerator;
    
    private constructor() {}
    
    public static getInstance(): HttpTesterGenerator {
        if (!HttpTesterGenerator.instance) {
            HttpTesterGenerator.instance = new HttpTesterGenerator();
        }
        return HttpTesterGenerator.instance;
    }
    
    public async sendRequest(request: HttpRequest): Promise<HttpResponse> {
        try {
            const config: AxiosRequestConfig = {
                method: request.method,
                url: request.url,
                headers: this.prepareHeaders(request),
                params: request.queryParams,
                data: request.body,
                validateStatus: () => true // Accept all status codes
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
                size: this.calculateResponseSize(response)
            };
        } catch (error: any) {
            throw new Error(`Request failed: ${error.message}`);
        }
    }
    
    private prepareHeaders(request: HttpRequest): Record<string, string> {
        const headers: Record<string, string> = { ...request.headers };
        
        // Set Content-Type for POST/PUT/PATCH if body exists
        if (['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase()) && request.body) {
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
        }
        
        // Add authentication headers
        switch (request.authType) {
            case 'bearer':
                if (request.authToken) {
                    headers['Authorization'] = `Bearer ${request.authToken}`;
                }
                break;
            case 'basic':
                if (request.basicUsername && request.basicPassword) {
                    const credentials = Buffer.from(`${request.basicUsername}:${request.basicPassword}`).toString('base64');
                    headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
        }
        
        return headers;
    }
    
    private formatHeaders(headers: any): Record<string, string> {
        const formatted: Record<string, string> = {};
        
        if (headers) {
            Object.keys(headers).forEach(key => {
                formatted[key] = headers[key];
            });
        }
        
        return formatted;
    }
    
    private calculateResponseSize(response: any): number {
        try {
            const headers = JSON.stringify(response.headers);
            const data = typeof response.data === 'string' 
                ? response.data 
                : JSON.stringify(response.data);
            return new Blob([headers + data]).size;
        } catch {
            return 0;
        }
    }
    
    public formatJson(data: any): string {
        try {
            if (typeof data === 'string') {
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
    
    public parseUrl(url: string): { baseUrl: string; queryParams: Record<string, string> } {
        try {
            const urlObj = new URL(url);
            const queryParams: Record<string, string> = {};
            
            urlObj.searchParams.forEach((value, key) => {
                queryParams[key] = value;
            });
            
            return {
                baseUrl: `${urlObj.origin}${urlObj.pathname}`,
                queryParams
            };
        } catch {
            return { baseUrl: url, queryParams: {} };
        }
    }
}