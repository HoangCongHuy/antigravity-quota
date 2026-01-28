import { dirname } from 'node:path';
import { getAccountDir, getConfigDir, getTokensPath } from '../core/env';
import { StoredTokens } from '../quota/types';
import { debug } from '../core/logger';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  accountExists,
  getActiveAccountEmail,
  loadAccountTokens,
} from '../accounts';
import { deleteAccount } from '../accounts/storage';

export function saveTokens(tokens: StoredTokens): void {
  const email = tokens.email;

  if (!email) {
    const path = getTokensPath();
    const dir = dirname(path);

    debug('storage', `Saving tokens to legacy path ${path}`);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(path, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    return;
  }
}

export function loadTokens(): StoredTokens | null {
  const activeEmail = getActiveAccountEmail();

  if (activeEmail) {
    const tokens = loadAccountTokens(activeEmail);
    if (tokens) {
      debug('storage', `Loaded tokens for active account ${activeEmail}`);
      return tokens;
    }
  }

  const legacyPath = getTokensPath();
  debug('storage', `Loading tokens from legacy path ${legacyPath}`);
  if (!existsSync(legacyPath)) {
    debug('storage', 'No tokens file found');
    return null;
  }

  try {
    const content = readFileSync(legacyPath, 'utf-8');
    const tokens = JSON.parse(content) as StoredTokens;
    debug('storage', 'Tokens loaded successfully from legacy path');
    return tokens;
  } catch (err) {
    debug('storage', 'Failed to parse tokens file', err);
    return null;
  }
}

export function deleteTokens(): boolean {
  const activeEmail = getActiveAccountEmail();
  if (activeEmail && accountExists(activeEmail)) {
    debug('storage', `Deleting account ${activeEmail}`);
    return deleteAccount(activeEmail);
  }

  const path = getTokensPath();
  debug('storage', `Deleting tokens at legacy path ${path}`);

  if (!existsSync(path)) {
    debug('storage', 'No tokens file to delete');
    return false;
  }

  try {
    unlinkSync(path);
    debug('storage', 'Tokens deleted successfully');
    return true;
  } catch (error) {
    debug('storage', 'Failed to delete tokens file', error);
    return false;
  }
}

export function hasTokens(): boolean {
  const activeEmail = getActiveAccountEmail();
  if (activeEmail && accountExists(activeEmail)) {
    return true;
  }

  return existsSync(getTokensPath());
}

export function getStorageInfo(): {
  configDir: string;
  tokensPath: string;
  exists: boolean;
} {
  const configDir = getConfigDir();
  const activeEmail = getActiveAccountEmail();

  let tokensPath: string;
  let exists: boolean;

  if (activeEmail) {
    tokensPath = `${getAccountDir(activeEmail)}/tokens.json`;
    exists = accountExists(activeEmail);
  } else {
    tokensPath = getTokensPath();
    exists = existsSync(tokensPath);
  }

  return {
    configDir,
    tokensPath,
    exists,
  };
}
