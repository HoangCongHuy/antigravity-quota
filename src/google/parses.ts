import { debug } from '../core/logger';
import {
  ModelQuotaInfo,
  PromptCreditsInfo,
  QuotaSnapshot,
} from '../quota/types';
import {
  FetchAvailableModelsResponse,
  LoadCodeAssistResponse,
  ModelInfo,
} from './cloudcode';

function parseResetTime(resetTime?: string): number | undefined {
  if (!resetTime) {
    return undefined;
  }

  try {
    const resetDate = new Date(resetTime);
    const now = Date.now();
    const diff = resetDate.getTime() - now;

    return diff > 0 ? diff : undefined;
  } catch (err) {
    return undefined;
  }
}

function parseModelInfo(modelId: string, model: ModelInfo): ModelQuotaInfo {
  const quotaInfo = model.quotaInfo;

  return {
    label: model.displayName || model.label || modelId,
    modelId,
    remainingPercentage: quotaInfo?.remainingFraction,
    isExhausted: quotaInfo?.isExhausted ?? quotaInfo?.remainingFraction === 0,
    resetTime: quotaInfo?.resetTime,
    timeUntilResetMs: parseResetTime(quotaInfo?.resetTime),
  };
}

function parsePromptCredits(
  response: LoadCodeAssistResponse,
): PromptCreditsInfo | undefined {
  const monthly = response.planInfo?.monthlyPromptCredits;
  const available = response.availablePromptCredits;

  if (monthly === undefined || available === undefined) {
    return undefined;
  }

  const used = monthly - available;
  const usedPercentage = monthly > 0 ? used / monthly : 0;
  const remainingPercentage = monthly > 0 ? available / monthly : 0;

  return {
    available,
    monthly,
    usedPercentage,
    remainingPercentage,
  };
}

function shouldShowModel(modelId: string, model: ModelInfo): boolean {
  if (modelId.startsWith('chat_') || modelId.startsWith('tab_')) {
    return false;
  }

  if (modelId.includes('image')) {
    return false;
  }

  if (modelId.startsWith('rev')) {
    return false;
  }

  if (modelId.includes('mquery') || modelId.includes('lite')) {
    return false;
  }

  if (!model.quotaInfo) {
    return false;
  }

  return true;
}

export function parseQuotaSnapshot(
  codeAssistResponse: LoadCodeAssistResponse,
  modelsResponse: FetchAvailableModelsResponse,
  email?: string,
): QuotaSnapshot {
  debug('parser', 'Parsing quota snapshot');

  const promptCredits = parsePromptCredits(codeAssistResponse);
  const planType = codeAssistResponse.planInfo?.planType;

  const modelsMap = modelsResponse.models || {};
  const models: ModelQuotaInfo[] = [];

  for (const [modelId, modelInfo] of Object.entries(modelsMap)) {
    if (shouldShowModel(modelId, modelInfo)) {
      models.push(parseModelInfo(modelId, modelInfo));
    }
  }

  models.sort((a, b) => a.label.localeCompare(b.label));
  debug('parser', `Parsed ${models.length} models`);
  return {
    timestamp: new Date().toISOString(),
    method: 'google',
    email,
    planType,
    promptCredits,
    models,
  };
}
