import { resolve } from 'node:dns';
import {
  accountExists,
  getActiveAccountEmail,
  loadAccountTokens,
  saveAccountTokens,
  updateLastUsed,
} from '../accounts';
import { NotLoggedInError, TokenRefreshError } from '../core/errors';
import { debug } from '../core/logger';
import { StoredTokens } from '../quota/types';
import { refreshAccessToken } from './oauth';
import { hasTokens, loadTokens, saveTokens } from './storage';

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export class TokenManager {
  private tokens: StoredTokens | null = null;
  private accountEmail: string | null = null;

  constructor(email?: string) {
    if (email) {
      this.accountEmail = email;
      this.tokens = loadAccountTokens(email);
    } else {
      this.accountEmail = getActiveAccountEmail();
      if (this.accountEmail) {
        this.tokens = loadAccountTokens(this.accountEmail);
      } else {
        this.tokens = loadTokens();
      }
    }
  }

  getAccountEmail(): string | null {
    return this.accountEmail || this.tokens?.email || null;
  }

  isLoggedIn(): boolean {
    if (this.accountEmail) {
      return accountExists(this.accountEmail) && this.tokens !== null;
    }

    return hasTokens() && this.tokens !== null;
  }

  getEmail(): string | undefined {
    return this.tokens?.email;
  }

  getExpiredAt(): Date | undefined {
    if (!this.tokens) {
      return undefined;
    }

    return new Date(this.tokens.expiresAt);
  }

  getProjectId(): string | undefined {
    return this.tokens?.projectId;
  }

  setProjectId(projectId: string): void {
    if (!this.tokens) return;

    this.tokens.projectId = projectId;
    if (this.accountEmail) {
      saveAccountTokens(this.accountEmail, this.tokens);
    } else {
      saveTokens(this.tokens);
    }

    debug('token-manager', `Project ID saved: ${projectId}`);
  }

  isTokenExpired(): boolean {
    if (!this.tokens) return true;
    return Date.now() >= this.tokens.expiresAt - EXPIRY_BUFFER_MS;
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new NotLoggedInError();
    }
    debug('token-manager', 'Checking token validity');
    if (this.isTokenExpired()) {
      debug('token-manager', 'Token expired or expiring soon, refreshing...');
      await this.refreshToken();
    }

    return this.tokens.accessToken;
  }

  async refreshToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new NotLoggedInError(
        'No refresh token available. Please login again.',
      );
    }

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        debug(
          'token-manager',
          `Refreshing token (attempt ${attempt}/${MAX_RETRIES})...`,
        );
        const response = await refreshAccessToken(this.tokens.refreshToken);
        this.tokens = {
          accessToken: response.access_token,
          refreshToken: response.refresh_token || this.tokens?.refreshToken,
          expiresAt: Date.now() + response.expires_in * 1000,
          email: this.tokens.email,
          projectId: this.tokens.projectId,
        };

        if (this.accountEmail) {
          saveAccountTokens(this.accountEmail, this.tokens);
          updateLastUsed(this.accountEmail);
        } else {
          saveTokens(this.tokens);
        }

        debug('token-manager', 'Token refreshed successfully');
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message.toLowerCase();
        const isPermanentError =
          errorMessage.includes('invalid_grant') ||
          errorMessage.includes('400') ||
          errorMessage.includes('401') ||
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('token has been revoked');

        if (isPermanentError) {
          debug(
            'token-manager',
            `Token refresh failed permanently: ${lastError.message}`,
          );
          throw new TokenRefreshError(
            `Refresh token invalid or expired. Please login again.`,
            { cause: lastError, isRetryable: false },
          );
        }

        if (attempt < MAX_RETRIES) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          debug(
            'token-manager',
            `Token refresh attempt ${attempt} failed: ${lastError.message}. Retrying in ${delayMs}ms...`,
          );
          await this.sleep(delayMs);
        } else {
          debug(
            'token-manager',
            `Token refresh failed after ${MAX_RETRIES} attempts: ${lastError.message}`,
          );
        }
      }
    }

    throw new TokenRefreshError(
      `Failed to refresh token after ${MAX_RETRIES} attempts`,
      {
        cause: lastError,
        isRetryable: false,
      },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  reload(): void {
    if (this.accountEmail) {
      this.tokens = loadAccountTokens(this.accountEmail);
    } else {
      this.tokens = loadTokens();
    }
  }
}

let tokenManagerInstance: TokenManager | null = null;

export function getTokenManager(): TokenManager {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new TokenManager();
  }

  return tokenManagerInstance;
}

export function getTokenManagerForAccount(email: string): TokenManager {
  return new TokenManager(email);
}

export function resetTokenManager(): void {
  tokenManagerInstance = null;
}
