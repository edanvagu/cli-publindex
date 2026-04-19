import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { ValidationResult, UploadResult } from '../data/types';

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

export function exito(msg: string) {
  console.log(chalk.green('  ✓ ') + msg);
}

export function error(msg: string) {
  console.log(chalk.red('  ✗ ') + msg);
}

export function advertencia(msg: string) {
  console.log(chalk.yellow('  ⚠ ') + msg);
}

export function info(msg: string) {
  console.log(chalk.cyan('  ℹ ') + msg);
}

export function mostrarValidacion(result: ValidationResult) {
  console.log('');
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
  console.log(chalk.bold(`  Validación de ${result.validos.length + result.errores.length} artículos`));
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
  console.log('');

  if (result.validos.length > 0) {
    exito(`${result.validos.length} artículos válidos`);
  }

  if (result.errores.length > 0) {
    console.log('');
    error(`${new Set(result.errores.map(e => e.fila)).size} artículos con errores:`);
    console.log('');

    // Agrupar errores por fila
    const porFila = new Map<number, typeof result.errores>();
    for (const err of result.errores) {
      const lista = porFila.get(err.fila) || [];
      lista.push(err);
      porFila.set(err.fila, lista);
    }

    for (const [fila, errores] of porFila) {
      console.log(chalk.red(`  Fila ${fila}:`));
      for (const err of errores) {
        console.log(chalk.gray(`    - ${err.campo}: `) + err.mensaje);
        if (err.sugerencia) {
          console.log(chalk.gray(`      ${err.sugerencia}`));
        }
      }
      console.log('');
    }
  }

  if (result.advertencias.length > 0) {
    console.log(chalk.yellow('  Advertencias:'));
    for (const adv of result.advertencias) {
      advertencia(adv.mensaje);
    }
    console.log('');
  }

  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
}

export function mostrarProgreso(current: number, total: number, titulo: string, ok: boolean, timeMs: number, errorMsg?: string) {
  const idx = `[${current}/${total}]`;
  const tituloCorto = titulo.length > 55 ? titulo.substring(0, 52) + '...' : titulo;
  const tiempo = `(${(timeMs / 1000).toFixed(1)}s)`;

  if (ok) {
    console.log(chalk.gray(`  ${idx} `) + chalk.white(`"${tituloCorto}" `) + chalk.green('✓ ') + chalk.gray(tiempo));
  } else {
    console.log(chalk.gray(`  ${idx} `) + chalk.white(`"${tituloCorto}" `) + chalk.red('✗ ') + chalk.red(errorMsg || 'Error'));
  }
}

export function mostrarResumen(result: UploadResult) {
  const tiempoSeg = (result.tiempoTotal / 1000).toFixed(1);

  console.log('');
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));
  console.log(chalk.green(`  Completados: ${result.exitosos.length}`) + chalk.gray(' | ') + chalk.red(`Fallidos: ${result.fallidos.length}`));
  console.log(chalk.gray(`  Tiempo total: ${tiempoSeg}s`));
  console.log(chalk.bold('  ═══════════════════════════════════════════════'));

  if (result.fallidos.length > 0) {
    console.log('');
    console.log(chalk.red('  Artículos fallidos:'));
    for (const f of result.fallidos) {
      const tituloCorto = f.titulo.length > 45 ? f.titulo.substring(0, 42) + '...' : f.titulo;
      console.log(chalk.gray(`    Fila ${f.fila}: `) + chalk.white(`"${tituloCorto}"`) + chalk.red(` - ${f.error}`));
    }
  }
  console.log('');
}
