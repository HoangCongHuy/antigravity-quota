import { QuotaSnapshot } from "../quota/types";

export interface AllAccountsQuotaResult {
    email: string,
    isActive: boolean,
    status: 'success' | 'error' | 'cached',
    error?: string,
    snapshot ?: QuotaSnapshot,
    cacheAge?: number,
}