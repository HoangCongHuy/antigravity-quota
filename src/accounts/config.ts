import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { getGlobalConfigPath } from '../core/env';
import { DEFAULT_CONFIG, GlobalConfig } from './types';
import { debug } from '../core/logger';
import { dirname } from 'node:path';

export function loadConfig(): GlobalConfig {
  const path = getGlobalConfigPath();

  if (!existsSync(path)) {
    debug('config', 'No config file found, using defaults');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const config = JSON.parse(content) as Partial<GlobalConfig>;

    return {
      ...DEFAULT_CONFIG,
      ...config,
      preferences: {
        ...DEFAULT_CONFIG.preferences,
        ...config.preferences,
      },
    };
  } catch (err) {
    debug('config', 'Failed to load config', err);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: GlobalConfig): void {
  const path = getGlobalConfigPath();
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  debug('config', `Saving config to ${path}`);
  writeFileSync(path, JSON.stringify(config, null, 2));
}

export function getActiveAccountEmail(): string | null {
  const config = loadConfig();
  return config.activeAccount;
}

export function setActiveAccountEmail(email: string | null): void {
  const config = loadConfig();
  config.activeAccount = email;
  saveConfig(config);
}

export function getCacheTTL(): number {
  const config = loadConfig();
  return config.preferences.cacheTTL;
}
