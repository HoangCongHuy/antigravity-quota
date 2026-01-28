import CliTable3 from 'cli-table3';
import { getAccountManager } from '../accounts';
import { info, isDebugMode, warn } from '../core/logger';
import { maskEmail } from '../core/mask';
import {
  getTokenManager,
  getTokenManagerForAccount,
} from '../google/token-manager';

interface StatusOptions {
  all?: boolean;
  account?: string;
}

function showSingleAccountStatus(email?: string): void {
  const tokenManager = email
    ? getTokenManagerForAccount(email)
    : getTokenManager();

  info('');
  info('📍 Antigravity Usage Status');
  info('─'.repeat(40));

  const accountEmail = tokenManager.getEmail();
  const expiresAt = tokenManager.getExpiredAt();
  const isExpired = tokenManager.isTokenExpired();

  info(`✅ Logged in: Yes`);
  if (accountEmail) {
    console.log(`📧 Email: ${maskEmail(accountEmail)}`);
  }
  if (expiresAt) {
    const expiryStr = expiresAt.toLocaleString();
    const status = isExpired ? ' (expired/expiring soon)' : '';
    info(`📅 Expiry: ${expiryStr}${status}`);
  }
  if (isDebugMode()) {
    const tokens = email
      ? getAccountManager().getTokens(email)
      : getAccountManager().getActiveTokens();
    if (tokens) {
      info('');
      info('Debug info');
      info('─'.repeat(40));
      info(`  Access Token: ${tokens.accessToken}`);
      info(`  Refresh Token: ${tokens.refreshToken}`);
    }
  }
}

function showAllAccountStatus(): void {
  const manager = getAccountManager();
  const emails = manager.getAccountEmails();
  const activeEmail = manager.getActiveEmail();

  info('');
  console.log('📍 Antigravity Quota Status - All Accounts');
  console.log('─'.repeat(40));

  if (emails.length === 0) {
    warn('No accounts found.');
    info('Run `antigraviry-quota login` to add an account.');
    return;
  }

  const table = new CliTable3({
    head: ['Account', 'Logged In', 'Token Expiry'],
    style: {
      head: ['cyan'],
      border: ['gray'],
    },
    colWidths: [30, 12, 28],
  });

  for (const email of emails) {
    const tokenManager = getTokenManagerForAccount(email);
    const isActive = email === activeEmail;
    const nameDisplay = isActive ? `[*] ${email}` : email;

    if (tokenManager.isLoggedIn()) {
      const expiresAt = tokenManager.getExpiredAt();
      const isExpired = tokenManager.isTokenExpired();

      let expiryDisplay = '-';
      if (expiresAt) {
        expiryDisplay = expiresAt.toLocaleString();
        if (isExpired) {
          expiryDisplay = `⚠️ ${expiryDisplay}`;
        }
      }
      table.push([nameDisplay, '✅', expiryDisplay]);
    } else {
      table.push([nameDisplay, '❌', 'Invalid or missing']);
    }
  }

  info(table.toString());
  info('');
  info('[*] = Active Account');
  info('');
}

export function statusCommand(options: StatusOptions = {}): void {
  if (options.all) {
    showAllAccountStatus();
    return;
  }

  if (options.account) {
    const manager = getAccountManager();
    if (!manager.hasAccount(options.account)) {
      warn(`Account '${options.account}' not found`);
      return;
    }
    showSingleAccountStatus(options.account);
    return;
  }

  showSingleAccountStatus();
  return;
}
