import inquirer from 'inquirer';
import { info, warning } from '../logger';

export async function showExtensionUsageHelp(): Promise<void> {
  console.log('');
  info('Cómo usar la extensión en Publindex:');
  console.log('');
  info('  1. Abra la extensión (ícono en la barra de Chrome, arriba a la derecha):');
  info('     a. Si no ve el ícono: clic en el rompecabezas (🧩) y fije "Publindex Autofill".');
  info('     b. Clic en el ícono → se abre el popup.');
  console.log('');
  info('  2. En el popup:');
  info('     a. Clic en "Cargar Excel" y seleccione el .xlsx generado por "Preparar plantilla".');
  info('     b. Verifique que los contadores (artículos / autores / evaluadores) coincidan.');
  console.log('');
  info('  3. Inicie sesión en Publindex.');
  console.log('');
  info('  4. Cargar ARTÍCULOS:');
  info('     a. Revista → Fascículo → Artículos → "Crear artículo".');
  info('     b. En la esquina inferior derecha aparece el widget flotante con la lista.');
  info('     c. Clic en un artículo → la extensión rellena todos los campos.');
  info('     d. Revise, ajuste si hace falta, y clic en "Guardar" de Publindex.');
  console.log('');
  info('  5. Vincular AUTORES a un artículo ya creado:');
  info('     a. Detalle del artículo → "Agregar autor" → modal "Buscar persona".');
  info('     b. El widget muestra los autores del Excel agrupados por título.');
  info('     c. Clic en un autor → se rellenan cédula, nombre y nacionalidad.');
  info('     d. Clic en "Buscar" (usted) y seleccione la persona correcta.');
  info('     e. Guarde. Repita para cada autor.');
  console.log('');
  info('  6. Vincular EVALUADORES al fascículo:');
  info('     a. Fascículo → Evaluadores → "Agregar evaluador" → modal "Buscar persona".');
  info('     b. El widget muestra la lista de evaluadores del Excel.');
  info('     c. Clic en uno → se rellena la búsqueda; usted busca, selecciona y guarda.');
  console.log('');
  warning(
    'La extensión NO escribe al Excel. Las columnas estado / id_articulo / fecha_subida quedan vacías en esta ruta — es normal.',
  );
  warning('Si el widget no aparece en un formulario, recargue la página (F5).');
  warning('Si minimiza el widget, use "Mostrar widget" en el popup para traerlo de vuelta.');
  console.log('');

  await inquirer.prompt([
    {
      type: 'input',
      name: '_',
      message: 'Presione Enter para volver al menú...',
    },
  ]);
}
