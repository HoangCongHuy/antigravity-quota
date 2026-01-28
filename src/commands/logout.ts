import { getAccountManager } from '../accounts';
import { info, success, warn } from '../core/logger';
import { resetTokenManager } from '../google/token-manager';

interface LoggoutOptions {
  all?: boolean;
}

export function logoutCommand(options: LoggoutOptions, email?: string): void {
  const manager = getAccountManager();

  if (options.all) {
    const count = manager.removeAllAccounts();
    resetTokenManager();

    if (count > 0) {
      success(`Logged out of ${count} account(s)`);
    } else {
      warn('No accounts to log out.');
    }

    return;
  }

  if (email) {
    if (!manager.hasAccount(email)) {
      warn(`Account ${email} not found.`);
      return;
    }

    const removed = manager.removeAccount(email);
    resetTokenManager();

    if (removed) {
      success(`Logged out of ${email}`);
      const remaining = manager.getAccountEmails();
      if (remaining.length > 0) {
        info(`Active Account: ${manager.getActiveEmail() || 'none'}`);
      }
    } else {
      warn(`Counld not log out of ${email}`);
    }
    return;
  }

  const activeEmail = manager.getActiveEmail();
  if (!activeEmail) {
    warn('Not logged in.');
    return;
  }

  const removed = manager.removeAccount(activeEmail);
  resetTokenManager();
  if (removed) {
    success(`Logged out of ${activeEmail}`);
    const remaining = manager.getAccountEmails();
    if (remaining.length > 0) {
      const newActive = manager.getActiveEmail();
      info(`Switched to account: ${newActive}`);
    }
  } else {
    warn('Could not delete account.');
  }
}
