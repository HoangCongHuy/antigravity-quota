import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { getAccountDir, getAccountsDir } from '../core/env';
import { debug } from '../core/logger';
import { join } from 'node:path';
import { StoredTokens } from '../quota/types';
import { AccountMetaData, CachedQuota } from './types';

export function ensureAccountsDir(): void {
  const dir = getAccountsDir();
  if (!existsSync(dir)) {
    debug('accounts-storage', `Creating accounts directory: ${dir}`);
    mkdirSync(dir, { recursive: true });
  }
}

export function ensureAccountDir(email: string) {
  ensureAccountsDir();
  const dir = getAccountDir(email);
  if (!existsSync(dir)) {
    debug('accounts-storage', `Creating account directory: ${dir}`);
    mkdirSync(dir, { recursive: true });
  }
}

export function accountExists(email: string): boolean {
  const dir = getAccountDir(email);
  return existsSync(dir) && existsSync(join(dir, 'tokens.json'));
}

export function listAccountEmails(): string[] {
  const acconutsDir = getAccountsDir();

  if (!existsSync(acconutsDir)) {
    return [];
  }

  try {
    const entries = readdirSync(acconutsDir, { withFileTypes: true });
    const emails: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const tokenPath = join(acconutsDir, entry.name, 'tokens.json');
        if (existsSync(tokenPath)) {
          emails.push(entry.name);
        }
      }
    }

    return emails;
  } catch (err) {
    debug('accounts-storage', 'Failed to list accounts', err);
    return [];
  }
}

export function saveAccountTokens(email: string, tokens: StoredTokens): void {
  ensureAccountDir(email);
  const path = join(getAccountDir(email), 'tokens.json');

  debug('accounts-storage', `Saving tokens for ${email}`);
  writeFileSync(path, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function loadAccountTokens(email: string): StoredTokens | null {
  const path = join(getAccountDir(email), 'tokens.json');
  if (!existsSync(path)) {
    debug('accounts-storage', `No tokens file for ${email}`);
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as StoredTokens;
  } catch (err) {
    debug('accounts-storage', `Failed to parse tokens for ${email}`, err);
    return null;
  }
}

export function saveAccountMetadata(
  email: string,
  metadata: AccountMetaData,
): void {
  ensureAccountDir(email);
  const path = join(getAccountDir(email), 'metadata.json');

  debug('accounts-storage', `Saving metadata for ${email}`);
  writeFileSync(path, JSON.stringify(metadata, null, 2), { mode: 0o600 });
}

export function loadAccountMetadata(email: string): AccountMetaData | null {
  const path = join(getAccountDir(email), 'metadata.json');
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as AccountMetaData;
  } catch (err) {
    debug('accounts-storage', `Failed to parse metadata for ${email}`, err);
    return null;
  }
}

export function updateLastUsed(email: string): void {
  const metadata = loadAccountMetadata(email);
  if (metadata) {
    metadata.lastUsed = new Date().toISOString();
    saveAccountMetadata(email, metadata);
  }
}

export function saveAccountCache(email: string, cache: CachedQuota): void {
  ensureAccountDir(email);
  const path = join(getAccountDir(email), 'cache.json');

  debug('accounts-storage', `Saving cache for ${email}`);
  writeFileSync(path, JSON.stringify(cache, null, 2));
}

export function loadAccountCache(email: string): CachedQuota | null {
  const path = join(getAccountDir(email), 'cache.json');
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as CachedQuota;
  } catch (err) {
    debug('accounts-storage', `Failed to parse cache for ${email}`, err);
    return null;
  }
}

export function deleteAccountCache(email: string): void {
  const path = join(getAccountDir(email), 'cache.json');

  if (existsSync(path)) {
    try {
      rmSync(path);
      debug('accounts-storage', `Deleted cache for ${email}`);
    } catch (err) {
      debug('accounts-storage', `Failed to delete cache for ${email}`, err);
    }
  }
}

export function deleteAccount(email: string): boolean {
  const dir = getAccountDir(email);

  if (!existsSync(dir)) {
    debug('accounts-storage', `Account ${email} does not exist`);
    return false;
  }

  try {
    rmSync(dir, { recursive: true, force: true });
    debug('accounts-storage', `Deleted account ${email}`);
    return true;
  } catch (err) {
    debug('accounts-storage', `Failed to delete account ${email}`, err);
    return false;
  }
}
