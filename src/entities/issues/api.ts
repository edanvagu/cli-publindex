import { authedRequest } from '../../io/publindex-http';
import { ENDPOINTS } from '../../config/constants';
import { Session } from '../auth/types';
import { Issue } from './types';

export async function listIssues(session: Session): Promise<Issue[]> {
  const response = await authedRequest<Issue[]>(session, ENDPOINTS.ISSUES, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status !== 200) {
    throw new Error(`Error al obtener fascículos: HTTP ${response.status}`);
  }

  if (!Array.isArray(response.data)) {
    throw new Error('Respuesta inesperada del servidor al listar fascículos');
  }

  return response.data;
}

export function formatIssue(f: Issue): string {
  const fecha = f.dtaPublicacion
    ? new Date(f.dtaPublicacion).toLocaleDateString('es-CO')
    : 'Sin fecha';
  const titulo = f.txtTituloEspecial ? ` - ${f.txtTituloEspecial}` : '';
  return `Vol. ${f.nroVolumen} No. ${f.nroNumero} (${fecha})${titulo}`;
}
