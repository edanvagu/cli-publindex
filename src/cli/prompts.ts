import inquirer from 'inquirer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { Issue } from '../entities/issues/types';
import { formatIssue } from '../entities/issues/api';
import { formatDuration } from '../utils/time';
import { LeafAction, View, NavAction } from './navigation';
import { ArticleRow } from '../entities/articles/types';

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
      message: '¿Tiene también el CSV de revisiones exportado desde OJS (para prellenar la hoja Evaluadores)?',
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

type Choice<T extends string> = { name: string; value: T } | InstanceType<typeof inquirer.Separator>;

async function promptList<T extends string>(message: string, choices: Choice<T>[]): Promise<T> {
  const { option } = await inquirer.prompt<{ option: T }>([
    { type: 'list', name: 'option', message, choices, pageSize: choices.length + 1 },
  ]);
  return option;
}

const SEP = new inquirer.Separator();
const BACK_EXIT: Choice<NavAction>[] = [
  SEP,
  { name: 'Volver', value: 'back' },
  { name: 'Salir', value: 'exit' },
];

export async function promptUrlFailureAction(): Promise<'retry' | 'skip'> {
  return promptList<'retry' | 'skip'>('¿Qué desea hacer?', [
    { name: 'Ingresar de nuevo la URL base', value: 'retry' },
    { name: 'Omitir y completar las URLs manualmente en el Excel', value: 'skip' },
  ]);
}

type MainChoice = Extract<LeafAction, 'import-ojs' | 'help-ojs' | 'about'> | Extract<View, 'upload-channel'> | Extract<NavAction, 'exit'>;

export async function mainMenuPrompt(): Promise<MainChoice> {
  return promptList<MainChoice>('¿Qué desea hacer?', [
    { name: '1. Preparar plantilla desde OJS', value: 'import-ojs' },
    { name: '2. Cargar a Publindex', value: 'upload-channel' },
    { name: '3. Ayuda: cómo exportar desde OJS', value: 'help-ojs' },
    { name: '4. Sobre el proyecto / donar', value: 'about' },
    SEP,
    { name: 'Salir', value: 'exit' },
  ]);
}

type UploadChannelChoice = Extract<View, 'auto-menu' | 'ext-menu'> | NavAction;

export async function uploadChannelPrompt(): Promise<UploadChannelChoice> {
  return promptList<UploadChannelChoice>('¿Qué ruta desea usar?', [
    { name: 'a) Ruta automatizada (el CLI carga a Publindex por usted)', value: 'auto-menu' },
    { name: 'b) Ruta con extensión (usted rellena los formularios en el navegador)', value: 'ext-menu' },
    ...BACK_EXIT,
  ]);
}

type AutoMenuChoice = Extract<LeafAction, 'upload-articles' | 'upload-authors' | 'upload-reviewers'> | NavAction;

export async function autoMenuPrompt(): Promise<AutoMenuChoice> {
  return promptList<AutoMenuChoice>('¿Qué desea hacer?', [
    { name: '1. Validar y cargar artículos', value: 'upload-articles' },
    { name: '2. Vincular autores a artículos cargados', value: 'upload-authors' },
    { name: '3. Vincular evaluadores al fascículo', value: 'upload-reviewers' },
    ...BACK_EXIT,
  ]);
}

type ExtMenuChoice = Extract<LeafAction, 'install-extension' | 'open-publindex' | 'help-extension'> | NavAction;

export async function extMenuPrompt(): Promise<ExtMenuChoice> {
  return promptList<ExtMenuChoice>('¿Qué desea hacer?', [
    { name: '1. Instalar / actualizar extensión', value: 'install-extension' },
    { name: '2. Abrir Publindex en el navegador', value: 'open-publindex' },
    { name: '3. Cómo usar la extensión', value: 'help-extension' },
    ...BACK_EXIT,
  ]);
}

export async function confirmOjsReady(): Promise<'ready' | 'show-help' | 'cancel'> {
  return promptList<'ready' | 'show-help' | 'cancel'>(
    '¿Ya exportó el XML (y opcionalmente el CSV) desde OJS?',
    [
      { name: 'Sí, continuar', value: 'ready' },
      { name: 'No, mostrar los pasos', value: 'show-help' },
      { name: 'Cancelar y volver al menú', value: 'cancel' },
    ],
  );
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

const MAX_TITLE_CHARS = 80;

export function truncateTitle(titulo: string | undefined): string {
  if (!titulo || titulo.trim() === '') return '(sin título)';
  if (titulo.length <= MAX_TITLE_CHARS) return titulo;
  return `${titulo.slice(0, MAX_TITLE_CHARS - 3)}...`;
}

export async function promptArticlesToUpload(articles: ArticleRow[]): Promise<ArticleRow[]> {
  const choices = articles.map(a => ({
    name: `Fila ${a._fila} · ${truncateTitle(a.titulo)}`,
    value: a._fila,
    checked: true,
  }));

  const { rows } = await inquirer.prompt<{ rows: number[] }>([
    {
      type: 'checkbox',
      name: 'rows',
      message: 'Marque los artículos a subir:',
      choices,
      pageSize: Math.min(choices.length + 2, 20),
    },
  ]);

  const picked = new Set(rows);
  return articles.filter(a => picked.has(a._fila));
}
