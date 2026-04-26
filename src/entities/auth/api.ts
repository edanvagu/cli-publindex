import { httpRequest, BROWSER_HEADERS, updateCookiesFromResponse } from '../../io/publindex-http';
import { ENDPOINTS } from '../../config/constants';
import { LoginResponse, Session } from './types';
import { extractErrorMessage } from '../../utils/http-errors';

export async function login(username: string, password: string): Promise<Session> {
  const body = JSON.stringify({
    txtNombre: username,
    txtContrasena: password,
  });

  // Login is intentionally NOT routed through retry/circuit-breaker: a wrong password retried 3x can lock the account at the server level. The plain Error keeps the existing CLI try/catch working without forcing a retry decision upstream.
  const response = await httpRequest<LoginResponse>(ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (response.status !== 200 || !response.data?.token) {
    throw new Error(`Login fallido: ${extractErrorMessage(response.data, response.status)}`);
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
