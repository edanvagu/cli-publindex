#!/usr/bin/env node

import { Command } from 'commander';
import { run } from '../src/cli/index';
import { generarPlantilla } from '../src/data/template';

const program = new Command();

program
  .name('publindex')
  .description('Carga masiva de artículos en Publindex (Minciencias)')
  .version('1.0.0');

program
  .option('--dry-run', 'Validar datos sin enviar al servidor')
  .option('--concurrency <n>', 'Nivel de concurrencia (default: 1)', parseInt)
  .option('--plantilla', 'Generar plantilla Excel de ejemplo')
  .action(async (options) => {
    if (options.plantilla) {
      generarPlantilla();
      return;
    }

    await run({
      dryRun: options.dryRun,
      concurrency: options.concurrency,
    });
  });

program.parse();
