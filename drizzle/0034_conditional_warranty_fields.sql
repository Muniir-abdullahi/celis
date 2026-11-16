-- Issue 02: conditional warranty fields.
--
-- For every category that has a `warranty_months` field:
--   1. add a "Warranty available?" (yes / no) parent field;
--   2. make `warranty_months` a conditional child shown only when the parent
--      is "yes", as a whole number from 1 to 120.
--   3. backfill existing listings so their saved warranty still displays.
--
-- "Required when visible" is stored in validation_rules.requiredWhenVisible —
-- NOT the `required` column and NOT validation_rules.required. The mobile app
-- validates both of those on every field, hidden conditional ones included,
-- so either would block mobile sellers who answer "No". Only the web reads
-- requiredWhenVisible. min/max/integer are only checked when a value exists,
-- so they are safe for both apps. (An earlier draft used
-- validation_rules.required; 0035 repairs databases that applied it.)
--
-- Non-destructive: no listing values are removed. Not tracked in
-- drizzle/meta/_journal.json; apply by hand like 0032/0033.
-- Revert with 0034_conditional_warranty_fields.down.sql.

INSERT INTO "category_fields" (
  "category_id", "field_key", "label", "type", "help_text", "required",
  "searchable", "is_filter", "sort_order", "is_active", "applies_to_descendants"
)
SELECT
  cf."category_id",
  'warranty_available',
  'Warranty available?',
  'single-select',
  'Choose Yes only if the item comes with a seller or manufacturer warranty.',
  false,
  false,
  false,
  cf."sort_order",
  true,
  cf."applies_to_descendants"
FROM "category_fields" cf
WHERE cf."field_key" = 'warranty_months'
ON CONFLICT ("category_id", "field_key") DO NOTHING;
--> statement-breakpoint

INSERT INTO "category_field_options" ("category_field_id", "value", "label", "sort_order")
SELECT f."id", v."value", v."label", v."sort_order"
FROM "category_fields" f
CROSS JOIN (VALUES ('yes', 'Yes', 0), ('no', 'No', 1)) AS v("value", "label", "sort_order")
WHERE f."field_key" = 'warranty_available'
ON CONFLICT ("category_field_id", "value") DO NOTHING;
--> statement-breakpoint

UPDATE "category_fields" AS m
SET
  "label" = 'Warranty duration (months)',
  "help_text" = 'Whole number of months, for example 12.',
  "parent_field_id" = p."id",
  "parent_value" = 'yes',
  "min_value" = 1,
  "max_value" = 120,
  "validation_rules" = COALESCE(m."validation_rules", '{}'::jsonb)
    || '{"requiredWhenVisible": true, "integer": true, "min": 1, "max": 120}'::jsonb,
  "updated_at" = now()
FROM "category_fields" AS p
WHERE m."field_key" = 'warranty_months'
  AND p."field_key" = 'warranty_available'
  AND p."category_id" = m."category_id";
--> statement-breakpoint

-- Backfill listings that saved a warranty before it became conditional.
-- A positive value → warranty_available = "yes" and the duration stored as a
-- whole number ("012" / "12.0" → 12). A zero → "no"; the zero itself is kept
-- (hidden because the parent is "no"), so the down migration loses nothing.
-- Non-numeric values are left untouched. The CASE guarantees the numeric cast
-- only runs on values that passed the format check.
WITH parsed AS (
  SELECT
    "id",
    CASE
      WHEN ("metadata" ->> 'warranty_months') ~ '^\s*[0-9]{1,6}(\.[0-9]+)?\s*$'
        THEN round(btrim("metadata" ->> 'warranty_months')::numeric)::int
    END AS months
  FROM "listings"
  WHERE "metadata" ? 'warranty_months'
    AND NOT "metadata" ? 'warranty_available'
)
UPDATE "listings" AS l
SET "metadata" = l."metadata"
  || jsonb_build_object(
       'warranty_available',
       CASE WHEN parsed.months > 0 THEN 'yes' ELSE 'no' END
     )
  || CASE
       WHEN parsed.months > 0 THEN jsonb_build_object('warranty_months', parsed.months)
       ELSE '{}'::jsonb
     END
FROM parsed
WHERE l."id" = parsed."id"
  AND parsed.months IS NOT NULL;
