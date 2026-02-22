import { getPlatform } from '../core/env';
import { info } from '../core/logger';
import { getStorageInfo } from '../google/storage';
import { getTokenManager } from '../google/token-manager';
import { version } from '../version';

export function doctorCommand(): void {
  info('');
  info('🩺 Antigravity quota - Diagnostics');
  info('='.repeat(50));
  info('');

  info('📦 Version');
  info('-'.repeat(40));
  info(`CLI version: ${version}`);
  info(`Node version: ${process.version}`);
  info(`Platform: ${getPlatform()}`);
  info('');

  const storage = getStorageInfo();
  info('📁 Configuration');
  info('-'.repeat(40));
  info(`Config directory: ${storage.configDir}`);
  info(`Tokens path: ${storage.tokensPath}`);
  info(`Config exists: ${storage.exists ? 'Yes' : 'No'}`);
  info('');

  const tokenManager = getTokenManager();
  info('🔐 Authentication');
  info('-'.repeat(40));

  if (!tokenManager.isLoggedIn()) {
    info('Status: Not logged in');
    info('');
    info('💡 Run "antigravity-quota login" to authenticate');
  } else {
    info('Status: Logged in');
    const email = tokenManager.getEmail();
    if (email) {
      info(`Email: ${email}`);
    }

    const expiresAt = tokenManager.getExpiredAt();
    if (expiresAt) {
      const isExpired = tokenManager.isTokenExpired();
      info(`Token expires at: ${expiresAt.toLocaleString()}`);
      info(`Token expired: ${isExpired ? 'Yes' : 'No'}`);
    }
  }

  info('');
  info('🔧 OAuth Configuration');
  info('-'.repeat(40));
  const hasClientId = !!process.env.ANTIGRAVITY_OAUTH_CLIENT_ID;
  const hasClientSecret = !!process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET;

  if (hasClientId || hasClientSecret) {
    info('Status: Custom OAuth configuration detected');
    info(`Client ID: ${hasClientId ? 'Set' : 'Not set'}`);
    info(`Client Secret: ${hasClientSecret ? 'Set' : 'Not set'}`);
  } else {
    info('Status: Using built-in OAuth configuration');
  }
}
