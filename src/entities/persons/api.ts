import { authedRequest, ensureOk } from '../../io/publindex-http';
import { ENDPOINTS, buildTrayectoriaUrl } from '../../config/constants';
import { Session } from '../auth/types';
import { PersonSearchCriteria, PersonSearchResult } from './types';
import { HttpError } from '../../utils/http-errors';

export async function searchPersons(session: Session, criteria: PersonSearchCriteria): Promise<PersonSearchResult[]> {
  const response = await authedRequest<PersonSearchResult[]>(session, ENDPOINTS.PERSONS_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });
  ensureOk(response, 'al buscar personas');
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
  ensureOk(response, `al obtener trayectoria de ${codRh}`);

  if (!response.data || typeof response.data !== 'object') {
    throw new HttpError(502, `Respuesta inesperada de trayectoria para codRh=${codRh}`, response.data);
  }
  return response.data;
}
