import { spinner, error } from '../logger';
import { promptCredentials, selectIssue } from '../prompts';
import { login } from '../../entities/auth/api';
import { listIssues } from '../../entities/issues/api';
import { Session } from '../../entities/auth/types';
import { Issue } from '../../entities/issues/types';

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
    issues = await listIssues(session.token);
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
