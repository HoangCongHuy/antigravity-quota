import {
  AntigravityNotRunningError,
  LocalConnectionError,
  NoAuthMethodAvailableError,
  PortDetectionError,
} from '../core/errors';
import { debug } from '../core/logger';
import {
  CloudCodeClient,
  FetchAvailableModelsResponse,
} from '../google/cloudcode';
import { extractProjectId } from '../google/oauth';
import { parseQuotaSnapshot } from '../google/parses';
import { getTokenManager } from '../google/token-manager';
import { ConnectClient } from '../local/connect-client';
import { discoverPorts } from '../local/port-detective';
import { probeForConnectAPI } from '../local/port-prober';
import { detectAntigraviryProcess } from '../local/process-detector';
import { QuotaSnapshot } from './types';

export type QuotaMethod = 'google' | 'local' | 'auto';

export async function fetchQuota(
  method: QuotaMethod = 'auto',
): Promise<QuotaSnapshot> {
  if (method === 'auto') {
    try {
      debug('service', 'Auto mode: trying local method first');
      return await fetchQuotaLocal();
    } catch (err) {
      debug('service', 'Auto mode: local method failed', err);
      const tokenManager = getTokenManager();
      if (tokenManager.isLoggedIn()) {
        debug('service', 'User is logged in, falling back to Google method');
        return fetchQuotaGoogle();
      }
      throw new NoAuthMethodAvailableError();
    }
  }

  if (method === 'local') {
    return fetchQuotaLocal();
  }

  return fetchQuotaGoogle();
}

async function fetchQuotaGoogle(): Promise<QuotaSnapshot> {
  debug('service', 'Fetching quota from google');

  const tokenManager = getTokenManager();
  const email = tokenManager.getEmail();
  const client = new CloudCodeClient(tokenManager);

  const codeAssistResponse = await client.loadCodeAssist();
  debug(
    'service',
    'Code assist response received',
    JSON.stringify(codeAssistResponse),
  );

  if (codeAssistResponse?.cloudaicompanionProject) {
    const projectId = extractProjectId(
      codeAssistResponse.cloudaicompanionProject,
    );
    if (projectId) {
      tokenManager.setProjectId(projectId);
      debug('service', `Project ID saved: ${projectId}`);
    }
  }

  let modelsResponse: FetchAvailableModelsResponse = {};

  try {
    modelsResponse = await client.fetchAvailableModels();
    debug(
      'service',
      'Models response received',
      JSON.stringify(modelsResponse),
    );
  } catch (error) {
    debug(
      'service',
      'Failed to fetch models (might need different permissions)',
      error,
    );
  }

  const snapshot = parseQuotaSnapshot(
    codeAssistResponse,
    modelsResponse,
    email,
  );

  debug('service', 'Quota snapshot created');
  return snapshot;
}

async function fetchQuotaLocal(): Promise<QuotaSnapshot> {
  debug('service', 'Fetching quota from local Antigravity server');
  const processInfo = await detectAntigraviryProcess();
  if (!processInfo) {
    throw new AntigravityNotRunningError();
  }

  debug('service', `Found Antigravity process: PID ${processInfo.pid}`);

  const ports = await discoverPorts(processInfo.pid);

  if (ports.length === 0) {
    throw new PortDetectionError();
  }

  debug(
    'service',
    `Discovered ${ports.length} listening ports: ${ports.join(', ')}`,
  );

  const probeResult = await probeForConnectAPI(ports, processInfo.csrfToken);
  if (!probeResult) {
    throw new LocalConnectionError(
      'Could not find Antigravity Connect API on any port',
    );
  }

  debug('service', `Found Connect API at ${probeResult.baseUrl}`);

  const client = new ConnectClient(probeResult.baseUrl, processInfo.csrfToken);
  const userStatus = await client.getUserStatus();

  debug('service', 'User status received from local server');
  const snapshot = parseLocalQuotaSnapshot(userStatus);

  debug('service', 'Local quota snapshot created');
  return snapshot;
}
