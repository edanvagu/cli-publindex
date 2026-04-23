import { banner, info, error } from './logger';
import { mainMenu } from './prompts';
import { ExecutionMode } from '../entities/articles/types';
import { uploadArticles } from './commands/upload-articles';
import { importOjs } from './commands/import-ojs';
import { uploadAuthors } from './commands/upload-authors';

export async function run(options: { forcedMode?: ExecutionMode } = {}): Promise<void> {
  banner();

  // forcedMode (CLI flag): single run, no menu loop — for scripts and cron.
  if (options.forcedMode) {
    await dispatch(options.forcedMode);
    return;
  }

  while (true) {
    const mode = await mainMenu();
    if (mode === 'exit') {
      return;
    }
    try {
      await dispatch(mode);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      info('Volviendo al menú principal...');
    }
    console.log('');
  }
}

async function dispatch(mode: ExecutionMode): Promise<void> {
  switch (mode) {
    case 'exit':
      return;
    case 'import-ojs':
      return importOjs();
    case 'upload':
      return uploadArticles();
    case 'authors-upload':
      return uploadAuthors();
  }
}
