import inquirer from 'inquirer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { Fasciculo, ModoEjecucion } from '../data/types';
import { formatFasciculo } from '../api/fasciculos';
import { formatearTiempo } from '../pipeline/runner';

export async function pedirCredenciales(): Promise<{ usuario: string; contrasena: string }> {
  const { usuario } = await inquirer.prompt([
    {
      type: 'input',
      name: 'usuario',
      message: 'Usuario de Publindex:',
      validate: (v: string) => v.trim() ? true : 'El usuario es obligatorio',
    },
  ]);

  const { contrasena } = await inquirer.prompt([
    {
      type: 'password',
      name: 'contrasena',
      message: 'Contraseña:',
      mask: '•',
      validate: (v: string) => v ? true : 'La contraseña es obligatoria',
    },
  ]);

  const { confirmado } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmado',
      message: `¿Es correcto el usuario "${usuario}"?`,
      default: true,
    },
  ]);

  if (!confirmado) {
    return pedirCredenciales();
  }

  return { usuario: usuario.trim(), contrasena };
}

export async function seleccionarFasciculo(fasciculos: Fasciculo[]): Promise<Fasciculo> {
  const choices = fasciculos.map(f => ({
    name: formatFasciculo(f),
    value: f,
  }));

  const { fasciculo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'fasciculo',
      message: 'Seleccione el fascículo:',
      choices,
      pageSize: 15,
    },
  ]);

  const { confirmado } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmado',
      message: `¿Confirma ${formatFasciculo(fasciculo)}?`,
      default: true,
    },
  ]);

  if (!confirmado) {
    return seleccionarFasciculo(fasciculos);
  }

  return fasciculo;
}

export async function pedirArchivo(): Promise<string> {
  const { metodo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'metodo',
      message: '¿Cómo desea seleccionar el archivo?',
      choices: [
        { name: 'Abrir explorador de archivos', value: 'explorador' },
        { name: 'Escribir la ruta manualmente', value: 'manual' },
      ],
    },
  ]);

  if (metodo === 'explorador') {
    return abrirExploradorArchivos();
  }

  const { archivo } = await inquirer.prompt([
    {
      type: 'input',
      name: 'archivo',
      message: 'Ruta del archivo (puede arrastrar el archivo aquí):',
      validate: (v: string) => validarRutaArchivo(v),
    },
  ]);

  return limpiarRuta(archivo);
}

function abrirExploradorArchivos(): Promise<string> {
  try {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Filter = 'Archivos de datos (*.xlsx;*.xls;*.csv)|*.xlsx;*.xls;*.csv|Todos los archivos (*.*)|*.*'
$dialog.Title = 'Seleccionar archivo de artículos'
$dialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')
if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }
`.trim().replace(/\n/g, '; ');

    const resultado = execSync(`powershell -Command "${psScript}"`, {
      encoding: 'utf-8',
      timeout: 60000,
    }).trim();

    if (!resultado) {
      throw new Error('No se seleccionó ningún archivo');
    }

    if (!fs.existsSync(resultado)) {
      throw new Error(`Archivo no encontrado: ${resultado}`);
    }

    return Promise.resolve(resultado);
  } catch (err) {
    console.log('');
    console.log('  No se pudo abrir el explorador. Escriba la ruta manualmente.');
    return pedirArchivoManual();
  }
}

async function pedirArchivoManual(): Promise<string> {
  const { archivo } = await inquirer.prompt([
    {
      type: 'input',
      name: 'archivo',
      message: 'Ruta del archivo (puede arrastrar el archivo aquí):',
      validate: (v: string) => validarRutaArchivo(v),
    },
  ]);

  return limpiarRuta(archivo);
}

function limpiarRuta(ruta: string): string {
  // Quitar comillas que Windows agrega al arrastrar archivos con espacios
  return ruta.trim().replace(/^["']|["']$/g, '');
}

function validarRutaArchivo(v: string): string | true {
  const ruta = limpiarRuta(v);
  if (!ruta) return 'La ruta del archivo es obligatoria';
  const ext = ruta.toLowerCase();
  if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
    return 'El archivo debe ser .xlsx, .xls o .csv';
  }
  if (!fs.existsSync(ruta)) {
    return `Archivo no encontrado: ${ruta}`;
  }
  return true;
}

export async function confirmarContinuar(msg: string): Promise<boolean> {
  const { continuar } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continuar',
      message: msg,
      default: true,
    },
  ]);
  return continuar;
}

export async function menuPrincipal(): Promise<ModoEjecucion> {
  const { opcion } = await inquirer.prompt([
    {
      type: 'list',
      name: 'opcion',
      message: '¿Qué desea hacer?',
      choices: [
        { name: 'Validar archivo de artículos', value: 'validar' as ModoEjecucion },
        { name: 'Validar y cargar artículos', value: 'cargar' as ModoEjecucion },
        { name: 'Generar plantilla Excel', value: 'plantilla' as ModoEjecucion },
        { name: 'Salir', value: 'salir' as ModoEjecucion },
      ],
    },
  ]);
  return opcion;
}

export async function confirmarReanudar(yaSubidos: number, pendientes: number): Promise<'omitir' | 'todo'> {
  const { accion } = await inquirer.prompt([
    {
      type: 'list',
      name: 'accion',
      message: `Se detectaron ${yaSubidos} artículos ya cargados previamente. ¿Qué desea hacer?`,
      choices: [
        { name: `Omitirlos y procesar solo los ${pendientes} pendientes (recomendado)`, value: 'omitir' },
        { name: 'Procesar TODOS de nuevo (puede crear duplicados en Publindex)', value: 'todo' },
      ],
      default: 'omitir',
    },
  ]);
  return accion;
}

export async function confirmarEstimadoTiempo(cantidad: number, segundos: number): Promise<boolean> {
  console.log('');
  console.log(`  ⏱  Tiempo estimado: ~${formatearTiempo(segundos)} (${cantidad} artículos × ~9s promedio)`);
  console.log(`  ℹ  Se aplicará una pausa aleatoria de 4-9s entre cada artículo para no saturar el servidor`);
  console.log('');

  const { proceder } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceder',
      message: '¿Desea proceder con la carga?',
      default: true,
    },
  ]);
  return proceder;
}
