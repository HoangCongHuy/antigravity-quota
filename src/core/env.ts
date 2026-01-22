import { homedir, platform } from "node:os";
import { join } from "node:path";

export type Platform = 'windows' | 'mac' | 'linux';

const configDirName = 'antigravity-quota';

export function getPlatform(): Platform {
    const t = platform();
    if (t === 'win32') return 'windows';
    if (t === 'darwin') return 'mac';
    return 'linux';
}

export function getConfigDir(): string {
    const p = getPlatform();
    const home = homedir();
    switch (p) {
        case 'windows':
            return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), configDirName);
        case 'mac':
            return join(home, 'Library', 'Application Support', configDirName);
        case 'linux':
        default:
            return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), configDirName);
    }
}

export function getTokensPath(): string {
    return join(getConfigDir(), 'tokens.json');
}

export function getAccountsDir(): string {
    return join(getConfigDir(), 'accounts');
}

export function getAccountDir(email: string): string {
    const safeName = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
    return join(getAccountsDir(), safeName);
}

export function getGlobalConfigPath(): string {
    return join(getConfigDir(), 'config.json');
}