import { spinner, error, info, warning } from '../logger';
import { promptCredentials, selectIssue, confirmContinue } from '../prompts';
import { login } from '../../entities/auth/api';
import { listIssues } from '../../entities/issues/api';
import { Session } from '../../entities/auth/types';
import { Issue } from '../../entities/issues/types';
import { DEFAULTS } from '../../config/constants';
import { formatDuration } from '../../utils/time';

export async function loginOrThrow(): Promise<Session> {
  const { username, password } = await promptCredentials();
  const sp = spinner('Iniciando sesión...');
  try {
    const session = await login(username, password);
    sp.succeed(`Sesión iniciada: ${session.nmeRevista}`);
    return session;
  } catch (err) {
    sp.fail('Login fallido');
    error('Verifique sus credenciales. NO se reintentará para evitar bloqueo de cuenta.');
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function fetchAndSelectIssue(session: Session): Promise<Issue> {
  const sp = spinner('Obteniendo fascículos...');
  let issues;
  try {
    issues = await listIssues(session);
    sp.succeed(`${issues.length} fascículos encontrados`);
  } catch (err) {
    sp.fail('Error al obtener fascículos');
    throw err instanceof Error ? err : new Error(String(err));
  }
  if (issues.length === 0) {
    throw new Error('No se encontraron fascículos en esta revista');
  }
  return selectIssue(issues);
}

export async function ensureTokenCoversEstimate(
  session: Session,
  estimatedSeconds: number,
  operationLabel: string,
): Promise<Session | null> {
  const remainingMs = session.expiresAt.getTime() - Date.now();
  const neededMs = estimatedSeconds * 1000 + DEFAULTS.PREFLIGHT_TOKEN_MARGIN_MS;
  if (neededMs <= remainingMs) return session;

  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
  const marginSec = Math.floor(DEFAULTS.PREFLIGHT_TOKEN_MARGIN_MS / 1000);

  console.log('');
  warning(`El token de sesión no cubre ${operationLabel} con margen seguro.`);
  console.log(`  Tiempo restante del token: ~${formatDuration(remainingSec)}`);
  console.log(`  Tiempo estimado: ~${formatDuration(estimatedSeconds)} (+ ${formatDuration(marginSec)} de margen)`);
  console.log('');

  const reauth = await confirmContinue('¿Volver a iniciar sesión ahora antes de arrancar? (No = cancelar)');
  if (!reauth) {
    info('Operación cancelada.');
    return null;
  }

  info('Cerrando sesión y volviendo a autenticar...');
  return await loginOrThrow();
}
