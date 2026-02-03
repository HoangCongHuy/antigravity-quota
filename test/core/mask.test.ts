import { describe, expect, it } from 'vitest';
import { maskEmail, maskToken } from '../../src/core/mask';

describe('maskToken', () => {
  it('should mask a long token', () => {
    const token = 'abc123xyz789secret1234567890';
    const masked = maskToken(token);
    expect(masked).toBe('abc123...7890');
  });

  it('should handle short tokens', () => {
    const token = 'abc';
    const masked = maskToken(token);
    expect(masked).toBe('***');
  });

  it('should handle exactly 10 char tokens', () => {
    const token = '1234567890';
    const masked = maskToken(token);
    expect(masked).toBe('***');
  });

  it('should handle 11 char tokens', () => {
    const token = '12345678901';
    const masked = maskToken(token);
    expect(masked).toBe('123456...8901');
  });

  it('should return empty string for empty input', () => {
    expect(maskToken('')).toBe('');
  });
});

describe('maskEmail', () => {
  it('should mask a normal email', () => {
    const email = 'john.doe@example.com';
    const masked = maskEmail(email);
    expect(masked).toBe('jo**@example.com');
  });

  it('should handle short local parts', () => {
    const email = 'ab@example.com';
    const masked = maskEmail(email);
    // For local parts <= 2 chars, only show first char
    expect(masked).toBe('a**@example.com');
  });

  it('should handle single char local parts', () => {
    const email = 'a@example.com';
    const masked = maskEmail(email);
    expect(masked).toBe('a**@example.com');
  });

  it('should return original for invalid email', () => {
    const email = 'no-at-sign';
    const masked = maskEmail(email);
    expect(masked).toBe('no-at-sign');
  });

  it('should return empty string for empty input', () => {
    expect(maskEmail('')).toBe('');
  });
});
