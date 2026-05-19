import { describe, it, expect } from 'vitest';
import { AdjustStockDto } from '@/server/modules/stock/dto';
import { CreateItemDto } from '@/server/modules/items/dto';

describe('AdjustStockDto', () => {
  it('rejects delta=0', () => {
    const result = AdjustStockDto.safeParse({
      itemId: '00000000-0000-0000-0000-000000000001',
      delta: 0,
      reason: 'CONSUMPTION',
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('at least');
  });

  it('rejects subnormal delta (5e-324)', () => {
    const result = AdjustStockDto.safeParse({
      itemId: '00000000-0000-0000-0000-000000000001',
      delta: 5e-324,
      reason: 'CONSUMPTION',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid adjustment', () => {
    const result = AdjustStockDto.safeParse({
      itemId: '00000000-0000-0000-0000-000000000001',
      delta: -3,
      reason: 'DAMAGE',
      note: 'screen cracked',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid reason', () => {
    const result = AdjustStockDto.safeParse({
      itemId: '00000000-0000-0000-0000-000000000001',
      delta: 1,
      reason: 'INVALID_REASON',
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateItemDto', () => {
  const base = {
    name: 'Test Laptop',
    unitOfMeasure: 'pcs',
    categoryId: '00000000-0000-0000-0000-000000000001',
  };

  it('accepts minimal valid item', () => {
    expect(CreateItemDto.safeParse(base).success).toBe(true);
  });

  it('rejects negative currentStock', () => {
    expect(CreateItemDto.safeParse({ ...base, currentStock: -1 }).success).toBe(false);
  });

  it('rejects invalid categoryId', () => {
    expect(CreateItemDto.safeParse({ ...base, categoryId: 'not-a-uuid' }).success).toBe(false);
  });
});
