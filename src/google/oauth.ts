import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { OAuthTokenResponse, StoredTokens } from '../quota/types';
import { debug, info } from '../core/logger';
import open from 'open';
import { getAccountManager } from '../accounts';

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
    if (attempt < CLOUDCODE_CONFIG.onboardAttempts) {
      debug(
        'oauth',
        `Onboard attempt ${attempt} failed, waiting ${CLOUDCODE_CONFIG.onboardDelayMs}ms before retrying`,
      );
      await sleep(CLOUDCODE_CONFIG.onboardDelayMs);
    }
  }

  debug('oauth', 'Onboarding attempts exhausted');
  return undefined;
}

export async function resolveProjectId(
  accessToken: string,
): Promise<ProjectIdResult> {
  debug('oauth', 'Resolving project ID from Cloud Code API');

  try {
    const response = await fetch(
      `${CLOUDCODE_CONFIG.baseUrl}/v1internal:loadCodeAssist`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': CLOUDCODE_CONFIG.userAgent,
        },
        body: JSON.stringify({
          metatata: CLOUDCODE_CONFIG.metadata,
        }),
      },
    );

    if (!response.ok) {
      debug('oauth', `loadCodeAssist failed: ${response.status}`);
      return { projectId: undefined, tierId: undefined };
    }

    const data = (await response.json()) as LoadCodeAssisResponse;

    const projectId = extractProjectId(data.cloudaicompanionProject);
    const tierId = data.paidTier?.id || data.currentTier?.id;

    if (projectId) {
      debug('oauth', `Got projectId from loadCodeAssist: ${projectId}`);
      return { projectId, tierId };
    }
    debug(
      'oauth',
      'No projectId in loadCodeAssist response, initiating onboarding',
    );
    const onboardTier = pickOnboardTier(data.allowedTiers, tierId);
    if (!onboardTier) {
      debug('oauth', 'Cannot determine tier for onboarding');
      return { projectId: undefined, tierId };
    }

    const onboardedProjectId = await tryOnboardUser(accessToken, onboardTier);
    return { projectId: onboardedProjectId, tierId: onboardTier };
  } catch (error) {
    debug('oauth', 'Failed to resolve project ID', error);
    return { projectId: undefined, tierId: undefined };
  }
}

export async function startOAuthFlow(
  options: OAuthOptions = {},
): Promise<OAuthResult> {
  const port = await getAvailablePort(options.port);
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const state = generateState();

  debug('oauth', `Starting OAuth flow on port ${port}`);

  const authParams = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const authUrl = `${OAUTH_CONFIG.authUrl}?${authParams.toString()}`;

  return new Promise((resolve) => {
    let resolved = false;
    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        if (resolved) return;

        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const errorParam = url.searchParams.get('error');

          if (errorParam) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>Login Failed</h1><p>You can close this window.</p></body></html>',
            );
            resolved = true;
            server.close();
            resolve({ success: false, error: errorParam });
            return;
          }

          if (!code || returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>Invalid Request</h1><p>State mismatch or missing code.</p></body></html>',
            );
            resolved = true;
            server.close();
            resolve({ success: false, error: 'Invalid callback' });
            return;
          }

          try {
            const tokenResponse = await exchangeCodeForTokens(
              code,
              redirectUri,
            );
            const email = await getUserEmail(tokenResponse.access_token);
            let projectId: string | undefined;
            try {
              const projectResult = await resolveProjectId(
                tokenResponse.access_token,
              );
              projectId = projectResult.projectId;
              if (projectId) {
                debug('oauth', `Project ID resolved: ${projectId}`);
              } else {
                debug('oauth', 'No project ID obtained (will fetch on demand)');
              }
            } catch (err) {
              debug(
                'oauth',
                'Failed to resolve project ID during login (will fetch on demand)',
                err,
              );
            }

            const tokens: StoredTokens = {
              accessToken: tokenResponse.access_token,
              refreshToken: tokenResponse.refresh_token || '',
              expiresAt: Date.now() + tokenResponse.expires_in * 1000,
              email,
              projectId,
            };

            if (email) {
              getAccountManager().addAccount(tokens, email);
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>Login Successful!</h1>
                  <p>You are now logged in${email ? ` as <strong>${email}</strong>` : ''}.</p>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);
            resolved = true;
            server.close();
            resolve({ success: true, email });
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>Login Failed</h1><p>Token exchange failed.</p></body></html>',
            );
            resolved = true;
            server.close();
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      },
    );

    server.listen(port, '127.0.0.1', async () => {
      info('');
      info('Opening browser for Google login...');
      info('');

      if (options.noBrowser) {
        info('Open this URL in your browser:');
        info(authUrl);
      } else {
        try {
          await open(authUrl);
          info('If the browser did not open, visit this URL:');
          info(authUrl);
        } catch (err) {
          debug('oauth', 'Failed to open browser', err);
          info('Could not open browser. Please visit this URL:');
          info(authUrl);
        }
      }
      info('');
      info('Waiting for authentication...');
    });

    setTimeout(
      () => {
        if (!resolved) {
          resolved = true;
          server.close();
          resolve({ success: false, error: 'Authentication timeout' });
        }
      },
      2 * 60 * 1000,
    );
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<OAuthTokenResponse> {
  debug('oauth', 'Refreshing access token');

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    grant_type: 'refresh_token',
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
    debug('oauth', 'Failed to refresh access token', error);
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  debug('oauth', 'Token refresh successful');
  return data;
}
