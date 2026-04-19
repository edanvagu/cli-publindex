import { httpRequest } from './client';
import { ENDPOINTS } from '../config/constants';
import { LoginResponse, Session } from '../data/types';

export async function login(usuario: string, contrasena: string): Promise<Session> {
  const body = JSON.stringify({
    txtNombre: usuario,
    txtContrasena: contrasena,
  });

  const response = await httpRequest<LoginResponse>(ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://scienti.minciencias.gov.co',
      'Referer': 'https://scienti.minciencias.gov.co/publindex/',
    },
    body,
  });

  if (response.status !== 200 || !response.data?.token) {
    const msg = typeof response.data === 'string'
      ? response.data
      : (response.data as any)?.mensaje || (response.data as any)?.message || `Error HTTP ${response.status}`;
    throw new Error(`Login fallido: ${msg}`);
  }

  const data = response.data;
  const expiraEn = parseJwtExpiration(data.token);

  return {
    token: data.token,
    idRevista: data.idRevista,
    nmeRevista: data.nmeRevista,
    expiraEn,
  };
}

function parseJwtExpiration(token: string): Date {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return new Date(payload.exp * 1000);
  } catch {
    // Si no se puede parsear, asumir 1 hora
    return new Date(Date.now() + 3600 * 1000);
  }
}

export function tokenVigente(session: Session, margenMinutos: number = 5): boolean {
  const ahora = new Date();
  const limite = new Date(session.expiraEn.getTime() - margenMinutos * 60 * 1000);
  return ahora < limite;
}
