import { httpRequest, buildAuthHeaders } from './client';
import { ENDPOINTS } from '../config/constants';
import { Fasciculo } from '../data/types';

export async function listarFasciculos(token: string): Promise<Fasciculo[]> {
  const response = await httpRequest<Fasciculo[]>(ENDPOINTS.FASCICULOS, {
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

export function formatFasciculo(f: Fasciculo): string {
  const fecha = f.dtaPublicacion
    ? new Date(f.dtaPublicacion).toLocaleDateString('es-CO')
    : 'Sin fecha';
  const titulo = f.txtTituloEspecial ? ` - ${f.txtTituloEspecial}` : '';
  return `Vol. ${f.nroVolumen} No. ${f.nroNumero} (${fecha})${titulo}`;
}
