import { promisify } from 'util';
import { debug } from '../core/logger';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface AntigraviryProcessInfo {
  pid: number;
  csrfToken?: string;
  extensionServicePort?: number;
  commandLine: string;
}

export async function detectAntigraviryProcess(): Promise<AntigraviryProcessInfo | null> {
  const platform = process.platform;
  debug(
    'process-detector',
    `Detecting Antigravity process on platform: ${platform}`,
  );

  if (platform === 'win32') {
    return detectOnWindows();
  } else {
    // macOs and Linux use similar commands
    return detectOnUnix();
  }
}

async function detectOnUnix(): Promise<AntigraviryProcessInfo | null> {
  try {
    const { stdout } = await execAsync('ps aux');

    const lines = stdout.split('\n');

    for (const line of lines) {
      if (
        line.toLowerCase().includes('antigravity') &&
        (line.includes('language-server') ||
          lines.includes('lsp') ||
          line.includes('servers'))
      ) {
        debug(
          'process-detector',
          `Found potential Antigravity process: ${line}`,
        );
        const processInfo = parseUnixProcessLine(line);
        if (processInfo) {
          return processInfo;
        }
      }
    }
    debug('process-detector', 'No Antigravity process found');
    return null;
  } catch (error) {
    debug('process-detector', 'Error detecting process on Unix', error);
    return null;
  }
}

function parseUnixProcessLine(line: string): AntigraviryProcessInfo | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 11) {
    return null;
  }

  const pid = parseInt(parts[1], 10);
  if (isNaN(pid)) {
    return null;
  }

  const commandLine = parts.slice(10).join(' ');

  const csrfToken = extractArgument(commandLine, '--csrf-token');
  const extensionServerPort = extractArgument(
    commandLine,
    '--extension-server-port',
  );

  return {
    pid,
    csrfToken: csrfToken || undefined,
    extensionServicePort: extensionServerPort
      ? parseInt(extensionServerPort, 10)
      : undefined,
    commandLine,
  };
}

function extractArgument(commandLine: string, argName: string): string | null {
  // Try --arg=value format
  const eqRegex = new RegExp(`${argName}=([^\\s"']+|"[^"]*"|'[^']*')`, 'i');
  const eqMatch = commandLine.match(eqRegex);
  if (eqMatch) {
    return eqMatch[1].replace(/^["']|["']$/g, '');
  }

  // Try --arg value format
  const spaceRegex = new RegExp(
    `${argName}\\s+([^\\s"']+|"[^"]*"|'[^']*')`,
    'i',
  );
  const spaceMatch = commandLine.match(spaceRegex);
  if (spaceMatch) {
    return spaceMatch[1].replace(/^["']|["']$/g, '');
  }

  return null;
}

async function detectOnWindows(): Promise<AntigraviryProcessInfo | null> {
  try {
    const { stdout } = await execAsync(
      "wmic process where \"name like '%antigravity%' or commandline like '%antigravity%\" get processid, commandline /format:csv",
      {
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const lines = stdout
      .split('\n')
      .filter(
        (line) => line.trim() && !line.includes('Node,CommandLine,ProcessId'),
      );

    for (const line of lines) {
      // CSV format: Node,CommandLine,ProcessId
      const parts = line.split(',');
      if (parts.length >= 3) {
        const commandLine = parts.slice(1, -1).join(','); // Command line might contain commas
        const pid = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(pid) && commandLine.toLowerCase().includes('antigravity')) {
          debug(
            'process-detector',
            `Found Antigravity process on Windows: PID ${pid}`,
          );

          const csrfToken = extractArgument(commandLine, '--csrf-token');
          const extensionServerPort = extractArgument(
            commandLine,
            '--extension-server-port',
          );

          return {
            pid,
            csrfToken: csrfToken || undefined,
            extensionServicePort: extensionServerPort
              ? parseInt(extensionServerPort, 10)
              : undefined,
            commandLine,
          };
        }
      }
    }

    return await detectOnWindowsPowerShell();
  } catch (error) {
    debug(
      'process-detector',
      'Error detecting process on Windows with WMIC, trying PowerShell',
      error,
    );
    return await detectOnWindowsPowerShell();
  }
}

async function detectOnWindowsPowerShell(): Promise<AntigraviryProcessInfo | null> {
  try {
    const { stdout } = await execAsync(
      "powershell -Command \"Get-Process | Where-Object { $_.ProcessName -like '*antigravity*' } | Select-Object Id, ProcessName | ConvertTo-Json",
    );

    if (!stdout.trim()) {
      return null;
    }

    const processes = JSON.parse(stdout);
    const processList = Array.isArray(processes) ? processes : [processes];

    for (const proc of processList) {
      if (proc.Id) {
        const { stdout: cmdLine } = await execAsync(
          `powershell -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = ${proc.Id}').CommandLine"`,
        );

        const commandLine = cmdLine.trim();
        const csrfToken = extractArgument(commandLine, '--csrf_token');
        const extensionServerPort = extractArgument(
          commandLine,
          '--extension-server-port',
        );

        return {
          pid: proc.Id,
          csrfToken: csrfToken || undefined,
          extensionServicePort: extensionServerPort
            ? parseInt(extensionServerPort, 10)
            : undefined,
          commandLine,
        };
      }
    }

    return null;
  } catch (error) {
    debug(
      'process-detector',
      'Error detecting process on Windows with PowerShell',
      error,
    );
    return null;
  }
}
