import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { EXTENSION_FILES, EXTENSION_FILE_COUNT } from '../generated/extension-bundle';
import { success, info, warning, error } from '../logger';
import { openInDefaultApp } from './shared';

const PUBLINDEX_HOME =
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Publindex')
    : path.join(os.homedir(), '.publindex');

export const EXTENSION_INSTALL_DIR = path.join(PUBLINDEX_HOME, 'extension');

export async function installExtension(): Promise<void> {
  if (EXTENSION_FILE_COUNT === 0) {
    error(
      'Esta versión del CLI no incluye la extensión empacada. Si eres desarrollador, ejecuta:\n  npm run ext:build && npm run embed:ext\nSi eres editor, actualiza a la última release desde GitHub.',
    );
    return;
  }

  info(`Extrayendo ${EXTENSION_FILE_COUNT} archivos a: ${EXTENSION_INSTALL_DIR}`);
  fs.mkdirSync(EXTENSION_INSTALL_DIR, { recursive: true });

  for (const [rel, b64] of Object.entries(EXTENSION_FILES)) {
    const full = path.join(EXTENSION_INSTALL_DIR, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, Buffer.from(b64, 'base64'));
  }

  success('Extensión lista.');

  openInDefaultApp(EXTENSION_INSTALL_DIR);
  // chrome:// URLs aren't registered protocols with the Windows shell, so `start "" "chrome://..."` silently fails. We have to invoke `chrome` as the executable (cmd resolves it via the "App Paths" registry entry even when chrome.exe isn't in PATH). The empty "" title is mandatory before the command.
  if (process.platform === 'win32') {
    exec('start "" chrome "chrome://extensions/"', () => {});
  } else if (process.platform === 'darwin') {
    exec('open -a "Google Chrome" "chrome://extensions/"', () => {});
  }

  console.log('');
  info('Pasos en Chrome:');
  info('  1. Active el toggle "Modo de desarrollador" (arriba a la derecha).');
  info('  2. Click en "Cargar descomprimida" y seleccione la carpeta que se abrió.');
  info('  3. Si ya la había instalado antes, click en recargar (↻) en la tarjeta.');
  warning('Mantenga esta carpeta — si la borra, Chrome perderá la extensión.');
}
