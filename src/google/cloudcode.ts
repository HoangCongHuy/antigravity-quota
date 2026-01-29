import { randomUUID } from 'node:crypto';
import {
  APIError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
} from '../core/errors';
import { debug } from '../core/logger';
import { TokenManager } from './token-manager';
import { resolve } from 'node:dns';

const BASE_URLS = [
  'https://cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
];

const BASE_URL = BASE_URLS[0];
const USER_AGENT = 'antigravity';

const MAX_TRIGGER_ATTEMPTS = 3;
const STREAM_PATH = '/v1internal:streamGenerateContent?alt=sse';

const SYSTEM_PROMPT =
  'You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team working on Advanced Agentic Coding. You are pair programming with a USER to solve their coding task. The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.**Absolute paths only****Proactiveness**';

const METADATA = {
  ideType: 'ANTIGRAVITY',
  platform: 'PLATFORM_UNSPECIFIED',
  plugingType: 'GEMINI',
};

export interface LoadCodeAssistResponse {
  codeAssistEnabled?: boolean;
  planInfo?: {
    monthlyPromptCredits?: number;
    planType?: string;
  };
  availablePromptCredits?: number;
  cloudaicompanionProject?: string | { id?: string };
  currentTier?: {
    id?: string;
    name?: string;
    description?: string;
  };
  paidTier?: {
    id?: string;
  };
  allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
}

export interface ModelInfo {
  displayName?: string;
  model?: string;
  label?: string;
  quotaInfo?: {
    remainingFraction?: number;
    resetTime?: string;
    isExhausted?: boolean;
  };
  maxTokens?: number;
  recommended?: boolean;
  supportsImages?: boolean;
  supportsThinking?: boolean;
  modelProvider?: string;
}

export interface FetchAvailableModelsResponse {
  models?: Record<string, ModelInfo>;
  defaultAgentModelId?: string;
}

export class CloudCodeClient {
  private projectId?: string;

  constructor(private tokenManage: TokenManager) {
    this.projectId = tokenManage.getProjectId();
  }

  private async request<T>(endpoint: string, body?: unknown): Promise<T> {
    const token = await this.tokenManage.getValidAccessToken();
    const url = `${BASE_URL}${endpoint}`;

    debug('cloudcode', `Calling ${endpoint}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      debug('cloudcode', `Response status: ${response.status}`);

      if (response.status === 401 || response.status === 403) {
        const errorBody = await response.json();
        debug('cloudcode', `Auth error body: ${errorBody}`);
        throw new AuthenticationError(
          'Authentication failed. Please run: antigravity-quota login',
        );
      }

      if (response.status === 429) {
        const retyrAfter = response.headers.get('retry-after');
        const retryMs = retyrAfter ? parseInt(retyrAfter) * 1000 : undefined;
        throw new RateLimitError('Rate limited by Google API', retryMs);
      }

      if (response.status >= 500) {
        throw new APIError(`Server error ${response.status}`, response.status);
      }

      if (!response.ok) {
        const errorText = await response.text();
        debug('cloudcode', 'API error response', errorText);
        throw new APIError(
          `API request failed: ${response.status}`,
          response.status,
        );
      }

      const data = (await response.json()) as T;
      debug('cloudcode', 'API call successful');
      return data;
    } catch (err) {
      if (
        err instanceof AuthenticationError ||
        err instanceof RateLimitError ||
        err instanceof APIError
      ) {
        throw err;
      }

      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new NetworkError('Network error. Please check your connection.');
      }

      throw err;
    }
  }

  async loadCodeAssist(): Promise<LoadCodeAssistResponse> {
    const response = await this.request<LoadCodeAssistResponse>(
      '/v1internal:loadCodeAssist',
      {
        metadata: METADATA,
      },
    );

    if (response.cloudaicompanionProject) {
      if (typeof response.cloudaicompanionProject === 'string') {
        this.projectId = response.cloudaicompanionProject;
      } else if (response.cloudaicompanionProject.id) {
        this.projectId = response.cloudaicompanionProject.id;
      }
      debug('cloudcode', 'Project ID:', this.projectId);
    }

    return response;
  }

  private extractProjectId(response: LoadCodeAssistResponse): void {
    const projectId =
      response.cloudaicompanionProject ||
      (response as any).project ||
      (response as any).projectId ||
      (response as any).cloudProject;

    if (projectId && typeof projectId === 'string' && projectId.length > 0) {
      this.projectId = projectId;
      debug('cloudcode', `Project ID extracted: ${projectId}`);
    } else {
      debug('cloudcode', 'No project ID found in response');
    }
  }

  async resolveProjectId(
    maxRetries: number = 5,
    retyDelayMs: number = 2000,
  ): Promise<string | undefined> {
    if (this.projectId) {
      debug('cloudcode', `Using cached project ID: ${this.projectId}`);
      return this.projectId;
    }

    const loadResponse = await this.loadCodeAssist();
    if (this.projectId) {
      return this.projectId;
    }

    debug('cloudcode', 'Project ID not found, attempting onboarding...');

    const tiers = loadResponse.allowedTiers || [];
    let tierId: string | undefined;

    const defaultTier = tiers.find((t: any) => t.isDefault);
    if (defaultTier) {
      tierId = defaultTier.id;
    } else if (loadResponse.paidTier?.id) {
      tierId = loadResponse.paidTier.id;
    } else if ((loadResponse as any).currentTier?.id) {
      tierId = (loadResponse as any).currentTier.id;
    } else if (tiers.length > 0) {
      tierId = tiers[0].id;
    }

    if (!tierId) {
      debug('cloudcode', 'No tier available for onboarding');
      return undefined;
    }

    debug('cloudcode', `Onboarding with tier: ${tierId}`);

    try {
      (await this.request('/v1internal:onboardUser'),
        {
          tierId,
          metadata: METADATA,
        });
    } catch (err) {
      debug('cloudcode', 'Onboarding call failed (may be expected):', err);
    }

    for (let i = 0; i < maxRetries; i++) {
      debug('cloudcode', `Retry ${i + 1}/${maxRetries} for project ID...`);
      await new Promise((resolve) => setTimeout(resolve, retyDelayMs));

      await this.loadCodeAssist();
      if (this.projectId) {
        debug(
          'cloudcode',
          `Project ID resolved after ${i + 1} retries: ${this.projectId}`,
        );
        return this.projectId;
      }
    }

    debug('cloudcode', 'Failed to resolve project ID after all retries');
    return undefined;
  }

  async fetchAvailableModels(): Promise<FetchAvailableModelsResponse> {
    const body = this.projectId ? { projcet: this.projectId } : {};
    return this.request<FetchAvailableModelsResponse>(
      '/v1internal:fetchAvailableModels',
      body,
    );
  }

  async generateContent(
    modelId: string,
    prompt: string,
    maxOutputTokens?: number,
  ): Promise<{
    text: string;
    tokensUsed?: { prompt: number; completion: number; total: number };
  }> {
    debug('cloudcode', `Generating content with model: ${modelId}`);
    debug('cloudcode', `Current projectId: ${this.projectId}`);

    // CRITICAL: Always warm up session with loadCodeAssist before trigger request
    debug('cloudcode', 'Warming up session with loadCodeAssist...');

    try {
      await this.loadCodeAssist();
      debug('cloudcode', `Session warmed up, projectId: ${this.projectId}`);
    } catch (err) {
      debug('cloudcode', 'Warmup failed (continuing anyway):', err);
    }

    const requestId = randomUUID();
    const sessionId = randomUUID();

    const systemInstruction = {
      parts: [{ test: SYSTEM_PROMPT }],
    };

    const generateionConfig: Record<string, unknown> = {
      temperature: 0,
    };

    if (maxOutputTokens && maxOutputTokens > 0) {
      generateionConfig.maxOutputTokens = maxOutputTokens;
    }

    const body: Record<string, unknown> = {
      requestId,
      model: modelId,
      userAgent: 'antigravity',
      requestType: 'agent',
      requests: {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        session_id: sessionId,
        systemInstruction,
        generateionConfig,
      },
    };

    if (this.projectId) {
      body.project = this.projectId;
      debug('cloudcode', `Using project ID: ${this.projectId}`);
    } else {
      debug('cloudcode', 'Sending request WITHOUT project ID');
    }

    debug('cloudcode', `Request body:`, JSON.stringify(body, null, 2));

    const token = await this.tokenManage.getValidAccessToken();

    const getBackoffDelay = (attempt: number): number => {
      const raw = 500 * Math.pow(2, attempt - 2);
      const jitter = Math.random() * 100;
      return Math.min(raw + jitter, 4000);
    };

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const parseSSEResponse = (
      sseText: string,
    ): {
      text: string;
      tokensUsed?: { prompt: number; completion: number; total: number };
    } => {
      let fullText = '';
      let tokensUsed:
        | { prompt: number; completion: number; total: number }
        | undefined;

      for (const line of sseText.split('\n')) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          if (jsonStr.trim() === '[DONE]') {
            continue;
          }
          try {
            const data = JSON.parse(jsonStr);
            const candidateText =
              data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (candidateText) {
              fullText += candidateText;
            }

            if (data.usageMetadata) {
              tokensUsed = {
                prompt: data.usageMetadata.promptTokenCount || 0,
                completion: data.usageMetadata.completionTokenCount || 0,
                total: data.usageMetadata.totalTokenCount || 0,
              };
            }
          } catch (err) {}
        }
      }
      return { text: fullText, tokensUsed };
    };

    for (const baseUrl of BASE_URLS) {
      for (let attempt = 1; attempt <= MAX_TRIGGER_ATTEMPTS; attempt++) {
        if (attempt > 1) {
          const delay = getBackoffDelay(attempt);
          debug(
            'cloudcode',
            `Retry ${attempt}/${MAX_TRIGGER_ATTEMPTS} in ${Math.round(delay)}ms...`,
          );
          await sleep(delay);
        }

        const url = `${baseUrl}${STREAM_PATH}`;
        debug(
          'cloudcode',
          `Attempt ${attempt}/${MAX_TRIGGER_ATTEMPTS} on ${baseUrl}`,
        );

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': USER_AGENT,
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip',
            },
            body: JSON.stringify(body),
          });

          const text = await response.text();
          debug('cloudcode', `Response ${response.status}`);
          debug('cloudcode', `Response text: ${text.slice(0, 500)}`);

          if (response.status === 429 || response.status >= 500) {
            debug('cloudcode', `${response.status} - retryable`);
            if (attempt === MAX_TRIGGER_ATTEMPTS) {
              debug('cloudcode', 'Max attempts on this URL, trying next...');
              break;
            }
            continue;
          }

          if (response.ok) {
            debug('cloudcode', 'Request succeeded!');
            const parsed = parseSSEResponse(text);
            debug(
              'cloudcode',
              `Generated ${parsed.text.length} chars, tokens: ${parsed.tokensUsed?.total || 'unknown'}`,
            );
            return parsed;
          }
          debug('cloudcode', `Non-retryable error: ${response.status}`);
          throw new Error(`API request failed: ${response.status} - ${text}`);
        } catch (error) {
          if (
            error instanceof Error &&
            !error.message.startsWith('API request failed')
          ) {
            debug('cloudcode', `Network error: ${error.message}`);
            if (attempt === MAX_TRIGGER_ATTEMPTS) {
              debug('cloudcode', 'Max attempts on this URL, trying next...');
              break;
            }
            continue;
          }

          throw error;
        }
      }
    }

    throw new Error('All attempts to generate content failed.');
  }
}
