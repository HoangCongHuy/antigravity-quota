import { debug } from '../core/logger';
import https from 'https';
import http from 'http';

export interface ConnectUserStatus {
  isAuthenticated?: boolean;
  email?: string;

  quota?: {
    promptCredits?: {
      used?: number;
      limit?: number;
      remaining?: number;
    };
    models?: Array<ConnectModelInfo>;
  };

  raw?: unknown;
}

export interface ConnectModelInfo {
  modelId: string;
  displayName?: string;
  label?: string;
  quota?: {
    remaining?: number;
    limit?: number;
    usedPercentage?: number;
    remainingPercentage?: number;
    resetTime?: string;
    timeUntilResetMs?: number;
  };
  isExhausted?: boolean;
}

export class ConnectClient {
  private baseUrl: string;
  private csrfToken: string | undefined;
  private isHttps: boolean;

  constructor(baseUrl: string, csrfToken?: string) {
    this.baseUrl = baseUrl;
    this.csrfToken = csrfToken;
    this.isHttps = baseUrl.startsWith('https://');
    debug(
      'connect-client',
      `Initialized with baseUrl: ${baseUrl}, hasToken: ${!!csrfToken}`,
    );
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
      };

      if (this.csrfToken) {
        headers['X-Codeium-Csrf-Token'] = this.csrfToken;
      }

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers,
        timeout: 5000,
        rejectUnauthorized: false,
      };

      const protocol = this.isHttps ? https : http;

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch {
              resolve(data);
            }
          } else if (res.statusCode === 404) {
            reject(new Error(`Endpoint not found: ${path}`));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  async getUserStatus(): Promise<ConnectUserStatus> {
    debug('connect-client', 'Fetching user status via Connect RPC');
    const endpoint =
      '/exa.language_server_pb.LanguageServerService/GetUserStatus';

    try {
      const response = await this.request('POST', endpoint, {
        metadata: {
          ideName: 'antigravity',
          extensionName: 'antigravity',
          locale: 'en',
        },
      });

      if (response) {
        debug('connect-client', `Got response from ${endpoint}`);
        return this.parseUserStatus(response);
      }
    } catch (err) {
      debug('connect-client', `Connect RPC call failed: ${err}`);
      throw new Error(
        `Failed to fetch user status: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
    throw new Error('Could not fetch user status from Connect RPC endpoint');
  }

  private parseUserStatus(response: unknown): ConnectUserStatus {
    debug('connect-client', 'Raw response:', JSON.stringify(response, null, 2));

    const status: ConnectUserStatus = {
      raw: response,
    };

    if (typeof response !== 'object' || response === null) {
      return status;
    }

    const data = response as Record<string, unknown>;

    const userStatus = (data.userStatus as Record<string, unknown>) || data;
    if ('email' in userStatus && typeof userStatus.email === 'string') {
      status.email = userStatus.email;
    }

    if ('isAuthenticated' in userStatus) {
      status.isAuthenticated = Boolean(userStatus.isAuthenticated);
    }

    status.quota = this.extractQuota(userStatus);

    return status;
  }

  private extractQuota(
    data: Record<string, unknown>,
  ): ConnectUserStatus['quota'] {}
}
