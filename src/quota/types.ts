export interface QuotaSnapshot {
  timestamp: string;
  method: 'google' | 'local';
  email?: string;
  planType?: string;
  promptCredits?: PromptCreditsInfo;
  models: ModelQuotaInfo[];
}

export interface ModelQuotaInfo {
  label: string;
  modelId: string;
  remainingPercentage?: number;
  isExhausted: boolean;
  resetTime?: string;
  timeUntilResetMs?: number;
}

export interface PromptCreditsInfo {
  available: number;
  monthly: number;
  usedPercentage: number;
  remainingPercentage: number;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email?: string;
  projectId?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}
