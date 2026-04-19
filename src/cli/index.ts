import { banner, info } from './logger';
import { mainMenu } from './prompts';
import { ExecutionMode } from '../entities/articles/types';
import { uploadArticles } from './commands/upload-articles';
import { importOjs } from './commands/import-ojs';
import { runGenerateTemplate } from './commands/generate-template';

export async function run(options: { forcedMode?: ExecutionMode } = {}): Promise<void> {
  banner();

  const mode = options.forcedMode ?? await mainMenu();

  switch (mode) {
    case 'exit':
      info('Hasta luego.');
      return;
    case 'template':
      runGenerateTemplate();
      return;
    case 'import-ojs':
      await importOjs();
      return;
    case 'validate':
    case 'upload':
      await uploadArticles(mode);
      return;
  }
}
