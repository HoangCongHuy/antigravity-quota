import { createServer } from 'node:http';
import { OAuthTokenResponse } from '../quota/types';
import { debug } from '../core/logger';

const OAUTH_CONFIG = {
  clientId:
    process.env.ANTIGRAVITY_OAUTH_CLIENT_ID ||
    '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
  clientSecret:
    process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET ||
    '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',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

const CLOUDCODE_CONFIG = {
  baseUrl: 'https://cloudcode-pa.googleapis.com',
  userAgent: 'antigravity',
  metadata: {
    ideType: 'ANTIGRAVITY',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  },
  onboardAttempts: 5,
  onboardDelayMs: 2000,
};

interface OAuthOptions {
  noBrowser?: boolean;
  port?: number;
}

interface OAuthResult {
  success: boolean;
  email?: string;
  error?: string;
}

interface LoadCodeAssisResponse {
  cloudaicompanionProject?: string | { id?: string };
  paidTier?: { id?: string };
  currentTier?: { id?: string };
  allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
}

interface OnboardUserResponse {
  done?: boolean;
  response?: {
    cloudaicompanionProject?: string | { id?: string };
  };
}

interface ProjectIdResult {
  projectId?: string;
  tierId?: string;
}

function generateState(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

async function getAvailablePort(preferredPort?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(preferredPort || 0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get available port'));
      }
    });
    server.on('error', reject);
  });
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResponse> {
  debug('oauth', 'Exchanging code for tokens');

  const params = new URLSearchParams({
    code,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    debug('oauth', 'Token exchange failed', error);
    throw new Error(`Token exchange failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  debug('oauth', 'Token exchange successful');
  return data;
}

async function getUserEmail(accessToken: string): Promise<string | undefined> {
  debug('oauth', 'Fetching user info');

  try {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.ok) {
      const data = (await response.json()) as { email?: string };
      return data.email;
    }
  } catch (error) {
    debug('oauth', 'Failed to fetch user info', error);
  }

  return undefined;
}

export function extractProjectId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string }).id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }

  return undefined;
}

export function pickOnboardTier(
  allowedTiers: Array<{ id?: string; isDefault?: boolean }> | undefined,
  tierIdFromLoad?: string,
): string | undefined {
  if (!allowedTiers || allowedTiers.length === 0) {
    return tierIdFromLoad;
  }

  const defaultTier = allowedTiers.find(
    (t) => t.isDefault === true && t.id && t.id.length > 0,
  );
  if (defaultTier?.id) {
    return defaultTier.id;
  }

  const firstTier = allowedTiers.find((t) => t.id && t.id.length > 0);
  if (firstTier?.id) {
    return firstTier.id;
  }

  if (allowedTiers.length > 0) {
    return 'LEGACY';
  }

  return tierIdFromLoad;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryOnboardUser(
  accessToken: string,
  tierId: string,
): Promise<string | undefined> {
  debug('oauth', `Starting onboard flow with tierId: ${tierId}`);
  const payload = {
    tierId,
    metadata: CLOUDCODE_CONFIG.metadata,
  };

  for (
    let attempt = 1;
    attempt <= CLOUDCODE_CONFIG.onboardAttempts;
    attempt++
  ) {
    debug(
      'oauth',
      `Onboard attempt ${attempt}/${CLOUDCODE_CONFIG.onboardAttempts}`,
    );
    try {
      const response = await fetch(
        `${CLOUDCODE_CONFIG.baseUrl}/v1internal:onboardUser`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': CLOUDCODE_CONFIG.userAgent,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        debug(
          'oauth',
          `Onboard attempt ${attempt} failed with status: ${response.status}`,
        );
        if (response.status === 401 || response.status === 403) {
          debug(
            'oauth',
            'Onboarding forbidden or unauthorized, stopping retries',
          );
          return undefined;
        }
      } else {
        const data = (await response.json()) as OnboardUserResponse;
        debug('oauth', `Onboard attempt ${attempt} successful`);
        if (data.done === true) {
          const projectId = extractProjectId(
            data.response?.cloudaicompanionProject,
          );
          if (projectId) {
            debug('oauth', `Onboard successful, project id: ${projectId}`);
            return projectId;
          }
          debug('oauth', 'Onboard successful, but no project id found');
          return undefined;
        }
      }
    } catch (error) {
      debug('oauth', `Onboard attempt ${attempt} error:`, error);
    }
  }

  debug('oauth', 'Onboarding attempts exhausted');
  return undefined;
}
