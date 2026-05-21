import { KeyValuePair } from '../types';

export const mapHeadersToRecord = (headers: KeyValuePair[]): Record<string, string> => {
  return headers.reduce((acc, h) => {
    if (h.key) acc[h.key] = h.value;
    return acc;
  }, {} as Record<string, string>);
};

export const mapQueryParamsToRecord = (params: KeyValuePair[]): Record<string, string | string[]> => {
  return params.reduce((acc, p) => {
    if (p.key) {
      if (acc[p.key]) {
        acc[p.key] = Array.isArray(acc[p.key]) ? [...(acc[p.key] as string[]), p.value] : [acc[p.key] as string, p.value];
      } else {
        acc[p.key] = p.value;
      }
    }
    return acc;
  }, {} as Record<string, string | string[]>);
};

export const parseCurlToState = (parsedRequest: any): any => {
  const mappedHeaders = Object.entries(parsedRequest.headers || {}).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  if (!mappedHeaders.some(h => h.key.toLowerCase() === 'content-type') && parsedRequest.body) {
    mappedHeaders.push({ key: 'Content-Type', value: 'application/json' });
  }

  return {
    url: parsedRequest.url,
    method: parsedRequest.method,
    body: typeof parsedRequest.body === 'object' ? JSON.stringify(parsedRequest.body, null, 2) : String(parsedRequest.body || ''),
    headers: mappedHeaders,
    queryParams: parsedRequest.queryParams || [],
    authType: parsedRequest.authType || 'none',
    authToken: parsedRequest.authToken || '',
    basicUsername: parsedRequest.basicUsername || '',
    basicPassword: parsedRequest.basicPassword || '',
  };
};
