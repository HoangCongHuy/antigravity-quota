import { QuotaSnapshot, StoredTokens } from '../quota/types';

export interface GlobalConfig {
  version: string;
  activeAccount: string | null;
  preferences: ConfigPreferences;
}

export interface ConfigPreferences {
  cacheTTL: number;
}

export const DEFAULT_CONFIG: GlobalConfig = {
  version: '2.0',
  activeAccount: null,
  preferences: {
    cacheTTL: 300,
  },
};

export interface AccountMetaData {
  email: string;
  addedAt: string; // ISO date string
  lastUsed: string; // ISO date string
}

export interface CachedQuota {
  cacheAt: string;
  ttl: number;
  data: QuotaSnapshot | null;
}

export interface AccountInfo {
  email: string;
  isActive: boolean;
  metadata: AccountMetaData | null;
  tokens: StoredTokens | null;
  cache: CachedQuota | null;
  status: AccountStatus;
}

export type AccountStatus = 'valid' | 'expired' | 'invalid';

export interface AccountSummary {
  email: string;
  isActive: boolean;
  status: AccountStatus;
  lastUsed: string | null;
  cachedCredits?: {
    used: number;
    limit: number;
  } | null;
}
