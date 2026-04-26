import * as fs from 'fs';
import * as path from 'path';
import { PUBLINDEX_HOME } from './paths';
import { APP_VERSION } from '../config/version';
import { compareSemver } from './version-compare';
import { httpRequest } from '../io/publindex-http';

const REPO = 'edanvagu/cli-publindex';
const RELEASES_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PUBLIC_URL = `https://github.com/${REPO}/releases/latest`;
const CACHE_FILE = path.join(PUBLINDEX_HOME, 'last-update-check.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3000;

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  url: string;
}

interface CacheEntry {
  checkedAt: number;
  latestVersion: string;
}

// 24h cache avoids hitting the GitHub API on every CLI invocation; network errors are swallowed so an offline editor or a transient GitHub outage never blocks the CLI from starting.
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const cached = readCache();
  const isFresh = cached && Date.now() - cached.checkedAt < CACHE_TTL_MS;
  let latest = cached?.latestVersion;

  if (!isFresh) {
    try {
      latest = await fetchLatestRelease();
      writeCache({ checkedAt: Date.now(), latestVersion: latest });
    } catch {
      return null;
    }
  }

  if (!latest) return null;
  if (compareSemver(latest, APP_VERSION) <= 0) return null;
  return { latestVersion: latest, currentVersion: APP_VERSION, url: RELEASES_PUBLIC_URL };
}

function readCache(): CacheEntry | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.checkedAt === 'number' && typeof parsed.latestVersion === 'string') {
      return parsed;
    }
  } catch {
    // Missing, corrupt, or unparseable — treat as no cache.
  }
  return null;
}

function writeCache(entry: CacheEntry): void {
  try {
    fs.mkdirSync(PUBLINDEX_HOME, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry));
  } catch {
    // Read-only home or perms issue — non-fatal, just means we'll re-fetch next run.
  }
}

async function fetchLatestRelease(): Promise<string> {
  const res = await httpRequest<{ tag_name?: string }>(RELEASES_API_URL, {
    method: 'GET',
    headers: {
      // GitHub rejects requests without a User-Agent.
      'User-Agent': `publindex-cli/${APP_VERSION}`,
      Accept: 'application/vnd.github+json',
    },
    timeout: REQUEST_TIMEOUT_MS,
  });
  if (res.status !== 200) throw new Error(`GitHub API responded ${res.status}`);
  const tag = String(res.data?.tag_name ?? '').replace(/^v/, '');
  if (!tag) throw new Error('Latest release has no tag_name');
  return tag;
}
