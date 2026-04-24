#!/usr/bin/env node

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
  .action(async (options) => {
    let forcedMode: ExecutionMode | undefined;
    if (options.cargar) forcedMode = 'upload-articles';
    else if (options.autores) forcedMode = 'upload-authors';
    else if (options.evaluadores) forcedMode = 'upload-reviewers';
    else if (options.ojs) forcedMode = 'import-ojs';

    await run({ forcedMode });
  });

program.parse();
