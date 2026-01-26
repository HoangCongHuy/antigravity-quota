import {
  accountExists,
  AccountInfo,
  AccountMetaData,
  AccountStatus,
  AccountSummary,
  deleteAccountDir,
  getActiveAccountEmail,
  getCacheAge,
  isCacheValid,
  listAccountEmails,
  loadAccountMetadata,
  loadAccountTokens,
  loadCacheWithMeta,
  saveAccountMetadata,
  saveAccountTokens,
  setActiveAccountEmail,
  updateLastUsed,
} from '.';
import { debug } from '../core/logger';
import { StoredTokens } from '../quota/types';

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export class AccountManager {
  private static instace: AccountManager | null = null;

  private constructor() {}

  static getInstance(): AccountManager {
    if (!AccountManager.instace) {
      AccountManager.instace = new AccountManager();
    }

    return AccountManager.instace;
  }

  static resetInstance() {
    AccountManager.instace = null;
  }

  getAccountEmails(): string[] {
    return listAccountEmails();
  }

  getActiveEmail(): string | null {
    return getActiveAccountEmail();
  }

  setActiveAccount(email: string): boolean {
    if (!accountExists(email)) {
      debug('account-manager', `Account ${email} does not exist`);
      return false;
    }

    setActiveAccountEmail(email);
    updateLastUsed(email);
    debug('account-manager', `Switched to account ${email}`);
    return true;
  }

  hasAccount(email: string): boolean {
    return accountExists(email);
  }

  getAccountStatus(email: string): AccountStatus {
    const tokens = loadAccountTokens(email);

    if (!tokens) {
      return 'invalid';
    }

    const now = Date.now();
    if (now >= tokens.expiresAt - EXPIRY_BUFFER_MS) {
      if (tokens.refreshToken) {
        return 'expired';
      }

      return 'invalid';
    }

    return 'valid';
  }

  getAccountInfo(email: string): AccountInfo | null {
    if (!accountExists(email)) {
      return null;
    }

    const activeEmail = getActiveAccountEmail();
    const tokens = loadAccountTokens(email);
    const metadata = loadAccountMetadata(email);
    const cache = loadCacheWithMeta(email);
    const status = this.getAccountStatus(email);

    return {
      email,
      isActive: email === activeEmail,
      tokens,
      metadata,
      cache,
      status,
    };
  }

  getAccountSummaries(): AccountSummary[] {
    const emails = this.getAccountEmails();
    const activeEmail = getActiveAccountEmail();

    return emails.map((email) => {
      const metadata = loadAccountMetadata(email);
      const cache = loadCacheWithMeta(email);
      const status = this.getAccountStatus(email);

      let cachedCredits: { used: number; limit: number } | null = null;

      if (cache?.data?.promptCredits) {
        const pc = cache.data.promptCredits;
        cachedCredits = {
          used: pc.monthly - pc.available,
          limit: pc.monthly,
        };
      }

      return {
        email,
        isActive: email === activeEmail,
        status,
        lastUsed: metadata?.lastUsed || null,
        cachedCredits,
      };
    });
  }

  addAccount(tokens: StoredTokens, email: string): void {
    debug('account-manager', `Adding account ${email}`);
    saveAccountTokens(email, tokens);

    const now = new Date().toISOString();
    const metadata: AccountMetaData = {
      email,
      addedAt: now,
      lastUsed: now,
    };

    saveAccountMetadata(email, metadata);
    setActiveAccountEmail(email);
    debug('account-manager', `Account ${email} added and set as active`);
  }

  updateTokens(email: string, tokens: StoredTokens): void {
    if (!accountExists(email)) {
      debug(
        'account-manager',
        `Cannot update tokens: account ${email} does not exist`,
      );
      return;
    }

    saveAccountTokens(email, tokens);
    updateLastUsed(email);
    debug('account-manager', `Updated tokens for ${email}`);
  }

  removeAccount(email: string): boolean {
    if (!accountExists(email)) {
      debug('account-manager', `Account ${email} does not exist`);
      return false;
    }

    const activeEmail = getActiveAccountEmail();
    if (email === activeEmail) {
      setActiveAccountEmail(null);
    }

    const deleted = deleteAccountDir(email);
    if (deleted && email === activeEmail) {
      const remaining = this.getAccountEmails();
      if (remaining.length > 0) {
        setActiveAccountEmail(remaining[0]);
        debug('account-manager', `Set ${remaining[0]} as new active account`);
      }
    }

    return deleted;
  }

  removeAllAccounts(): number {
    const emails = this.getAccountEmails();
    let count = 0;
    for (const email of emails) {
      if (deleteAccountDir(email)) {
        count++;
      }
    }

    setActiveAccountEmail(null);
    debug('account-manager', `Removed ${count} accounts`);

    return count;
  }

  getTokens(email: string): StoredTokens | null {
    return loadAccountTokens(email);
  }

  getActiveTokens(): StoredTokens | null {
    const email = getActiveAccountEmail();
    if (!email) {
      return null;
    }

    return loadAccountTokens(email);
  }

  isCacheValid(email: string): boolean {
    return isCacheValid(email);
  }

  getCacheAge(email: string): number | null {
    return getCacheAge(email);
  }
}

export function getAccountManager(): AccountManager {
  return AccountManager.getInstance();
}
