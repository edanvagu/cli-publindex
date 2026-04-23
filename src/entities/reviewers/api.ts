import { authedRequest } from '../../io/publindex-http';
import { ENDPOINTS, buildReviewersByFasciculoUrl } from '../../config/constants';
import { Session } from '../auth/types';
import { PersonSearchResult } from '../persons/types';
import { extractErrorMessage } from '../persons/api';
import { LinkReviewerPayload } from './types';

export async function linkReviewer(session: Session, payload: LinkReviewerPayload): Promise<void> {
  const response = await authedRequest(session, ENDPOINTS.REVIEWERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = extractErrorMessage(response.data, response.status);
    throw new Error(`HTTP ${response.status} al vincular evaluador: ${msg}`);
  }
}

export async function listReviewersByFasciculo(
  session: Session,
  idFasciculo: number,
): Promise<PersonSearchResult[]> {
  const url = buildReviewersByFasciculoUrl(idFasciculo);
  const response = await authedRequest<PersonSearchResult[]>(session, url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = extractErrorMessage(response.data, response.status);
    throw new Error(`HTTP ${response.status} al listar evaluadores del fascículo ${idFasciculo}: ${msg}`);
  }

  return Array.isArray(response.data) ? response.data : [];
}
