import { httpRequest, buildAuthHeaders } from '../../io/publindex-http';
import { ENDPOINTS } from '../../config/constants';
import { ArticlePayload } from './types';

export async function createArticle(token: string, payload: ArticlePayload): Promise<void> {
  const jsonStr = JSON.stringify(payload);

  // multipart/form-data manual — el endpoint espera el campo "articulo" (en español,
  // contrato del API Publindex) con el JSON del payload adentro.
  const boundary = '----PublindexCLI' + Date.now();
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="articulo"',
    '',
    jsonStr,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const response = await httpRequest(ENDPOINTS.ARTICLES, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(token),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = typeof response.data === 'string'
      ? response.data
      : (response.data as any)?.mensaje || (response.data as any)?.message || JSON.stringify(response.data);
    throw new Error(`HTTP ${response.status}: ${msg}`);
  }
}
