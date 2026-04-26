import { banner, info, error } from './logger';
import { mainMenuPrompt, uploadChannelPrompt, autoMenuPrompt, extMenuPrompt } from './prompts';
import { ExecutionMode } from '../entities/articles/types';
import { LeafAction, View, MenuSelection, dispatch, breadcrumb } from './navigation';
import { uploadArticles } from './commands/upload-articles';
import { importOjs } from './commands/import-ojs';
import { uploadAuthors } from './commands/upload-authors';
import { uploadReviewers } from './commands/upload-reviewers';
import { installExtension } from './commands/install-extension';
import { showOjsExportHelp } from './commands/help-ojs-export';
import { showExtensionUsageHelp } from './commands/help-extension-usage';
import { openPublindex } from './commands/open-publindex';
import { showAbout } from './commands/about';

export async function run(options: { forcedMode?: ExecutionMode } = {}): Promise<void> {
  banner();

  if (options.forcedMode && options.forcedMode !== 'exit') {
    await runLeaf(options.forcedMode);
    return;
  }

  const stack: View[] = ['main'];
  while (stack.length > 0) {
    const view = stack[stack.length - 1];
    printHeader(stack);
    let selection: MenuSelection;
    try {
      selection = await promptForView(view);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      return;
    }

    const result = dispatch(view, selection);
    switch (result.kind) {
      case 'nav':
        if (result.action === 'exit') return;
        stack.pop();
        continue;
      case 'push':
        stack.push(result.view);
        continue;
      case 'run':
        try {
          await runLeaf(result.action);
        } catch (err) {
          error(err instanceof Error ? err.message : String(err));
          info('Volviendo al menú...');
        }
        console.log('');
        continue;
      case 'invalid':
        error(`Selección inválida: ${String(selection)}`);
        continue;
    }
  }
}

function printHeader(stack: readonly View[]): void {
  console.log('');
  console.log(`  === ${breadcrumb(stack)} ===`);
  console.log('');
}

async function promptForView(view: View): Promise<MenuSelection> {
  switch (view) {
    case 'main':
      return mainMenuPrompt();
    case 'upload-channel':
      return uploadChannelPrompt();
    case 'auto-menu':
      return autoMenuPrompt();
    case 'ext-menu':
      return extMenuPrompt();
  }
}

async function runLeaf(action: LeafAction): Promise<void> {
  switch (action) {
    case 'import-ojs':
      return importOjs();
    case 'upload-articles':
      return uploadArticles();
    case 'upload-authors':
      return uploadAuthors();
    case 'upload-reviewers':
      return uploadReviewers();
    case 'install-extension':
      return installExtension();
    case 'open-publindex':
      return openPublindex();
    case 'help-ojs':
      return showOjsExportHelp();
    case 'help-extension':
      return showExtensionUsageHelp();
    case 'about':
      return showAbout();
  }
}
