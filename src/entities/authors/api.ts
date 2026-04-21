import { authedRequest } from '../../io/publindex-http';
import { ENDPOINTS, buildTrayectoriaUrl } from '../../config/constants';
import { Session } from '../auth/types';
import { PersonSearchCriteria, PersonSearchResult, LinkAuthorPayload } from './types';

export async function searchPersons(
  session: Session,
  criteria: PersonSearchCriteria,
): Promise<PersonSearchResult[]> {
  const response = await authedRequest<PersonSearchResult[]>(session, ENDPOINTS.PERSONS_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = extractErrorMessage(response.data, response.status);
    throw new Error(`HTTP ${response.status} al buscar personas: ${msg}`);
  }

  return Array.isArray(response.data) ? response.data : [];
}

export async function getTrayectoria(
  session: Session,
  codRh: string,
  anoFasciculo: number,
): Promise<PersonSearchResult> {
  const url = buildTrayectoriaUrl(codRh, anoFasciculo);
  const response = await authedRequest<PersonSearchResult>(session, url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = extractErrorMessage(response.data, response.status);
    throw new Error(`HTTP ${response.status} al obtener trayectoria de ${codRh}: ${msg}`);
  }

  if (!response.data || typeof response.data !== 'object') {
    throw new Error(`Respuesta inesperada de trayectoria para codRh=${codRh}`);
  }

  return response.data;
}

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

function extractErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    return (d.mensaje as string) || (d.message as string) || JSON.stringify(d);
  }
  return `sin detalle (status ${status})`;
}
