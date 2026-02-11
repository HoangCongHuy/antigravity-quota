import CliTable3 from 'cli-table3';
import { info } from '../core/logger';
import { AccountSummary } from '../accounts';
import { QuotaSnapshot } from '../quota/types';

export function renderAllQuotaTable(results: AllAccountsQuotaResult[]): void {
  if (results.length === 0) {
    info('\n📭 No accounts found.');
    info('\n💡 `Run: antigravity-quota login` to add an account.\n');
    return;
  }

  const sortedResults = [...results].sort((a, b) => {
    if (a.status === 'error' && b.status !== 'error') {
      return 1;
    }
    if (a.status !== 'error' && b.status === 'error') {
      return -1;
    }
    if (a.status === 'error' && b.status === 'error') {
      return 0;
    }

    const getRemaining = (result: AllAccountsQuotaResult): number => {
      const firstModel = result.snapshot?.models?.[0];
      if (!firstModel) return -1;
      if (firstModel.isExhausted) return 0;
      return firstModel.remainingPercentage ?? -1;
    };

    const aRemaining = getRemaining(a);
    const bRemaining = getRemaining(b);

    return bRemaining - aRemaining;
  });

  info('\n📊 Quota Overview - All Accounts');
  info('═'.repeat(70));

  const totalWidth = process.stdout.columns || 80;

  // Calculate responsive widths
  // Standard: [30, 10, 15, 20] = ~75 content + 13 border = 88 chars

  let colWidths: number[] | undefined;
  if (totalWidth < 80) {
    colWidths = undefined;
  } else if (totalWidth < 100) {
    colWidths = [25, 8, 12, 18];
  } else {
    colWidths = [30, 10, 15, 20];
  }

  const tableOptions: any = {
    head: ['Account', 'Source', 'Credits', 'Quota Remaining'],
    style: {
      head: ['cyan'],
      border: ['gray'],
    },
  };

  if (colWidths) {
    tableOptions.colWidths = colWidths;
  }

  const table = new CliTable3(tableOptions);
  const errors: string[] = [];

  for (const result of sortedResults) {
    const nameDisplay = result.isActive ? `${result.email} [*]` : result.email;
    if (result.status === 'error') {
      table.push([nameDisplay, '-', '-', result.error || 'Error']);
      errors.push(`${result.email}: ${result.error}`);
    } else {
      const snapshot = result.snapshot;
      const source =
        result.status === 'cached'
          ? `Cached (${formatCacheAge(result.cacheAge)})`
          : snapshot?.method.toUpperCase() || '-';

      let credits = '-';
      if (snapshot?.promptCredits) {
        const pc = snapshot.promptCredits;
        credits = `${pc.available} / ${pc.monthly}`;
      }

      let quotaRemanining = '-';
      if (snapshot?.models && snapshot.models.length > 0) {
        const minRemaining = Math.min(
          ...snapshot.models
            .filter((m) => m.remainingPercentage !== undefined)
            .map((m) => m.remainingPercentage!),
        );

        if (isFinite(minRemaining)) {
          const remainingPct = minRemaining * 100;
          quotaRemanining = formatQuotaRemainingBar(remainingPct);
        } else if (snapshot.models.some((m) => m.isExhausted)) {
          quotaRemanining = '❌ EXHAUSTED';
        }
      }

      table.push([nameDisplay, source, credits, quotaRemanining]);
    }
  }

  info(table.toString());
  if (errors.length > 0) {
    info(`\n⚠️  ${errors.length} account(s) had errors:`);
    for (const err of errors) {
      info(`   - ${err}`);
    }
  }

  info('\n[*] = active account');
  info('💡 Use --refresh to fetch latest data\n');
}

function formatCacheAge(seconds: number | undefined): string {
  if (seconds === undefined) {
    return '?';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }

  return `${Math.floor(seconds / 3600)}h`;
}

function formatQuotaRemainingBar(remainingPercentage: number): string {
  const width = 10;
  const filled = Math.round((remainingPercentage / 100) * width);
  const empty = width - filled;

  const filledChar = '█';
  const emptyChar = '░';

  return `${filledChar.repeat(filled)}${emptyChar.repeat(empty)} ${Math.round(remainingPercentage)}%`;
}

export function renderAccountsTable(accounts: AccountSummary[]): void {
  if (accounts.length === 0) {
    info('\n📭 No accounts found.');
    info('\n💡 Run `antigravity-quota login` to add an account.\n');
    return;
  }

  info('\n📊 Antigravity Accounts');
  info('═'.repeat(60));

  const totalWidth = process.stdout.columns || 80;
  const isSmallTerminal = totalWidth < 90;

  const colWidths = isSmallTerminal ? [25, 8, 12, 12] : [30, 10, 15, 15];
  const finalColWidths = totalWidth < 60 ? undefined : colWidths;

  const tableOptions: any = {
    head: ['Account', 'Status', 'Credits', 'Last Used'],
    style: {
      head: ['cyan'],
      border: ['gray'],
    },
  };

  if (finalColWidths) {
    tableOptions.colWidths = finalColWidths;
  }

  const table = new CliTable3(tableOptions);
  for (const account of accounts) {
    const nameDisplay = account.isActive
      ? `${account.email} [*]`
      : account.email;
    table.push([
      nameDisplay,
      formatStatus(account.status),
      formatCredits(account.cachedCredits),
      formatRelativeTime(account.lastUsed),
    ]);
  }

  info(table.toString());
  info('\n[*] = active account\n');
}

export interface AllAccountsQuotaResult {
  email: string;
  isActive: boolean;
  status: 'success' | 'error' | 'cached';
  error?: string;
  snapshot?: QuotaSnapshot;
  cacheAge?: number;
}

function formatStatus(status: string): string {
  switch (status) {
    case 'valid':
      return '✅';
    case 'expired':
      return '⚠️';
    case 'invalid':
      return '❌';
    default:
      return '❓';
  }
}

function formatCredits(
  credits:
    | {
        used: number;
        limit: number;
      }
    | null
    | undefined,
): string {
  if (!credits) {
    return '-';
  }

  return `${credits.limit - credits.used} / ${credits.limit}`;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) {
    return 'Never';
  }

  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days === 1) {
    return 'Yesterday';
  }

  return `${days} days ago`;
}
