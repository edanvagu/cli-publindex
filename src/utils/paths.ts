import * as os from 'os';
import * as path from 'path';

// macOS conventionally puts per-app data in ~/Library/Application Support/<App>; on Windows/Linux a hidden dotfolder in $HOME is the closest equivalent that doesn't require elevated permissions or a registry write.
export const PUBLINDEX_HOME =
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Publindex')
    : path.join(os.homedir(), '.publindex');

export const EXTENSION_INSTALL_DIR = path.join(PUBLINDEX_HOME, 'extension');
