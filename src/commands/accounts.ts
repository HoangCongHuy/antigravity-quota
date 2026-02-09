import { getAccountManager } from '../accounts';
import { info } from '../core/logger';

interface ListOptions {
  refresh?: boolean;
}

interface RemoveOptions {
  force?: boolean;
}

interface RefreshOptions {
  all?: boolean;
}

export function listAccountsCommand(options: ListOptions): void {
  const manager = getAccountManager();
  const summaries = manager.getAccountSummaries();

  renderAccountsTable(summaries);

  if (options.refresh) {
    info(
      'Use `antigravity-quota quota --all -refresh` to fetch fresh quota data.',
    );
  }
}
