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

export function showProgress(current: number, total: number, titulo: string, ok: boolean, timeMs: number, errorMsg?: string) {
  const idx = `[${current}/${total}]`;
  const tituloCorto = titulo.length > 55 ? titulo.substring(0, 52) + '...' : titulo;
  const tiempo = `(${(timeMs / 1000).toFixed(1)}s)`;

  if (ok) {
    console.log(chalk.gray(`  ${idx} `) + chalk.white(`"${tituloCorto}" `) + chalk.green('✓ ') + chalk.gray(tiempo));
  } else {
    console.log(chalk.gray(`  ${idx} `) + chalk.white(`"${tituloCorto}" `) + chalk.red('✗ ') + chalk.red(errorMsg || 'Error'));
  }
}

export function showPause(segundos: number) {
  console.log(chalk.gray(`        ⏸  Pausando ${segundos}s antes del siguiente...`));
}

export function showRemainingTime(segundos: number, processed: number, total: number) {
  const remainingCount = total - processed;
  console.log(chalk.gray(`        ⏱  Tiempo restante estimado: ~${formatDuration(segundos)} (${remainingCount} artículos por procesar)`));
}


export function showSummary(result: UploadResult) {
  const tiempoSeg = (result.totalTimeMs / 1000).toFixed(1);

  console.log('');
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
  console.log(chalk.green(`  Completados: ${result.successful.length}`) + chalk.gray(' | ') + chalk.red(`Fallidos: ${result.failed.length}`));
  console.log(chalk.gray(`  Tiempo total: ${tiempoSeg}s`));
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));

  if (result.failed.length > 0) {
    console.log('');
    console.log(chalk.red('  Artículos fallidos:'));
    for (const f of result.failed) {
      const tituloCorto = f.titulo.length > 45 ? f.titulo.substring(0, 42) + '...' : f.titulo;
      console.log(chalk.gray(`    Fila ${f.row}: `) + chalk.white(`"${tituloCorto}"`) + chalk.red(` - ${f.error}`));
    }
  }
  console.log('');
}
