import { describe, it, expect } from 'vitest';
import { getConfigDir, getPlatform, getTokensPath } from '../../src/core/env';

describe('getPlatform', () => {
  it('should return a valid platform', () => {
    const platform = getPlatform();
    expect(['windows', 'mac', 'linux']).toContain(platform);
  });
});

describe('getConfigDir', () => {
  it('should return a non-empty path', () => {
    const configDir = getConfigDir();
    expect(configDir).toBeTruthy();
    expect(configDir.length).toBeGreaterThan(0);
  });

  it('should include antigravity-quota in path', () => {
    const configDir = getConfigDir();
    expect(configDir).toContain('antigravity-quota');
  });
});

describe('getTokensPath', () => {
  it('should return a path ending with tokens.json', () => {
    const tokensPath = getTokensPath();
    expect(tokensPath).toMatch(/tokens\.json$/);
  });
});
