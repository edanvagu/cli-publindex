#!/usr/bin/env node

// Inject the Windows root CA store into Node's TLS layer. Without this, Publindex's certificate chain ends in an issuer that Node's bundled CA list doesn't trust (typical when a corporate proxy injects an MITM cert), and login fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY even though the browser — which uses the OS trust store — works fine. Must run synchronously before any https.request, hence `win-ca/api` with `inject: '+'` (default require('win-ca') is async and races the first request).
if (process.platform === 'win32') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('win-ca/api')({ inject: '+' });
}

import { Command } from 'commander';
import { run } from '../src/cli/index';
import { ExecutionMode } from '../src/entities/articles/types';

const program = new Command();

program
  .name('publindex')
  .description('Carga masiva de artículos en Publindex (Minciencias)')
  .version('1.1.0')
  .option('--cargar', 'Forzar modo cargar artículos (sin menú)')
  .option('--autores', 'Forzar modo vincular autores (sin menú)')
  .option('--evaluadores', 'Forzar modo vincular evaluadores (sin menú)')
  .option('--ojs', 'Forzar modo importar desde OJS (sin menú)')
  .option('--instalar', 'Forzar modo instalar extensión (sin menú)')
  .action(async (options) => {
    let forcedMode: ExecutionMode | undefined;
    if (options.cargar) forcedMode = 'upload-articles';
    else if (options.autores) forcedMode = 'upload-authors';
    else if (options.evaluadores) forcedMode = 'upload-reviewers';
    else if (options.ojs) forcedMode = 'import-ojs';
    else if (options.instalar) forcedMode = 'install-extension';

    await run({ forcedMode });
  });

program.parse();
