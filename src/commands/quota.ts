import { QuotaMethod } from '../quota/service';

interface QuotaOptions {
  json?: boolean;
  method?: QuotaMethod;
  all?: boolean;
  account?: string;
  refresh?: boolean;
}

export async function quotaCommand(options: QuotaOptions) {}
