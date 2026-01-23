const OAUTH_CONFIG = {
  clientId:
    process.env.ANTIGRAVITY_OAUTH_CLIENT_ID ||
    '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
  clientSecret:
    process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET ||
    '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',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

const CLOUDCODE_CONFIG = {
  baseUrl: 'https://cloudcode-pa.googleapis.com',
  userAgent: 'antigravity',
  metadata: {
    ideType: 'ANTIGRAVITY',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  },
  onboardAttempts: 5,
  onboardDelayMs: 2000,
};

interface OAuthOptions {
  noBrowser?: boolean;
  port?: number;
}

interface OAuthResult {
  success: boolean;
  email?: string;
  error?: string;
}

interface LoadCodeAssisResponse {
  cloudaicompanionProject?: string | { id?: string };
  paidTier?: { id?: string };
  currentTier?: { id?: string };
  allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
}

interface OnboardUserResponse {
  done?: boolean;
  response?: {
    cloudaicompanionProject?: string | { id?: string };
  };
}

interface ProjectIdResult {
  projectId?: string;
  tierId?: string;
}

function generateState(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
