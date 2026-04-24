import { PUBLINDEX_APP_URL } from '../../config/constants';
import { info } from '../logger';
import { openInDefaultApp } from './shared';

export async function openPublindex(): Promise<void> {
  openInDefaultApp(PUBLINDEX_APP_URL);
  info('Publindex abierto en el navegador. Use el widget de la extensión para rellenar los formularios.');
}
