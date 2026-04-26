import { authedRequest, ensureOk } from '../../io/publindex-http';
import { ENDPOINTS, buildReviewersByFasciculoUrl } from '../../config/constants';
import { Session } from '../auth/types';
import { PersonSearchResult } from '../persons/types';
import { LinkReviewerPayload } from './types';
import { assertValidLinkReviewerPayload } from './payload-schema';

export async function linkReviewer(session: Session, payload: LinkReviewerPayload): Promise<void> {
  assertValidLinkReviewerPayload(payload);
  const response = await authedRequest(session, ENDPOINTS.REVIEWERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  ensureOk(response, 'al vincular evaluador');
}

export async function listReviewersByFasciculo(session: Session, idFasciculo: number): Promise<PersonSearchResult[]> {
  const url = buildReviewersByFasciculoUrl(idFasciculo);
  const response = await authedRequest<PersonSearchResult[]>(session, url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  ensureOk(response, `al listar evaluadores del fascículo ${idFasciculo}`);
  return Array.isArray(response.data) ? response.data : [];
}
