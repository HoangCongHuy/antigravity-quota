import { getAccountManager } from '../accounts';
import { error, info, success, warn } from '../core/logger';
import { startOAuthFlow } from '../google/oauth';
import {
  getTokenManagerForAccount,
  resetTokenManager,
} from '../google/token-manager';
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

export async function refreshAccountCommand(
  email: string | undefined,
  options: RefreshOptions,
): Promise<void> {
  const manager = getAccountManager();
  if (options.all) {
    const emails = manager.getAccountEmails();

    if (emails.length === 0) {
      warn('No accounts to refresh.');
      return;
    }

    info(`\n🔄 Refreshing ${emails.length} accounts...`);

    let successCount = 0;
    let failCount = 0;

    for (const email of emails) {
      try {
        const tokenManager = getTokenManagerForAccount(email);
        if (tokenManager.isTokenExpired()) {
          await tokenManager.refreshToken();
          success(`✅ ${email}`);
          successCount++;
        } else {
          info(`⏭️ ${email} (token still valid)`);
          successCount++;
        }
      } catch (err) {
        error(`❌ ${email}: ${err instanceof Error ? err.message : 'Failed'}`);
        failCount++;
      }
    }

    resetTokenManager();

    if (failCount > 0) {
      warn(`Failed to refresh ${failCount} accounts.`);
    } else {
      success(`Refreshed ${successCount} accounts.`);
    }
    return;
  }

  const targetEmail = email || manager.getActiveEmail();
  if (!targetEmail) {
    error('No account specified.');
    process.exit(1);
  }

  if (!manager.hasAccount(targetEmail)) {
    error(`Account '${targetEmail}' not found.`);
    process.exit(1);
  }

  info(`Refreshing account ${targetEmail}...`);

  try {
    const tokenManager = getTokenManagerForAccount(targetEmail);
    if (!tokenManager.isTokenExpired()) {
      info(`⏭️ ${targetEmail} (token still valid)`);
      return;
    }

    await tokenManager.refreshToken();
    resetTokenManager();
    success(`✅ ${targetEmail}`);
  } catch (err) {
    error(
      `❌ ${targetEmail}: ${err instanceof Error ? err.message : 'Failed'}`,
    );
    process.exit(1);
  }
}

export async function accountsCommand(
  subcommand: string,
  args: string[],
  options: { refresh?: boolean; force?: boolean; all?: boolean },
): Promise<void> {
  switch (subcommand) {
    case 'list':
      listAccountsCommand({ refresh: options.refresh });
      break;
    case 'add':
      await addAccountCommand();
      break;
    case 'switch':
      if (!args[0]) {
        error('Please specify an account email to switch to.');
        process.exit(1);
      }
      switchAccountCommand(args[0]);
      break;
    case 'remove':
      if (!args[0]) {
        error('Please specify an account email to remove.');
        process.exit(1);
      }
      removeAccountCommand(args[0], { force: options.force });
      break;
    case 'current':
      currentAccountCommand();
      break;
    case 'refresh':
      await refreshAccountCommand(args[0], { all: options.all });
      break;
    default:
      listAccountsCommand({ refresh: options.refresh });
      break;
  }
}
