#!/usr/bin/env node

import { Command } from 'commander';
import { run } from '../src/cli/index';
import { generarPlantilla } from '../src/data/template';
import { ModoEjecucion } from '../src/data/types';

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
      generarPlantilla();
      return;
    }

    let modoForzado: ModoEjecucion | undefined;
    if (options.soloValidar) modoForzado = 'validar';
    else if (options.cargar) modoForzado = 'cargar';

    await run({ modoForzado });
  });

program.parse();
