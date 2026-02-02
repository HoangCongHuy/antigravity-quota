import { getAccountManager, getCacheAge, isCacheValid, loadCache, saveCache } from '../accounts';
import { debug, error, info } from '../core/logger';
import { QuotaMethod } from '../quota/service';
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
    return await fetchAllAccountsQuota(options)
  }

  return await fetchSingleAccountQuota(options)
}

async function fetchAllAccountsQuota(options: QuotaOptions): Promise<void> {
  const manager = getAccountManager()
  const emails = manager.getAccountEmails()
  const activeEmail = manager.getActiveEmail()

  if (emails.length === 0) {
    error('No accounts found. Run: antigravity-usage login')
    process.exit(1)
  }

  if (options.refresh) {
    info('🔄 Refreshing quota data for all accounts...\n')
  }

  const results: AllAccountsQuotaResult[] = []
  for (const email of emails) {
    const isActive = email === activeEmail
    try {
      if (!options.refresh && isCacheValid(email)) {
        const cached = loadCache(email)
        if (cached) {
          debug('quota', `Using cached quota for ${email}`)
          results.push({
            email,
            isActive,
            status: 'cached',
            snapshot: cached,
            cacheAge: getCacheAge(email) || 0
          })
          continue
        }
      }

      debug('quota', `Fetching fresh data for ${email}`)
      const snapshot = await fetchQuotaForAccount(email, options.method || 'auto')

      saveCache(email, snapshot)
      results.push({
        email,
        isActive,
        status: 'success',
        snapshot,
      })
    } catch (err) {
      debug('quota', `Error fetching quota for ${email}:`, err)
      const cached = loadCache(email)

      if (cached) {
        results.push({
          email,
          isActive,
          status: 'cached',
          snapshot: cached,
          cacheAge: getCacheAge(email) || 0
        })
      } else {
        results.push({
          email,
          isActive,
          status: 'error',
          error: err instanceof Error ? err.message : 'unknown error'
        })
      }
    }
  }

  if (options.json) {
    info(JSON.stringify(results, null, 2))
  } else {
    renderAllQuotaTable(results)
  }

}

async function fetchSingleAccountQuota(options: QuotaOptions): Promise<void> {
  const manager = getAccountManager()
  const accountEmail = options.account || manager.getActiveEmail()
  const originalActiveEmail = manager.getActiveEmail()

  // Force google method when --account is specified
  // (local method always uses IDE's logged-in account)
  let method = options.method || 'auto'
  if (options.account && method !== 'google') {
    debug('quota', `Account specified, forcing google method (local uses IDE account)`)
    method = 'google'
  }
}