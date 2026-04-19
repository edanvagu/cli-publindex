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

const EXTENSIONES_ARTICULOS = ['.xlsx', '.xls', '.csv'];
const EXTENSIONES_OJS = ['.xml'];

export async function pedirArchivo(): Promise<string> {
  return pedirArchivoConExtensiones(EXTENSIONES_ARTICULOS, 'Seleccionar archivo de artículos');
}

export async function pedirArchivoOjs(): Promise<string> {
  return pedirArchivoConExtensiones(EXTENSIONES_OJS, 'Seleccionar export XML de OJS');
}

async function pedirArchivoConExtensiones(extensiones: string[], titulo: string): Promise<string> {
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
    return abrirExploradorArchivos(extensiones, titulo);
  }

  return pedirArchivoManual(extensiones);
}

function ejecutarDialogoPowerShell(psScript: string): string | null {
  try {
    const linea = psScript.trim().replace(/\n/g, '; ');
    const resultado = execSync(`powershell -Command "${linea}"`, {
      encoding: 'utf-8',
      timeout: 60000,
    }).trim();
    return resultado || null;
  } catch {
    return null;
  }
}

function abrirExploradorArchivos(extensiones: string[], titulo: string): Promise<string> {
  const filtro = extensiones.map(e => `*${e}`).join(';');
  const resultado = ejecutarDialogoPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Filter = 'Archivos (${filtro})|${filtro}|Todos los archivos (*.*)|*.*'
$dialog.Title = '${titulo}'
$dialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')
if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }
`);

  if (resultado && fs.existsSync(resultado)) {
    return Promise.resolve(resultado);
  }

  console.log('');
  console.log('  No se pudo abrir el explorador. Escriba la ruta manualmente.');
  return pedirArchivoManual(extensiones);
}

async function pedirArchivoManual(extensiones: string[]): Promise<string> {
  const { archivo } = await inquirer.prompt([
    {
      type: 'input',
      name: 'archivo',
      message: 'Ruta del archivo (puede arrastrar el archivo aquí):',
      validate: (v: string) => validarRutaArchivo(v, extensiones),
    },
  ]);

  return limpiarRuta(archivo);
}

function limpiarRuta(ruta: string): string {
  // Quitar comillas que Windows agrega al arrastrar archivos con espacios
  return ruta.trim().replace(/^["']|["']$/g, '');
}

function validarRutaArchivo(v: string, extensiones: string[]): string | true {
  const ruta = limpiarRuta(v);
  if (!ruta) return 'La ruta del archivo es obligatoria';
  const lower = ruta.toLowerCase();
  if (!extensiones.some(e => lower.endsWith(e))) {
    return `El archivo debe ser ${extensiones.join(' o ')}`;
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

export async function pedirRutaGuardado(defaultDir: string, defaultName: string): Promise<string> {
  const defaultFull = `${defaultDir.replace(/[\\/]+$/, '')}\\${defaultName}`;

  const { metodo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'metodo',
      message: '¿Dónde desea guardar la plantilla?',
      choices: [
        { name: `Usar ruta por defecto (${defaultFull})`, value: 'default' },
        { name: 'Abrir diálogo para elegir', value: 'dialog' },
        { name: 'Escribir ruta manualmente', value: 'manual' },
      ],
    },
  ]);

  if (metodo === 'default') return defaultFull;
  if (metodo === 'dialog') {
    const elegida = abrirDialogoGuardado(defaultDir, defaultName);
    if (elegida) return elegida;
    console.log('');
    console.log('  No se pudo abrir el diálogo. Escriba la ruta manualmente.');
  }
  return pedirRutaManual(defaultFull);
}

function abrirDialogoGuardado(defaultDir: string, defaultName: string): string | null {
  return ejecutarDialogoPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Filter = 'Excel (*.xlsx)|*.xlsx'
$dialog.FileName = '${defaultName}'
$dialog.InitialDirectory = '${defaultDir.replace(/\\/g, '\\\\')}'
$dialog.Title = 'Guardar plantilla generada'
if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }
`);
}

async function pedirRutaManual(defaultFull: string): Promise<string> {
  const { ruta } = await inquirer.prompt([
    {
      type: 'input',
      name: 'ruta',
      message: 'Ruta completa del archivo .xlsx:',
      default: defaultFull,
      validate: (v: string) => v.trim().toLowerCase().endsWith('.xlsx') ? true : 'La ruta debe terminar en .xlsx',
    },
  ]);
  return limpiarRuta(ruta);
}

export async function pedirUrlBaseRevista(): Promise<string | null> {
  const { base } = await inquirer.prompt([
    {
      type: 'input',
      name: 'base',
      message: 'URL base de la revista en OJS (ej. https://revistas.ejemplo.edu.co/index.php/mi-revista). Deje vacío para omitir:',
    },
  ]);
  const trimmed = (base ?? '').trim();
  return trimmed ? trimmed : null;
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
        { name: 'Descargar plantilla de ejemplo para rellenar', value: 'plantilla' as ModoEjecucion },
        { name: 'Importar desde OJS (genera plantilla prellena)', value: 'importar-ojs' as ModoEjecucion },
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
