import { exec } from 'child_process';
import { promisify } from 'util';
import { debug } from '../core/logger';

const execAsync = promisify(exec);

export async function discoverPorts(pid: number): Promise<number[]> {
  const platform = process.platform;

  debug(
    'port-detective',
    `Discovering ports for PID ${pid} on platform ${platform}`,
  );
  if (platform === 'win32') {
    return discoverPortsOnWindows(pid);
  } else if (platform === 'darwin') {
    return discoverPortsOnMacOS(pid);
  } else {
    return discoverPortsOnLinux(pid);
  }
}

async function discoverPortsOnMacOS(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(
      `lsof -nP -iTCP -sTCP:LISTEN -a -p ${pid}`,
    );

    const ports: number[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port) && !ports.includes(port)) {
          ports.push(port);
        }
      }
    }

    debug('port-detective', `Found ports on macOS: ${ports.join(', ')}`);
    return ports;
  } catch (err) {
    debug('port-detective', 'Error discovering ports on macOS', err);
    return [];
  }
}

async function discoverPortsOnLinux(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(`ss -tlnp | grep "pid=${pid},"`);

    const ports: number[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port) && !ports.includes(port)) {
          ports.push(port);
        }
      }
    }

    if (ports.length > 0) {
      debug('port-detective', `Found ports on Linux (ss): ${ports.join(', ')}`);
      return ports;
    }

    return await discoverPortsOnLinuxNetstat(pid);
  } catch (err) {
    return await discoverPortsOnLinuxNetstat(pid);
  }
}

async function discoverPortsOnLinuxNetstat(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(
      `netsta -tlnp 2>/dev/null | grep "${pid}/"`,
    );

    const ports: number[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port) && !ports.includes(port)) {
          ports.push(port);
        }
      }
    }

    debug(
      'port-detective',
      `Found ports on Linux (netstat): ${ports.join(', ')}`,
    );
    return ports;
  } catch (err) {
    debug('port-detective', 'Error discovering ports on Linux', err);
    return [];
  }
}

async function discoverPortsOnWindows(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync('netstat -ano');

    const ports: number[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const linePid = parseInt(parts[parts.length - 1], 10);

        if (linePid === pid) {
          const localAddr = parts[1];
          const portMatch = localAddr.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            if (!isNaN(port) && !ports.includes(port)) {
              ports.push(port);
            }
          }
        }
      }
    }

    debug('port-detective', `Found ports on Windows: ${ports.join(', ')}`);
    return ports;
  } catch (err) {
    debug('port-detective', 'Error discovering ports on Windows', err);
    return [];
  }
}
