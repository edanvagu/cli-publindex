import { httpRequest, buildAuthHeaders } from '../../io/publindex-http';
import { ENDPOINTS } from '../../config/constants';
import { Issue } from './types';

export async function listIssues(token: string): Promise<Issue[]> {
  const response = await httpRequest<Issue[]>(ENDPOINTS.ISSUES, {
    method: 'GET',
    headers: {
      ...buildAuthHeaders(token),
      'Content-Type': 'application/json',
    },
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
