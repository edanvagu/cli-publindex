import { exec } from 'child_process';
import inquirer from 'inquirer';
import { spinner, success, error, info, warning } from '../logger';
import { promptCredentials, selectIssue, confirmContinue } from '../prompts';
import { login } from '../../entities/auth/api';
import { listIssues } from '../../entities/issues/api';
import { Session } from '../../entities/auth/types';
import { Issue } from '../../entities/issues/types';
import { DEFAULTS } from '../../config/constants';
import { formatDuration } from '../../utils/time';
import { ProgressTracker } from '../../io/progress';

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

export function openInDefaultApp(target: string): void {
  // `start ""` on Windows requires the empty title argument; macOS / Linux use `open` / `xdg-open`. The command fires asynchronously — errors are swallowed because we always print the path/URL alongside so the editor can fall back to copy-paste.
  const cmd =
    process.platform === 'win32'
      ? `start "" "${target.replace(/"/g, '\\"')}"`
      : process.platform === 'darwin'
        ? `open "${target}"`
        : `xdg-open "${target}"`;
  exec(cmd, () => {});
}

export function extractYear(dta: string | undefined | null): number | null {
  if (!dta) return null;
  const match = String(dta).match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
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

// Drives the sidecar → xlsx merge. When Excel is still locking the file, offers the editor an interactive retry loop — without this, a silent failure leaves the progress stranded in the JSON file until the next command run.
export async function flushProgressInteractive(tracker: ProgressTracker): Promise<void> {
  if (await tracker.trySyncSidecar()) return;

  console.log('');
  warning('El progreso quedó en un archivo JSON temporal porque el Excel está abierto.');
  while (true) {
    const { action } = await inquirer.prompt<{ action: 'retry' | 'later' }>([
      {
        type: 'list',
        name: 'action',
        message: '¿Qué desea hacer?',
        choices: [
          { name: 'Cerré el Excel, guardar progreso ahora', value: 'retry' },
          { name: 'Dejar el JSON temporal (se sincronizará la próxima vez)', value: 'later' },
        ],
      },
    ]);
    if (action === 'later') {
      info(
        'El progreso quedó en el archivo .progreso.json. La próxima vez que corra esta opción con el Excel cerrado se guardará automáticamente.',
      );
      return;
    }
    if (await tracker.trySyncSidecar()) {
      success('Progreso guardado en el Excel.');
      return;
    }
    warning('El archivo sigue bloqueado. ¿Ya cerró el Excel?');
  }
}
