import https from 'https';
import http from 'http';
import { debug } from '../core/logger';

export interface ProbeResult {
  baseUrl: string;
  protocol: 'https' | 'http';
  port: number;
}

export async function probeForConnectAPI(
  ports: number[],
  csrfToken?: string,
  timeout = 500,
): Promise<ProbeResult | null> {
  debug('port-prober', `Probing ${ports.length} ports: ${ports.join(', ')}`);

  const probePromises = ports.map((port) => {
    return probePort(port, csrfToken, timeout);
  });

  const results = await Promise.allSettled(probePromises);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      debug('port-prober', `Found working endpoint: ${result.value.baseUrl}`);
      return result.value;
    }
  }

  debug('port-prober', 'No working Connect API endpoint found');
  return null;
}

async function probePort(
  port: number,
  csrfToken?: string,
  timeout = 500,
): Promise<ProbeResult | null> {
  const httpsResult = await probeHttps(port, timeout, csrfToken);
  if (httpsResult) {
    return httpsResult;
  }

  const httpResult = await probeHttp(port, timeout);
  if (httpResult) {
    return httpResult;
  }

  return null;
}

function probeHttps(
  port: number,
  timeout: number,
  csrfToken?: string,
): Promise<ProbeResult | null> {
  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
      method: 'POST',
      timeout,
      rejectUnauthorized: false, // Allow self-signed certificates
      headers: {
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        ...(csrfToken ? { 'X-Codeium-Csrf-Token': csrfToken } : {}),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        debug(
          'port-prober',
          `HTTPS Connect RPC probe on port ${port}: status ${res.statusCode} - valid connect port`,
        );
        resolve({
          baseUrl: `https://127.0.0.1:${port}`,
          protocol: 'https',
          port,
        });
      } else {
        debug(
          'port-prober',
          `HTTPS probe on port ${port}: status ${res.statusCode} - not connect port`,
        );
        resolve(null);
      }

      // Consume response data to free up memory
      res.resume();
    });

    req.on('error', (err) => {
      debug(
        'port-prober',
        `HTTPS probe on port ${port} failed: ${err.message}`,
      );
      resolve(null);
    });

    req.on('timeout', () => {
      debug('port-prober', `HTTPS probe on port ${port} timed out`);
      req.destroy();
      resolve(null);
    });

    req.write(JSON.stringify({ wrapper_data: {} }));
    req.end();
  });
}

function probeHttp(port: number, timeout: number): Promise<ProbeResult | null> {
  return new Promise((resolve) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port,
      path: '/',
      method: 'GET',
      timeout,
    };

    const req = http.request(options, (res) => {
      debug(
        'port-prober',
        `HTTP probe on port ${port}: status ${res.statusCode}`,
      );
      resolve({
        baseUrl: `http://localhost:${port}`,
        protocol: 'http',
        port,
      });

      res.resume();
    });

    req.on('error', (err) => {
      debug('port-prober', `HTTP probe on port ${port} failed: ${err.message}`);
      resolve(null);
    });

    req.on('timeout', () => {
      debug('port-prober', `HTTP probe on port ${port} timed out`);
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}
