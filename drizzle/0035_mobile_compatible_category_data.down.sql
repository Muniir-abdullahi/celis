-- Reverts step 1 of 0035 (requiredWhenVisible → validation_rules.required).
-- WARNING: this re-blocks mobile sellers on hidden conditional fields; only
-- use it together with reverting 0034.
-- Step 2 (removed comma-list conditions) cannot be restored automatically:
-- re-run the field seed if needed. Step 3 (metadata format) is lossless and
-- is intentionally not reverted.

UPDATE "category_fields"
SET
  "validation_rules" = ("validation_rules" - 'requiredWhenVisible')
    || jsonb_build_object('required', true),
  "updated_at" = now()
WHERE "parent_field_id" IS NOT NULL
  AND ("validation_rules" ->> 'requiredWhenVisible') = 'true';
