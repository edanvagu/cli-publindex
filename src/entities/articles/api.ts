import { authedRequest } from '../../io/publindex-http';
import { ENDPOINTS } from '../../config/constants';
import { Session } from '../auth/types';
import { ArticlePayload } from './types';

export async function createArticle(session: Session, payload: ArticlePayload): Promise<number> {
  const jsonStr = JSON.stringify(payload);

  // Built manually because the endpoint expects a single multipart field literally named `articulo` (Spanish — Publindex API contract) carrying the payload JSON.
  const boundary = '----PublindexCLI' + Date.now();
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="articulo"',
    '',
    jsonStr,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const response = await authedRequest(session, ENDPOINTS.ARTICLES, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = typeof response.data === 'string'
      ? response.data
      : (response.data as any)?.mensaje || (response.data as any)?.message || JSON.stringify(response.data);
    throw new Error(`HTTP ${response.status}: ${msg}`);
  }

  // POST /articulos returns the new article id as a plain-text integer (e.g. "999999").
  const raw = typeof response.data === 'string' ? response.data.trim() : String(response.data);
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    throw new Error(`Response inesperado del POST /articulos (no es un entero): "${raw}"`);
  }
  return id;
}
