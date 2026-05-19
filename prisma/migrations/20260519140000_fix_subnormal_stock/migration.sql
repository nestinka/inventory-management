-- Fix subnormal / near-zero float values in current_stock that resulted from
-- stock adjustments where delta was a subnormal IEEE-754 number (e.g. 5e-324).
-- Any currentStock that is positive but less than 0.5 (our minimum step) is
-- effectively 0 and should be stored as exactly 0.
UPDATE "items"
SET   "current_stock" = 0
WHERE "current_stock" > 0
  AND "current_stock" < 0.5;
