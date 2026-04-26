import { httpRequest, BROWSER_HEADERS, updateCookiesFromResponse } from '../../io/publindex-http';
import { ENDPOINTS } from '../../config/constants';
import { LoginResponse, Session } from './types';

export async function login(username: string, password: string): Promise<Session> {
  const body = JSON.stringify({
    txtNombre: username,
    txtContrasena: password,
  });

  const response = await httpRequest<LoginResponse>(ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (response.status !== 200 || !response.data?.token) {
    const msg =
      typeof response.data === 'string'
        ? response.data
        : (response.data as any)?.mensaje || (response.data as any)?.message || `Error HTTP ${response.status}`;
    throw new Error(`Login fallido: ${msg}`);
  }

  const data = response.data;
  const expiresAt = parseJwtExpiration(data.token);

  const session: Session = {
    token: data.token,
    idRevista: data.idRevista,
    nmeRevista: data.nmeRevista,
    expiresAt,
    cookies: {},
  };
  updateCookiesFromResponse(session, response);
  return session;
}

function parseJwtExpiration(token: string): Date {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return new Date(payload.exp * 1000);
  } catch {
    // Fall back to a conservative 1h validity if the JWT can't be decoded — the pre-flight token check downstream will surface a real issue if the guess is wrong.
    return new Date(Date.now() + 3600 * 1000);
  }
}
