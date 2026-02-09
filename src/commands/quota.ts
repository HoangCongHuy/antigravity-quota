import {
  getAccountManager,
  getCacheAge,
  isCacheValid,
  loadCache,
  saveCache,
} from '../accounts';
import {
  AntigravityNotRunningError,
  APIError,
  AuthenticationError,
  LocalConnectionError,
  NetworkError,
  NoAuthMethodAvailableError,
  NotLoggedInError,
  PortDetectionError,
  RateLimitError,
} from '../core/errors';
import { debug, error, info } from '../core/logger';
import {
  getTokenManager,
  getTokenManagerForAccount,
  resetTokenManager,
} from '../google/token-manager';
import { printQuotaJson, printQuotaTable } from '../quota/format';
import { fetchQuota, QuotaMethod } from '../quota/service';
import { QuotaSnapshot } from '../quota/types';
import { AllAccountsQuotaResult } from '../render';
import { renderAllQuotaTable } from '../render/table';

interface QuotaOptions {
  json?: boolean;
  method?: QuotaMethod;
  all?: boolean;
  account?: string;
  refresh?: boolean;
}

export async function quotaCommand(options: QuotaOptions): Promise<void> {
  if (options.all) {
    return await fetchAllAccountsQuota(options);
  }

  return await fetchSingleAccountQuota(options);
}

async function fetchAllAccountsQuota(options: QuotaOptions): Promise<void> {
  const manager = getAccountManager();
  const emails = manager.getAccountEmails();
  const activeEmail = manager.getActiveEmail();

  if (emails.length === 0) {
    error('No accounts found. Run: antigravity-usage login');
    process.exit(1);
  }

  if (options.refresh) {
    info('🔄 Refreshing quota data for all accounts...\n');
  }

  const results: AllAccountsQuotaResult[] = [];
  for (const email of emails) {
    const isActive = email === activeEmail;
    try {
      if (!options.refresh && isCacheValid(email)) {
        const cached = loadCache(email);
        if (cached) {
          debug('quota', `Using cached quota for ${email}`);
          results.push({
            email,
            isActive,
            status: 'cached',
            snapshot: cached,
            cacheAge: getCacheAge(email) || 0,
          });
          continue;
        }
      }

      debug('quota', `Fetching fresh data for ${email}`);
      const snapshot = await fetchQuotaForAccount(
        email,
        options.method || 'auto',
      );

      saveCache(email, snapshot);
      results.push({
        email,
        isActive,
        status: 'success',
        snapshot,
      });
    } catch (err) {
      debug('quota', `Error fetching quota for ${email}:`, err);
      const cached = loadCache(email);

      if (cached) {
        results.push({
          email,
          isActive,
          status: 'cached',
          snapshot: cached,
          cacheAge: getCacheAge(email) || 0,
        });
      } else {
        results.push({
          email,
          isActive,
          status: 'error',
          error: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }
  }

  if (options.json) {
    info(JSON.stringify(results, null, 2));
  } else {
    renderAllQuotaTable(results);
  }
}

async function fetchSingleAccountQuota(options: QuotaOptions): Promise<void> {
  const manager = getAccountManager();
  const accountEmail = options.account || manager.getActiveEmail();
  const originalActiveEmail = manager.getActiveEmail();

  // Force google method when --account is specified
  // (local method always uses IDE's logged-in account)
  let method = options.method || 'auto';
  if (options.account && method !== 'google') {
    debug(
      'quota',
      `Account specified, forcing google method (local uses IDE account)`,
    );
    method = 'google';
  }

  if (method === 'google') {
    const tokenManager = options.account
      ? getTokenManagerForAccount(options.account)
      : getTokenManager();

    if (!tokenManager.isLoggedIn()) {
      error('Not logged in. Run: antigravity-quota login');
      process.exit(1);
    }
  }

  try {
    let accountSwitched = false;
    if (options.account && options.account !== originalActiveEmail) {
      debug(
        'quota',
        `Temporarily switching to account ${options.account} for fetch`,
      );
      manager.setActiveAccount(options.account);
      accountSwitched = true;
    }

    try {
      debug('quota', `Fetching quota via ${method} method...`);
      const snapshot = await fetchQuota(method);

      if (accountEmail) {
        saveCache(accountEmail, snapshot);
      }

      if (options.json) {
        printQuotaJson(snapshot);
      } else {
        printQuotaTable(snapshot);
      }
    } finally {
      if (accountSwitched && originalActiveEmail) {
        debug('quota', `Restoring active account to ${originalActiveEmail}`);
        manager.setActiveAccount(originalActiveEmail);
      }
    }
  } catch (err) {
    handleQuotaError(err);
  }
}

function handleQuotaError(err: unknown): never {
  if (err instanceof NoAuthMethodAvailableError) {
    error(err.message);
    process.exit(1);
  }

  if (err instanceof AntigravityNotRunningError) {
    error(err.message);
    info('\nTip: Make sure Antigravity is running in your IDE (VSCode, etc.)');
    process.exit(1);
  }

  if (err instanceof LocalConnectionError) {
    error(err.message);
    info('\nTip: Try restarting your IDE or the Antigravity extension.');
    process.exit(1);
  }

  if (err instanceof PortDetectionError) {
    error(err.message);
    info('\nTip: Make sure Antigravity is running in your IDE (VSCode, etc.)');
    process.exit(1);
  }

  if (err instanceof NotLoggedInError) {
    error(err.message);
    process.exit(1);
  }

  if (err instanceof AuthenticationError) {
    error(err.message);
    process.exit(1);
  }

  if (err instanceof NetworkError) {
    error(err.message);
    process.exit(1);
  }

  if (err instanceof RateLimitError) {
    error(err.message);
    if (err.retryAfterMs) {
      const seconds = Math.ceil(err.retryAfterMs / 1000);
      info(`Retry after ${seconds} seconds`);
    }

    process.exit(1);
  }

  if (err instanceof APIError) {
    error(err.message);
    process.exit(1);
  }

  error(
    `Failed to fetch quota: ${err instanceof Error ? err.message : 'Unknown error'}`,
  );
  debug('quota', 'Error details', err);
  process.exit(1);
}

async function fetchQuotaForAccount(
  email: string,
  method: QuotaMethod,
): Promise<QuotaSnapshot> {
  const manager = getAccountManager();
  const originalActiveEmail = manager.getActiveEmail();

  let effectiveMethod = method;
  if (method === 'auto' || method === 'local') {
    effectiveMethod = 'google';
    debug(
      'quota',
      `Forcing Google API for multi-account fetch (email: ${email})`,
    );
  }

  let accountSwitched = false;
  if (email !== originalActiveEmail) {
    debug('quota', `Switching to ${email} for fetch`);
    manager.setActiveAccount(email);
    resetTokenManager();
    accountSwitched = true;
  }

  try {
    const snapshot = await fetchQuota(effectiveMethod);
    return snapshot;
  } finally {
    if (accountSwitched && originalActiveEmail) {
      debug('quota', `Restoring active account to ${originalActiveEmail}`);
      manager.setActiveAccount(originalActiveEmail);
      resetTokenManager();
    }
  }
}
