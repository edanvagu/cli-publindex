import inquirer from 'inquirer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { Issue } from '../entities/issues/types';
import { ExecutionMode } from '../entities/articles/types';
import { formatIssue } from '../entities/issues/api';
import { formatDuration } from '../utils/time';

export async function promptCredentials(): Promise<{ username: string; password: string }> {
  const { username } = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Usuario de Publindex:',
      validate: (v: string) => v.trim() ? true : 'El usuario es obligatorio',
    },
  ]);

  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Contraseña:',
      mask: '•',
      validate: (v: string) => v ? true : 'La contraseña es obligatoria',
    },
  ]);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `¿Es correcto el usuario "${username}"?`,
      default: true,
    },
  ]);

  if (!confirmed) {
    return promptCredentials();
  }

  return { username: username.trim(), password };
}

export async function selectIssue(issues: Issue[]): Promise<Issue> {
  const choices = issues.map(f => ({
    name: formatIssue(f),
    value: f,
  }));

  const { issue } = await inquirer.prompt([
    {
      type: 'list',
      name: 'issue',
      message: 'Seleccione el fascículo:',
      choices,
      pageSize: 15,
    },
  ]);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `¿Confirma ${formatIssue(issue)}?`,
      default: true,
    },
  ]);

  if (!confirmed) {
    return selectIssue(issues);
  }

  return issue;
}

const ARTICLE_EXTENSIONS = ['.xlsx', '.xls'];
const OJS_EXTENSIONS = ['.xml'];
const REVIEWS_CSV_EXTENSIONS = ['.csv'];

export async function promptFilePath(): Promise<string> {
  return promptFileWithExtensions(ARTICLE_EXTENSIONS, 'Seleccionar archivo de artículos');
}

export async function promptOjsFilePath(): Promise<string> {
  return promptFileWithExtensions(OJS_EXTENSIONS, 'Seleccionar export XML de OJS');
}

export async function promptOptionalReviewsCsvPath(): Promise<string | null> {
  const { include } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'include',
      message: '¿Tiene también el CSV de revisiones exportado desde OJS (para pre-llenar la hoja Evaluadores)?',
      default: false,
    },
  ]);
  if (!include) return null;
  return promptFileWithExtensions(REVIEWS_CSV_EXTENSIONS, 'Seleccionar CSV de revisiones de OJS');
}

async function promptFileWithExtensions(extensions: string[], title: string): Promise<string> {
  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: '¿Cómo desea seleccionar el archivo?',
      choices: [
        { name: 'Abrir explorador de archivos', value: 'browser' },
        { name: 'Escribir la ruta manualmente', value: 'manual' },
      ],
    },
  ]);

  if (method === 'browser') {
    return openFileDialog(extensions, title);
  }

  return promptFileManual(extensions);
}

function runPowerShellDialog(psScript: string): string | null {
  try {
    const line = psScript.trim().replace(/\n/g, '; ');
    const result = execSync(`powershell -Command "${line}"`, {
      encoding: 'utf-8',
      timeout: 60000,
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

function runOsascript(script: string): string | null {
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: 60000,
    }).trim();
    return result || null;
  } catch {
    // osascript exits with status 1 when the user cancels; treat that as "no selection".
    return null;
  }
}

function openFileDialog(extensions: string[], title: string): Promise<string> {
  const result = process.platform === 'darwin'
    ? openFileDialogMac(extensions, title)
    : openFileDialogWindows(extensions, title);

  if (result && fs.existsSync(result)) {
    return Promise.resolve(result);
  }

  console.log('');
  console.log('  No se pudo abrir el explorador. Escriba la ruta manualmente.');
  return promptFileManual(extensions);
}

function openFileDialogWindows(extensions: string[], title: string): string | null {
  const filter = extensions.map(e => `*${e}`).join(';');
  return runPowerShellDialog(`
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Filter = 'Archivos (${filter})|${filter}|Todos los archivos (*.*)|*.*'
$dialog.Title = '${title}'
$dialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')
if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }
`);
}

function openFileDialogMac(extensions: string[], title: string): string | null {
  const types = extensions.map(e => `"${e.replace(/^\./, '')}"`).join(', ');
  return runOsascript(`POSIX path of (choose file with prompt "${title}" of type {${types}})`);
}

async function promptFileManual(extensions: string[]): Promise<string> {
  const { file } = await inquirer.prompt([
    {
      type: 'input',
      name: 'file',
      message: 'Ruta del archivo (puede arrastrar el archivo aquí):',
      validate: (v: string) => validateFilePath(v, extensions),
    },
  ]);

  return cleanPath(file);
}

function cleanPath(filePath: string): string {
  // Windows wraps drag-dropped paths with spaces in quotes — strip them.
  return filePath.trim().replace(/^["']|["']$/g, '');
}

function validateFilePath(v: string, extensions: string[]): string | true {
  const filePath = cleanPath(v);
  if (!filePath) return 'La ruta del archivo es obligatoria';
  const lower = filePath.toLowerCase();
  if (!extensions.some(e => lower.endsWith(e))) {
    return `El archivo debe ser ${extensions.join(' o ')}`;
  }
  if (!fs.existsSync(filePath)) {
    return `Archivo no encontrado: ${filePath}`;
  }
  return true;
}

export async function confirmContinue(msg: string): Promise<boolean> {
  const { shouldContinue } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldContinue',
      message: msg,
      default: true,
    },
  ]);
  return shouldContinue;
}

export async function promptSavePath(defaultDir: string, defaultName: string): Promise<string> {
  const sep = process.platform === 'win32' ? '\\' : '/';
  const defaultFull = `${defaultDir.replace(/[\\/]+$/, '')}${sep}${defaultName}`;

  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: '¿Dónde desea guardar la plantilla?',
      choices: [
        { name: `Usar ruta por defecto (${defaultFull})`, value: 'default' },
        { name: 'Abrir diálogo para elegir', value: 'dialog' },
        { name: 'Escribir ruta manualmente', value: 'manual' },
      ],
    },
  ]);

  if (method === 'default') return defaultFull;
  if (method === 'dialog') {
    const chosen = openSaveDialog(defaultDir, defaultName);
    if (chosen) return chosen;
    console.log('');
    console.log('  No se pudo abrir el diálogo. Escriba la ruta manualmente.');
  }
  return promptPathManual(defaultFull);
}

function openSaveDialog(defaultDir: string, defaultName: string): string | null {
  if (process.platform === 'darwin') {
    return runOsascript(
      `POSIX path of (choose file name with prompt "Guardar plantilla generada" default name "${defaultName}" default location (POSIX file "${defaultDir}"))`
    );
  }
  return runPowerShellDialog(`
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Filter = 'Excel (*.xlsx)|*.xlsx'
$dialog.FileName = '${defaultName}'
$dialog.InitialDirectory = '${defaultDir.replace(/\\/g, '\\\\')}'
$dialog.Title = 'Guardar plantilla generada'
if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }
`);
}

async function promptPathManual(defaultFull: string): Promise<string> {
  const { filePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: 'Ruta completa del archivo .xlsx:',
      default: defaultFull,
      validate: (v: string) => v.trim().toLowerCase().endsWith('.xlsx') ? true : 'La ruta debe terminar en .xlsx',
    },
  ]);
  return cleanPath(filePath);
}

export async function promptJournalBaseUrl(): Promise<string | null> {
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

export async function promptUrlFailureAction(): Promise<'retry' | 'skip'> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '¿Qué desea hacer?',
      choices: [
        { name: 'Ingresar de nuevo la URL base', value: 'retry' },
        { name: 'Omitir y completar las URLs manualmente en el Excel', value: 'skip' },
      ],
    },
  ]);
  return action;
}

export async function mainMenu(): Promise<ExecutionMode> {
  const { option } = await inquirer.prompt([
    {
      type: 'list',
      name: 'option',
      message: '¿Qué desea hacer?',
      pageSize: 8,
      choices: [
        { name: '1. Importar desde OJS (genera plantilla prellena)', value: 'import-ojs' as ExecutionMode },
        { name: '2. Validar y cargar artículos', value: 'upload' as ExecutionMode },
        { name: '3. Vincular autores a artículos cargados', value: 'authors-upload' as ExecutionMode },
        { name: '4. Vincular evaluadores al fascículo', value: 'reviewers-upload' as ExecutionMode },
        new inquirer.Separator(),
        { name: 'Salir', value: 'exit' as ExecutionMode },
      ],
    },
  ]);
  return option;
}

export async function confirmResume(alreadyUploaded: number, pending: number): Promise<'skip' | 'all'> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: `Se detectaron ${alreadyUploaded} artículos ya cargados previamente. ¿Qué desea hacer?`,
      choices: [
        { name: `Omitirlos y procesar solo los ${pending} pendientes (recomendado)`, value: 'skip' },
        { name: 'Procesar TODOS de nuevo (puede crear duplicados en Publindex)', value: 'all' },
      ],
      default: 'skip',
    },
  ]);
  return action;
}

export async function confirmTimeEstimate(quantity: number, seconds: number): Promise<boolean> {
  const avg = quantity > 0 ? Math.round(seconds / quantity) : 0;
  console.log('');
  console.log(`  ⏱  Tiempo estimado: ~${formatDuration(seconds)} (${quantity} artículos × ~${avg}s promedio, incluyendo pausas)`);
  console.log('');

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: '¿Desea proceder con la carga?',
      default: true,
    },
  ]);
  return proceed;
}

export async function confirmAuthorsStart(quantity: number): Promise<boolean> {
  console.log('');
  console.log(`  ℹ  Se procesarán ${quantity} autor(es).`);
  console.log('');

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: '¿Desea proceder con la vinculación?',
      default: true,
    },
  ]);
  return proceed;
}

export async function confirmReviewersStart(quantity: number): Promise<boolean> {
  console.log('');
  console.log(`  ℹ  Se procesarán ${quantity} evaluador(es).`);
  console.log('');

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: '¿Desea proceder con la vinculación?',
      default: true,
    },
  ]);
  return proceed;
}
