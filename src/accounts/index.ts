export * from './types';

export {
  ensureAccountDir,
  ensureAccountsDir,
  accountExists,
  listAccountEmails,
  saveAccountTokens,
  loadAccountTokens,
  saveAccountMetadata,
  loadAccountMetadata,
  updateLastUsed,
  saveAccountCache,
  loadAccountCache,
  deleteAccountCache,
  deleteAccount as deleteAccountDir,
} from './storage';

export {
  loadConfig,
  saveConfig,
  getActiveAccountEmail,
  setActiveAccountEmail,
  getCacheTTL,
} from './config';

export {
  isCacheValid,
  getCacheAge,
  saveCache,
  loadCache,
  loadCacheWithMeta,
  invalidateCache,
} from './cache';

export { AccountManager, getAccountManager } from './manager';
