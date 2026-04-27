// Mirrors `version` in package.json and package-lock.json — kept in sync manually because pkg-built binaries don't have package.json at runtime to read from.
export const APP_VERSION = '1.2.2';

// Mirrors `version` in extension/manifest.json (Chrome's source of truth) and extension/package.json. Bumping requires updating all three so the version shown in chrome://extensions/ matches what the CLI advertises.
export const EXTENSION_VERSION = '0.2.0';
