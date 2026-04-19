#!/usr/bin/env node

import { Command } from 'commander';
import { run } from '../src/cli/index';
import { generateTemplate } from '../src/io/excel-writer';
import { ExecutionMode } from '../src/entities/articles/types';

const program = new Command();

program
  .name('publindex')
  .description('Carga masiva de artículos en Publindex (Minciencias)')
  .version('1.0.0')
  .option('--plantilla', 'Generar plantilla Excel de ejemplo y salir')
  .option('--solo-validar', 'Forzar modo solo validar (sin menú)')
  .option('--cargar', 'Forzar modo validar y cargar (sin menú)')
  .action(async (options) => {
    if (options.plantilla) {
      await generateTemplate();
      return;
    }

    let forcedMode: ExecutionMode | undefined;
    if (options.soloValidar) forcedMode = 'validate';
    else if (options.cargar) forcedMode = 'upload';

    await run({ forcedMode });
  });

program.parse();
