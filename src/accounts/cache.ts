import { debug } from '../core/logger';
import { QuotaSnapshot } from '../quota/types';
import { getCacheTTL } from './config';
import {
  deleteAccountCache,
  loadAccountCache,
  saveAccountCache,
} from './storage';
import { CachedQuota } from './types';

export function isCacheValid(email: string): boolean {
  const cache = loadAccountCache(email);

  if (!cache || !cache.data) {
    debug('cache', `No valid cache for ${email}`);
    return false;
  }

  const cachedAt = new Date(cache.cacheAt).getTime();
  const ttlMs = cache.ttl * 1000;
  const now = Date.now();

  const isValid = now - cachedAt < ttlMs;
  debug('cache', `Cache for ${email} is ${isValid ? 'valid' : 'stale'}`);
  return isValid;
}

export function getCacheAge(email: string): number | null {
  const cache = loadAccountCache(email);

  if (!cache) {
    return null;
  }

  const cachedAt = new Date(cache.cacheAt).getTime();
  return Math.floor((Date.now() - cachedAt) / 1000);
}

export function saveCache(email: string, data: QuotaSnapshot): void {
  const ttl = getCacheTTL();

  const cache: CachedQuota = {
    cacheAt: new Date().toISOString(),
    ttl,
    data,
  };

  saveAccountCache(email, cache);
  debug('cache', `Cached quota for ${email}, TTL: ${ttl}s`);
}

export function loadCache(email: string): QuotaSnapshot | null {
  const cache = loadAccountCache(email);
  return cache?.data || null;
}

export function loadCacheWithMeta(email: string): CachedQuota | null {
  return loadAccountCache(email);
}

export function invalidateCache(email: string): void {
  deleteAccountCache(email);
  debug('cache', `Invalidated cache for ${email}`);
}
