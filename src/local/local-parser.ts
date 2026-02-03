import { debug } from '../core/logger';
import {
  ModelQuotaInfo,
  PromptCreditsInfo,
  QuotaSnapshot,
} from '../quota/types';
import { ConnectUserStatus } from './connect-client';

export function parseLocalQuotaSnapshot(
  userStatus: ConnectUserStatus,
): QuotaSnapshot {
  debug('local-parser', 'Parsing local user status into QuotaSnapshot');

  const snapshot: QuotaSnapshot = {
    timestamp: new Date().toISOString(),
    method: 'local',
    email: userStatus.email,
    models: [],
  };

  if (userStatus.quota?.promptCredits) {
    snapshot.promptCredits = parsePromptCredits(userStatus.quota.promptCredits);
  }

  if (userStatus.quota?.models) {
    snapshot.models = userStatus.quota.models.map(parseModelQuota);
  }

  debug('local-parser', `Parsed ${snapshot.models.length} models`);
  return snapshot;
}

function parsePromptCredits(
  credits: NonNullable<ConnectUserStatus['quota']>['promptCredits'],
): PromptCreditsInfo | undefined {
  if (!credits) {
    return undefined;
  }

  const limit = credits.limit ?? 0;
  const remaining = credits.remaining ?? 0;
  const used = credits.used ?? limit - remaining;

  const usedPercentage = limit > 0 ? used / limit : 0;
  const remainingPercentage = limit > 0 ? remaining / limit : 1;

  return {
    available: remaining,
    monthly: limit,
    usedPercentage,
    remainingPercentage,
  };
}

function parseModelQuota(
  model: NonNullable<NonNullable<ConnectUserStatus['quota']>['models']>[number],
): ModelQuotaInfo {
  const quota = model.quota;

  return {
    label: model.label || model.displayName || model.modelId,
    modelId: model.modelId,
    remainingPercentage: quota?.remainingPercentage,
    isExhausted: model.isExhausted ?? quota?.remainingPercentage === 0,
    resetTime: quota?.resetTime,
    timeUntilResetMs: quota?.timeUntilResetMs,
  };
}
