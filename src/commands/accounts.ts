import { getAccountManager } from '../accounts';
import { error, info, success, warn } from '../core/logger';
import { startOAuthFlow } from '../google/oauth';
import { renderAccountsTable } from '../render/table';

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

export async function addAccountCommand(): Promise<void> {
  info('Adding new account...');
  const result = await startOAuthFlow();

  if (result.success) {
    success(`Account ${result.email} added successfully`);
    const manager = getAccountManager();
    const summaries = manager.getAccountSummaries();
    info('\nYour accounts:');
    renderAccountsTable(summaries);
  } else {
    error(`Failed to add account: ${result.error}`);
    process.exit(1);
  }
}

export function switchAccountCommand(email: string): void {
  const manager = getAccountManager();
  if (!manager.hasAccount(email)) {
    error(`Account '${email}' not found.`);

    const emails = manager.getAccountEmails();
    if (emails.length > 0) {
      info('\nAvailable accounts:');
      for (const e of emails) {
        info(`   - ${e}`);
      }
    } else {
      info('\nNo accounts found. Run `antigravity-quota login` to add one.');
    }

    process.exit(1);
  }

  const switched = manager.setActiveAccount(email);
  if (switched) {
    success(`Switched to account ${email}`);
  } else {
    error(`Failed to switch to account ${email}`);
    process.exit(1);
  }
}

export function removeAccountCommand(
  email: string,
  options: RemoveOptions,
): void {
  const manager = getAccountManager();

  if (!manager.hasAccount(email)) {
    error(`Account '${email}' not found.`);
    process.exit(1);
  }

  if (!options.force) {
    warn(`This will remove account '${email}' and all its data.`);
    info('Use --force to skip this warning.');
  }

  const removed = manager.removeAccount(email);
  if (removed) {
    success(`Account '${email}' removed.`);
    const remaining = manager.getAccountEmails();
    if (remaining.length > 0) {
      const active = manager.getActiveEmail();
      info(`\nActive account: ${active || 'none'}`);
      info(`Remaining accounts: ${remaining.length}`);
    } else {
      info(
        '\nNo accounts remaining. Run `antigravity-quota login` to add one.',
      );
    }
  } else {
    error(`Failed to remove account '${email}'`);
    process.exit(1);
  }
}

export function currentAccountCommand(): void {
  const manager = getAccountManager();
  const active = manager.getActiveEmail();
  if (active) {
    info(`📍 Active account: ${active}`);
    const information = manager.getAccountInfo(active);
    if (information) {
      const statusIcon =
        information.status === 'valid'
          ? '✅'
          : information.status === 'expired'
            ? '⚠️'
            : '❌';
      info(`   Status: ${statusIcon} ${information.status}`);
      if (information.tokens?.expiresAt) {
        const expiresAt = new Date(
          information.tokens.expiresAt,
        ).toLocaleString();
        info(`   Token expires at: ${expiresAt}`);
      }
    }
  } else {
    warn('No active account set.');
    const emails = manager.getAccountEmails();
    if (emails.length > 0) {
      info('\nAvailable accounts:');
      for (const e of emails) {
        info(`   - ${e}`);
      }
      info('\nRun `antigravity-quota switch <email>` to switch to an account.');
    } else {
      info(`\nRun antigravity-quota login to add an account.`);
    }
  }
}
