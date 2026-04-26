import https from 'https';
import http from 'http';
import zlib from 'zlib';
import { URL } from 'url';
import { DEFAULTS } from '../config/constants';
import type { Session } from '../entities/auth/types';
import { HttpError, NetworkError, extractErrorMessage, parseRetryAfter } from '../utils/http-errors';

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string | string[] | undefined>;
}

export const BROWSER_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-CO,es;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Origin: 'https://scienti.minciencias.gov.co',
  Referer: 'https://scienti.minciencias.gov.co/publindex/',
  DNT: '1',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'sec-ch-ua': '"Microsoft Edge";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0',
});

export function httpRequest<T = unknown>(
  url: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string | Buffer;
    timeout?: number;
  },
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
          const raw = Buffer.concat(chunks);
          decodeBody(raw, res.headers['content-encoding'])
            .then((body) => {
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
            })
            .catch(reject);
        });
      },
    );

    req.on('error', (err) => reject(new NetworkError(err.message, err)));
    req.on('timeout', () => {
      req.destroy();
      reject(
        new NetworkError(`Timeout: la petición a ${url} excedió ${options.timeout || DEFAULTS.REQUEST_TIMEOUT_MS}ms`),
      );
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function decodeBody(buf: Buffer, encoding: string | string[] | undefined): Promise<string> {
  const enc = (Array.isArray(encoding) ? encoding[0] : encoding || '').toLowerCase();
  if (!enc || enc === 'identity') {
    return Promise.resolve(buf.toString('utf-8'));
  }
  return new Promise((resolve, reject) => {
    const cb = (err: Error | null, out: Buffer) => {
      if (err) reject(err);
      else resolve(out.toString('utf-8'));
    };
    if (enc === 'gzip') zlib.gunzip(buf, cb);
    else if (enc === 'deflate') zlib.inflate(buf, cb);
    else if (enc === 'br') zlib.brotliDecompress(buf, cb);
    else resolve(buf.toString('utf-8'));
  });
}

export function buildAuthHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = {
    ...BROWSER_HEADERS,
    Authorization: `Bearer ${session.token}`,
  };
  const cookie = formatCookieHeader(session.cookies);
  if (cookie) headers['Cookie'] = cookie;
  return headers;
}

export async function authedRequest<T = unknown>(
  session: Session,
  url: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string | Buffer;
    timeout?: number;
  },
): Promise<HttpResponse<T>> {
  const response = await httpRequest<T>(url, {
    ...options,
    headers: { ...buildAuthHeaders(session), ...options.headers },
  });
  updateCookiesFromResponse(session, response);
  return response;
}

export function updateCookiesFromResponse(session: Session, response: HttpResponse<unknown>): void {
  const setCookie = response.headers?.['set-cookie'];
  if (!setCookie) return;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of list) {
    const first = raw.split(';')[0];
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name) session.cookies[name] = value;
  }
}

export function formatCookieHeader(jar: Record<string, string>): string {
  const pairs = Object.entries(jar || {});
  if (pairs.length === 0) return '';
  return pairs.map(([k, v]) => `${k}=${v}`).join('; ');
}

// Centralized "did the request succeed" check used by every API wrapper. Throws HttpError for non-2xx so the retry layer and circuit breaker can decide based on status, and so the error message stays consistent across modules.
export function ensureOk<T>(response: HttpResponse<T>, context: string): HttpResponse<T> {
  if (response.status >= 200 && response.status < 300) return response;
  const detail = extractErrorMessage(response.data, response.status);
  const retryAfterMs = parseRetryAfter(response.headers?.['retry-after']);
  throw new HttpError(response.status, `HTTP ${response.status} ${context}: ${detail}`, response.data, retryAfterMs);
}
