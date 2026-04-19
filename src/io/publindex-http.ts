import https from 'https';
import http from 'http';
import { URL } from 'url';
import { DEFAULTS } from '../config/constants';

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string | string[] | undefined>;
}

export function httpRequest<T = unknown>(
  url: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string | Buffer;
    timeout?: number;
  }
): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method,
        headers: options.headers || {},
        timeout: options.timeout || DEFAULTS.REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          let data: T;
          try {
            data = JSON.parse(body) as T;
          } catch {
            data = body as unknown as T;
          }
          resolve({
            status: res.statusCode || 0,
            data,
            headers: res.headers as Record<string, string | string[] | undefined>,
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout: la petición a ${url} excedió ${options.timeout || DEFAULTS.REQUEST_TIMEOUT_MS}ms`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

export function buildAuthHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://scienti.minciencias.gov.co',
    'Referer': 'https://scienti.minciencias.gov.co/publindex/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  };
}
