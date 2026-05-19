-- AlterTable: change current_stock, delta, balance_after from integer to double precision (Float)
ALTER TABLE "items" ALTER COLUMN "current_stock" TYPE DOUBLE PRECISION;

ALTER TABLE "stock_adjustments" ALTER COLUMN "delta" TYPE DOUBLE PRECISION;
ALTER TABLE "stock_adjustments" ALTER COLUMN "balance_after" TYPE DOUBLE PRECISION;
