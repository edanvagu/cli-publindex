import { authedRequest } from '../../io/publindex-http';
import { ENDPOINTS, buildAuthorsByArticleUrl } from '../../config/constants';
import { Session } from '../auth/types';
import { PersonSearchResult } from '../persons/types';
import { extractErrorMessage } from '../persons/api';
import { LinkAuthorPayload } from './types';

export { searchPersons, getTrayectoria } from '../persons/api';

export async function linkAuthor(session: Session, payload: LinkAuthorPayload): Promise<void> {
  const response = await authedRequest(session, ENDPOINTS.AUTHORS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = extractErrorMessage(response.data, response.status);
    throw new Error(`HTTP ${response.status} al vincular autor: ${msg}`);
  }
}

export async function listAuthorsByArticle(session: Session, idArticulo: number): Promise<PersonSearchResult[]> {
  const url = buildAuthorsByArticleUrl(idArticulo);
  const response = await authedRequest<PersonSearchResult[]>(session, url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = extractErrorMessage(response.data, response.status);
    throw new Error(`HTTP ${response.status} al listar autores del artículo ${idArticulo}: ${msg}`);
  }

  return Array.isArray(response.data) ? response.data : [];
}
