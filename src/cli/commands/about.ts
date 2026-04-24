import inquirer from 'inquirer';
import { info } from '../logger';

const GITHUB_URL = 'https://github.com/edanvagu';
const BREB_KEY = '@edward0225';

export async function showAbout(): Promise<void> {
  console.log('');
  info('  Aplicación de código abierto y de uso libre.');
  info('  Desarrollada por Edward Vásquez.');
  console.log('');
  info(`  GitHub:        ${GITHUB_URL}`);
  console.log('');
  info('  Si la herramienta te fue de utilidad y quieres apoyar nuevos desarrollos,');
  info(`  puedes enviar una donación por Bre-B a esta llave: ${BREB_KEY}`);
  console.log('');

  await inquirer.prompt([
    {
      type: 'input',
      name: '_',
      message: 'Presione Enter para volver al menú...',
    },
  ]);
}
