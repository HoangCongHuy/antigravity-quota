import { join } from 'path';
import { getConfigDir } from '../core/env';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { debug } from '../core/logger';
import {
  getDefaultConfig,
  ModelMapping,
  ResetState,
  TriggerRecord,
  WakeupConfig,
} from './type';

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

export function loadWakeupConfig(): WakeupConfig | null {
  const config = readJsonFile<WakeupConfig | null>(CONFIG_FILE_NAME, null);
  if (config) {
    debug('wakeup-storage', `Loaded wakeup config: `, config);
  }

  return config;
}
export function saveWakeupConfig(config: WakeupConfig): void {
  writeJsonFile(CONFIG_FILE_NAME, config);
  debug('wakeup-storage', `Saved wakeup config: `, config);
}

export function getOrCreateConfig(): WakeupConfig {
  const existing = loadWakeupConfig();
  if (existing) {
    if (!existing.selectedModels || existing.selectedModels.length === 0) {
      existing.selectedModels = [
        'claude-sonnet-4-5',
        'gemini-3-flash',
        'gemini-3-pro-low',
      ];
      saveWakeupConfig(existing);
      debug('wakeup-storage', `Updated wakeup config: `, existing);
    }

    return existing;
  }

  const defaultConfig = getDefaultConfig();
  saveWakeupConfig(defaultConfig);
  debug('wakeup-storage', `Created default wakeup config: `, defaultConfig);

  return defaultConfig;
}

export function loadTriggerHistory(): TriggerRecord[] {
  return readJsonFile<TriggerRecord[]>(HISTORY_FILE_NAME, []);
}

export function saveTriggerHistory(history: TriggerRecord[]): void {
  writeJsonFile(HISTORY_FILE_NAME, history);
}

export function addTriggerRecord(record: TriggerRecord): void {
  const history = loadTriggerHistory();
  history.unshift(record);

  if (history.length > MAX_HISTORY_ENTRIES) {
    history.splice(MAX_HISTORY_ENTRIES);
  }

  saveTriggerHistory(history);
  debug('wakeup-storage', `Added trigger record: `, record);
}

export function getRecentHistory(limit: number = 10): TriggerRecord[] {
  const history = loadTriggerHistory();
  return history.slice(0, limit);
}

export function getLastTrigger(): TriggerRecord | null {
  const history = loadTriggerHistory();
  return history.length > 0 ? history[0] : null;
}

export function clearTriggerHistory(): void {
  saveTriggerHistory([]);
  debug('wakeup-storage', `Cleared trigger history`);
}

export function loadResetState(): ResetState {
  return readJsonFile<ResetState>(RESET_STATE_FILE_NAME, {});
}

export function saveResetState(state: ResetState): void {
  writeJsonFile(RESET_STATE_FILE_NAME, state);
}

export function updateResetState(modelKey: string, resetAt: string) {
  const state = loadResetState();
  state[modelKey] = {
    lastResetAt: resetAt,
    lastTriggeredTime: new Date().toISOString(),
  };

  saveResetState(state);
  debug('wakeup-storage', `Updated reset state for ${modelKey}: `, state);
}

export function getModelResetState(modelKey: string): {
  lastResetAt: string;
  lastTriggeredTime: string;
} | null {
  const state = loadResetState();
  return state[modelKey] || null;
}

export function clearResetStat(): void {
  saveResetState({});
  debug('wakeup-storage', `Cleared reset state`);
}

export function loadModelMapping(): ModelMapping {
  return readJsonFile<ModelMapping>(MODEL_MAPPING_FILE_NAME, {});
}

export function saveModelMapping(mapping: ModelMapping): void {
  writeJsonFile(MODEL_MAPPING_FILE_NAME, mapping);
  debug(
    'wakeup-store',
    `Save model mapping (${Object.keys(mapping).length} models)`,
  );
}

export function updateModelMapping(newMappings: ModelMapping): void {
  const existing = loadModelMapping();
  const merged = { ...existing, ...newMappings };
  saveModelMapping(merged);
}

export function getModelConstant(modelId: string): string | undefined {
  const mapping = loadModelMapping();
  return mapping[modelId];
}

export function getResetKey(modelId: string): string {
  return getModelConstant(modelId) || modelId;
}
