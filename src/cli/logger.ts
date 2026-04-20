import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { ValidationResult, UploadResult } from '../entities/articles/types';
import { formatDuration } from '../utils/time';

export function banner() {
  console.log('');
  console.log(chalk.bold.yellow('  ┌──────────────────────────────────────────────┐'));
  console.log(chalk.bold.yellow('  │') + chalk.bold.white('  Publindex - Carga masiva de artículos        ') + chalk.bold.yellow('│'));
  console.log(chalk.bold.yellow('  │') + chalk.white('  v1.0.0                                       ') + chalk.bold.yellow('│'));
  console.log(chalk.bold.yellow('  └──────────────────────────────────────────────┘'));
  console.log('');
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'yellow' }).start();
}

export function success(msg: string) {
  console.log(chalk.green('  ✓ ') + msg);
}

export function error(msg: string) {
  console.log(chalk.red('  ✗ ') + msg);
}

export function warning(msg: string) {
  console.log(chalk.yellow('  ⚠ ') + msg);
}

export function info(msg: string) {
  console.log(chalk.cyan('  ℹ ') + msg);
}

export function showValidation(result: ValidationResult) {
  console.log('');
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
  console.log(chalk.bold(`  Validación de ${result.valid.length + result.errors.length} artículos`));
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
  console.log('');

  if (result.valid.length > 0) {
    success(`${result.valid.length} artículos válidos`);
  }

  if (result.errors.length > 0) {
    console.log('');
    error(`${new Set(result.errors.map(e => e.row)).size} artículos con errores:`);
    console.log('');

    const porFila = new Map<number, typeof result.errors>();
    for (const err of result.errors) {
      const lista = porFila.get(err.row) || [];
      lista.push(err);
      porFila.set(err.row, lista);
    }

    for (const [row, errors] of porFila) {
      console.log(chalk.red(`  Fila ${row}:`));
      for (const err of errors) {
        console.log(chalk.gray(`    - ${err.field}: `) + err.message);
        if (err.suggestion) {
          console.log(chalk.gray(`      ${err.suggestion}`));
        }
      }
      console.log('');
    }
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('  Advertencias:'));
    for (const adv of result.warnings) {
      warning(adv.message);
    }
    console.log('');
  }

  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
}

export function showProgress(current: number, total: number, title: string, ok: boolean, timeMs: number, errorMsg?: string) {
  const idx = `[${current}/${total}]`;
  const shortTitle = title.length > 55 ? title.substring(0, 52) + '...' : title;
  const time = `(${(timeMs / 1000).toFixed(1)}s)`;

  if (ok) {
    console.log(chalk.gray(`  ${idx} `) + chalk.white(`"${shortTitle}" `) + chalk.green('✓ ') + chalk.gray(time));
  } else {
    console.log(chalk.gray(`  ${idx} `) + chalk.white(`"${shortTitle}" `) + chalk.red('✗ ') + chalk.red(errorMsg || 'Error'));
  }
}

export function showPause(seconds: number) {
  console.log(chalk.gray(`        ⏸  Pausando ${seconds}s antes del siguiente...`));
}

export function showRemainingTime(seconds: number, processed: number, total: number) {
  const remainingCount = total - processed;
  console.log(chalk.gray(`        ⏱  Tiempo restante estimado: ~${formatDuration(seconds)} (${remainingCount} artículos por procesar)`));
}


interface AuthorReference {
  _fila: number;
  nombre_completo: string;
  filiacion_institucional?: string;
  nacionalidad: string;
  identificacion: string;
}

interface CandidateRow {
  nombre: string;
  documento: string;
  pais: string;
  email: string;
}

/** Mostrado ANTES del picker interactivo cuando falla búsqueda por documento. */
export function showPickerReference(author: AuthorReference): void {
  console.log('');
  console.log(chalk.bold('  Referencia del autor (desde OJS):'));
  console.log(`    ${chalk.gray('Nombre:        ')}${author.nombre_completo}`);
  console.log(`    ${chalk.gray('Filiación:     ')}${author.filiacion_institucional || chalk.gray('(sin filiación en OJS)')}`);
  console.log(`    ${chalk.gray('Nacionalidad:  ')}${author.nacionalidad}`);
  console.log(`    ${chalk.gray('Identificación:')}${author.identificacion ? ' ' + author.identificacion : chalk.gray(' (no proporcionada)')}`);
  console.log('');
}

export function showCandidatesTable(candidates: CandidateRow[]): void {
  if (candidates.length === 0) return;

  const cols = [
    { key: 'num' as const, header: '#', width: 3 },
    { key: 'nombre' as const, header: 'Nombre', width: 32 },
    { key: 'documento' as const, header: 'Documento', width: 14 },
    { key: 'pais' as const, header: 'País', width: 15 },
    { key: 'email' as const, header: 'Email', width: 30 },
  ];

  const rows = candidates.map((c, i) => ({
    num: String(i + 1),
    nombre: c.nombre,
    documento: c.documento,
    pais: c.pais,
    email: c.email,
  }));

  console.log(chalk.bold('  Candidatos encontrados en Publindex:'));
  console.log('  ' + cols.map(c => chalk.bold(pad(c.header, c.width))).join(' │ '));
  console.log('  ' + cols.map(c => '─'.repeat(c.width)).join('─┼─'));
  for (const r of rows) {
    console.log('  ' + cols.map(c => pad((r as Record<string, string>)[c.key], c.width)).join(' │ '));
  }
  console.log('');
}

function pad(s: string, width: number): string {
  const trimmed = s.length > width ? s.substring(0, width - 1) + '…' : s;
  return trimmed.padEnd(width);
}

export function showSummary(result: UploadResult) {
  const timeSeg = (result.totalTimeMs / 1000).toFixed(1);

  console.log('');
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
  console.log(chalk.green(`  Completados: ${result.successful.length}`) + chalk.gray(' | ') + chalk.red(`Fallidos: ${result.failed.length}`));
  console.log(chalk.gray(`  Tiempo total: ${timeSeg}s`));
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));

  if (result.failed.length > 0) {
    console.log('');
    console.log(chalk.red('  Artículos fallidos:'));
    for (const f of result.failed) {
      const shortTitle = f.titulo.length > 45 ? f.titulo.substring(0, 42) + '...' : f.titulo;
      console.log(chalk.gray(`    Fila ${f.row}: `) + chalk.white(`"${shortTitle}"`) + chalk.red(` - ${f.error}`));
    }
  }
  console.log('');
}
