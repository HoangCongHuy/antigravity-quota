import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { getAccountDir, getAccountsDir } from '../core/env';
import { debug } from '../core/logger';
import { join } from 'node:path';

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
