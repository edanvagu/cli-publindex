import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EXTENSION_FILES, EXTENSION_FILE_COUNT } from '../generated/extension-bundle';
import { success, info, warning, error } from '../logger';
import { openInDefaultApp } from './shared';
import { EXTENSION_VERSION } from '../../config/version';

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

  success(`Extensión lista (v${EXTENSION_VERSION}).`);

  openInDefaultApp(PUBLINDEX_HOME);

  console.log('');
  info('Pasos en Chrome o Edge:');
  info('  1. Abra el navegador y pegue en la barra de direcciones:');
  info('       chrome://extensions/    (en Chrome)');
  info('       edge://extensions/      (en Edge)');
  info('  2. Active el toggle "Modo de desarrollador" (arriba a la derecha).');
  info('  3. Arrastre la carpeta "extension" desde el explorador a esa página,');
  info('     o haga click en "Cargar extensión sin empaquetar" y seleccione:');
  info(`       ${EXTENSION_INSTALL_DIR}`);
  info('  4. Si ya la había instalado antes, click en recargar (↻) en la tarjeta.');
  warning('Mantenga esta carpeta, ya que si la borra, el navegador perderá la extensión.');
}
