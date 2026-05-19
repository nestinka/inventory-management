-- Second pass: fix any subnormal / near-zero float values in current_stock that
-- were created after the first pass (20260519140000) while the code-level guard
-- was not yet in effect.  Same predicate: positive but below the minimum step.
UPDATE "items"
SET   "current_stock" = 0
WHERE "current_stock" > 0
  AND "current_stock" < 0.5;
