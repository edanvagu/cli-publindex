import inquirer from 'inquirer';
import { info, warning } from '../logger';

export async function showOjsExportHelp(): Promise<void> {
  console.log('');
  info('Cómo exportar desde OJS para Publindex:');
  console.log('');
  info('  1. XML (artículos del fascículo):');
  info('     a. Ingrese a OJS como editor.');
  info('     b. Herramientas → Importar/Exportar → Módulo XML nativo.');
  info('     c. Clic en "Exportar números".');
  info('     d. Seleccione UN solo número (el fascículo a cargar).');
  info('     e. Clic en "Exportar números" al final de la página.');
  info('     f. Guarde el .xml, preferiblemente en el Escritorio.');
  warning('     ⚠ No abra el .xml después de descargarlo: Excel puede corromper acentos y caracteres.');
  console.log('');
  info('  2. CSV (evaluadores del fascículo, opcional):');
  info('     a. Estadísticas → Generador de informes.');
  info('     b. Clic en "Informe de Revisión".');
  info('     c. Guarde el .csv, preferiblemente en el Escritorio.');
  warning('     ⚠ Tampoco abra el .csv después de descargarlo.');
  console.log('');

  await inquirer.prompt([
    {
      type: 'input',
      name: '_',
      message: 'Presione Enter para volver al menú...',
    },
  ]);
}
