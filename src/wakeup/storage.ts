import { join } from 'path';
import { getConfigDir } from '../core/env';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { debug } from '../core/logger';
import { WakeupConfig } from './type';

const MAX_HISTORY_ENTRIES = 100;
const WAKEUP_DIR_NAME = 'wakeup';
const CONFIG_FILE_NAME = 'config.json';
const HISTORY_FILE_NAME = 'history.json';
const RESET_STATE_FILE_NAME = 'reset-state.json';
const MODEL_MAPPING_FILE_NAME = 'model-mapping.json';

function getWakeupDir(): string {
  return join(getConfigDir(), WAKEUP_DIR_NAME);
}

function ensureWakeupDir(): void {
  const dir = getWakeupDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    debug('wakeup-storage', `Created wakeup directory: ${dir}`);
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  const filepath = join(getWakeupDir(), filename);
  try {
    if (existsSync(filepath)) {
      const content = readFileSync(filepath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    debug('wakeup-storage', `Error reading ${filename}: `, err);
  }

  return defaultValue;
}

function writeJsonFile<T>(filename: string, data: T): void {
  ensureWakeupDir();
  const filepath = join(getWakeupDir(), filename);

  try {
    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    debug('wakeup-storage', `wrote ${filename}`);
  } catch (err) {
    debug('wakeup-storage', `Error writing ${filename}: `, err);
    throw err;
  }
}

export function loadWakeupConfig(): WakeupConfig | null {}
