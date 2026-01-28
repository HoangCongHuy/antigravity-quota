import { getAccountManager } from '../accounts';
import { error, info, success } from '../core/logger';
import { startOAuthFlow } from '../google/oauth';
import { resetTokenManager } from '../google/token-manager';

interface LoginOptions {
  noBrowser?: boolean;
  port?: number;
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  const manage = getAccountManager();
  const existingAccounts = manage.getAccountEmails();

  if (existingAccounts.length > 0) {
    info(
      `You have ${existingAccounts.length} account(s). Adding another account...`,
    );
  }

  const result = await startOAuthFlow({
    noBrowser: options.noBrowser,
    port: options.port,
  });

  if (result.success) {
    resetTokenManager();
    success(
      `Logged in successfully${result.email ? ` as ${result.email}` : ''}!`,
    );
    const accounts = manage.getAccountEmails();
    if (accounts.length > 1) {
      info(
        `\nYou now have ${accounts.length} accounts. Use \`antigravity-quota accounts list\` to see all.`,
      );
    }

    process.exit(0);
  } else {
    error(`Login failed: ${result.error}`);
    process.exit(1);
  }
}
