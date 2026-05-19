import type { ItemStatus } from '@prisma/client';

export type { ItemStatus };

export type StockState = 'HEALTHY' | 'LOW' | 'OUT';

export type Item = {
  id: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  categoryId: string;
  currentStock: number;
  reorderThreshold: number;
  expiryDate: Date | null;
  status: ItemStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export function deriveStockState(currentStock: number, reorderThreshold: number): StockState {
  if (currentStock <= 0) return 'OUT';
  if (currentStock < reorderThreshold) return 'LOW';
  return 'HEALTHY';
}
