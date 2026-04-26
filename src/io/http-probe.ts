import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface ProbeResult {
  ok: boolean;
  status?: number;
  error?: string;
}

const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

export async function probeUrl(url: string, timeoutMs: number = TIMEOUT_MS): Promise<ProbeResult> {
  const res = await doRequest(url, 'HEAD', timeoutMs, 0);
  if (res.status === 405 || res.status === 403) {
    return doRequest(url, 'GET', timeoutMs, 0);
  }
  return res;
}

function doRequest(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
  redirectCount: number,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false, error: `URL inválida: ${url}` });
      return;
    }

    const mod = parsed.protocol === 'http:' ? http : https;
    const req = mod.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        timeout: timeoutMs,
        headers: { 'User-Agent': 'publindex-cli/1.0' },
      },
      (response) => {
        const status = response.statusCode ?? 0;

        if (status >= 300 && status < 400 && response.headers.location && redirectCount < MAX_REDIRECTS) {
          response.resume();
          const nextUrl = new URL(response.headers.location, url).toString();
          doRequest(nextUrl, method, timeoutMs, redirectCount + 1).then(resolve);
          return;
        }

        response.resume();
        resolve({ ok: status >= 200 && status < 300, status });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });

    req.end();
  });
}

// Editors don't know what HTTP 503 or ECONNREFUSED mean — collapse the technical detail into a handful of plain-Spanish categories for the warning log.
export function humanizeProbeFailure(result: ProbeResult): string {
  if (result.status !== undefined) {
    if (result.status >= 500) return 'el sitio del editor falló al responder';
    if (result.status === 404 || result.status === 410) return 'la página ya no está disponible';
    if (result.status === 401 || result.status === 403) return 'el sitio bloqueó el acceso';
    if (result.status === 429) return 'el sitio limitó las solicitudes, intente más tarde';
    return 'el sitio rechazó la solicitud';
  }
  const err = result.error ?? '';
  if (err === 'timeout') return 'el sitio tardó demasiado en responder';
  if (err.startsWith('URL inválida')) return 'la dirección no es una URL válida';
  return 'no se pudo conectar al sitio';
}
