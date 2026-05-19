import { describe, it, expect } from 'vitest';
import { sanitizeDiff } from '@/server/lib/audit';

describe('sanitizeDiff', () => {
  it('redacts top-level sensitive keys', () => {
    const result = sanitizeDiff({ name: 'Alice', password: 'secret', passwordHash: '$2b$12$...' });
    expect(result).toEqual({ name: 'Alice', password: '[REDACTED]', passwordHash: '[REDACTED]' });
  });

  it('redacts nested sensitive keys', () => {
    const result = sanitizeDiff({ user: { email: 'a@b.com', token: 'tok' } });
    expect(result).toEqual({ user: { email: 'a@b.com', token: '[REDACTED]' } });
  });

  it('passes through benign fields', () => {
    const obj = { name: 'Widget A', currentStock: 5, reason: 'DAMAGE' };
    expect(sanitizeDiff(obj)).toEqual(obj);
  });

  it('handles arrays', () => {
    const result = sanitizeDiff([{ password: 'p' }, { name: 'n' }]);
    expect(result).toEqual([{ password: '[REDACTED]' }, { name: 'n' }]);
  });

  it('handles null and primitives', () => {
    expect(sanitizeDiff(null)).toBeNull();
    expect(sanitizeDiff(42)).toBe(42);
    expect(sanitizeDiff('str')).toBe('str');
  });
});
