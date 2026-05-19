import { describe, it, expect } from 'vitest';
import { deriveStockState } from '@/server/modules/items/domain';

describe('deriveStockState', () => {
  it.each([
    [0,  5, 'OUT'],
    [-1, 5, 'OUT'],
    [3,  5, 'LOW'],
    [4,  5, 'LOW'],
    [5,  5, 'HEALTHY'],
    [10, 5, 'HEALTHY'],
    [0,  0, 'OUT'],
    [1,  0, 'HEALTHY'],
  ] as const)('stock=%s threshold=%s → %s', (stock, threshold, expected) => {
    expect(deriveStockState(stock, threshold)).toBe(expected);
  });
});
