import { authedRequest, ensureOk } from '../../io/publindex-http';
import { ENDPOINTS, buildAuthorsByArticleUrl } from '../../config/constants';
import { Session } from '../auth/types';
import { PersonSearchResult } from '../persons/types';
import { LinkAuthorPayload } from './types';
import { assertValidLinkAuthorPayload } from './payload-schema';

export { searchPersons, getTrayectoria } from '../persons/api';

export async function linkAuthor(session: Session, payload: LinkAuthorPayload): Promise<void> {
  assertValidLinkAuthorPayload(payload);
  const response = await authedRequest(session, ENDPOINTS.AUTHORS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  ensureOk(response, 'al vincular autor');
}

export async function listAuthorsByArticle(session: Session, idArticulo: number): Promise<PersonSearchResult[]> {
  const url = buildAuthorsByArticleUrl(idArticulo);
  const response = await authedRequest<PersonSearchResult[]>(session, url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  ensureOk(response, `al listar autores del artículo ${idArticulo}`);
  return Array.isArray(response.data) ? response.data : [];
}
