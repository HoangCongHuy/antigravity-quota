export interface WakeupConfig {
  enabled: boolean;
  selectedModels: string[];
  selectedAccounts?: string[];
  customPrompt?: string;
  maxOutputTokens: number;
  scheduleMode: ScheduleMode;
  intervalHours?: number;
  dailyTimes?: string[];
  weeklySchedule?: WeeklySchedule;
  cronExpression?: string;
  wakeOnReset: boolean;
  resetCooldownMinutes: number;
}

export interface WeeklySchedule {
  [day: number]: string[];
}

export type ScheduleMode = 'interval' | 'daily' | 'weekly' | 'custom';

export function getDefaultConfig(): WakeupConfig {
  return {
    enabled: false,
    selectedModels: ['claude-sonnet-4-5', 'gemini-3-flash', 'gemini-3-pro-low'],
    selectedAccounts: undefined,
    customPrompt: undefined,
    maxOutputTokens: 1, // Minimal tokens to save quota
    scheduleMode: 'interval',
    intervalHours: 6,
    dailyTimes: ['09:00'],
    weeklySchedule: {},
    cronExpression: undefined,
    wakeOnReset: false,
    resetCooldownMinutes: 10,
  };
}

export type TriggerType = 'manual' | 'auto';
export type TriggerSource = 'manual' | 'scheduled' | 'quota_reset';

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface TriggerRecord {
  timestamp: string;
  success: boolean;
  triggerType: TriggerType;
  triggerSource: TriggerSource;
  models: string[];
  accountEmails: string;
  durationMs: number;
  prompt: string;
  response?: string;
  error?: string;
  tokenUsed?: TokenUsage;
}

export interface ModelResetState {
  lastResetAt: string;
  lastTriggeredTime: string;
}

export interface ResetState {
  [modelResetKey: string]: ModelResetState;
}

export interface ModelMapping {
  [modelId: string]: string;
}

export interface TriggerOptions {
  models: string[];
  accountEmail: string;
  triggerType: TriggerType;
  triggerSource: TriggerSource;
  customPrompt?: string;
  maxOutputTokens?: number;
}

export interface ModelTriggerResult {
  modelId: string;
  success: boolean;
  durationMs: number;
  response?: string;
  error?: string;
  tokenUsed?: TokenUsage;
}

export interface TriggerResult {
  success: boolean;
  results: ModelTriggerResult[];
}

export interface CronInstallResult {
  success: boolean;
  cronExpression?: string;
  manualInstructions?: string;
  error?: string;
}

export interface CronStatus {
  installed: boolean;
  cronExpression?: string;
  nextRun?: string;
}

export interface DetectionResult {
  triggered: boolean;
  triggeredModels: string[];
}
