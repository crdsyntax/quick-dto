import { HttpRequest } from '../types';

export function parseCurl(curl: string): Partial<HttpRequest> {
  const request: any = {
    url: '',
    method: 'GET',
    headers: {},
    body: '',
    queryParams: {},
    authType: 'none',
    authToken: '',
    basicUsername: '',
    basicPassword: '',
    contentType: 'application/json',
    files: []
  };

  // Remove newlines and extra spaces
  const cleanCurl = curl.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extract URL - usually the first string that doesn't start with -
  const tokens = splitArguments(cleanCurl);
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token === '-X' || token === '--request') {
      request.method = tokens[++i].toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const header = tokens[++i];
      const colonIdx = header.indexOf(':');
      if (colonIdx > -1) {
        const key = header.substring(0, colonIdx).trim();
        const value = header.substring(colonIdx + 1).trim();
        request.headers[key] = value;
        
        if (key.toLowerCase() === 'content-type') {
          request.contentType = value;
        }
        
        if (key.toLowerCase() === 'authorization') {
          if (value.toLowerCase().startsWith('bearer ')) {
            request.authType = 'bearer';
            request.authToken = value.substring(7);
          } else if (value.toLowerCase().startsWith('basic ')) {
            request.authType = 'basic';
            const decoded = atob(value.substring(6));
            const [u, p] = decoded.split(':');
            request.basicUsername = u;
            request.basicPassword = p;
          }
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      request.body = tokens[++i];
      if (request.method === 'GET') request.method = 'POST';
    } else if (token === '-u' || token === '--user') {
      const userPass = tokens[++i];
      const [u, p] = userPass.split(':');
      request.authType = 'basic';
      request.basicUsername = u;
      request.basicPassword = p || '';
    } else if (token.startsWith('http')) {
      request.url = token;
      // Extract query params
      try {
        const urlObj = new URL(token);
        request.url = urlObj.origin + urlObj.pathname;
        const params: any[] = [];
        urlObj.searchParams.forEach((value, key) => {
          params.push({ key, value });
        });
        request.queryParams = params;
      } catch (e) {
        // Fallback if URL is invalid but we want to keep it
      }
    }
  }

  // If no URL found by starting with http, try to find any token that isn't a flag or value
  if (!request.url) {
    for (const token of tokens) {
      if (token !== 'curl' && !token.startsWith('-') && !tokens.includes(token, tokens.indexOf(token) + 1)) {
        // This is a weak heuristic
      }
    }
  }

  return request;
}

function splitArguments(s: string): string[] {
  const args = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ((c === '"' || c === "'") && (i === 0 || s[i - 1] !== '\\')) {
      if (inQuotes && c === quoteChar) {
        inQuotes = false;
      } else if (!inQuotes) {
        inQuotes = true;
        quoteChar = c;
      } else {
        current += c;
      }
    } else if (c === ' ' && !inQuotes) {
      if (current) args.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  if (current) args.push(current);
  return args;
}
