-- Issue 01 (16 Nov 2026 IT report): Color is a single choice.
--
-- 1. Every `color` category field becomes `single-select` (was multi-select).
--    The category_fields sync trigger refreshes categories.metadata_schema, so
--    the web form and the mobile app both pick it up.
-- 2. Listings that saved several colors keep exactly one: the first value.
--    Handles both the shared comma format ("black,white") and older web JSON
--    arrays (["black","white"]).
--
-- Not tracked in drizzle/meta/_journal.json; apply by hand after 0035.
-- Revert the field type with 0036_single_choice_color.down.sql (the dropped
-- extra colors are not restored).

UPDATE "category_fields"
SET "type" = 'single-select', "updated_at" = now()
WHERE "field_key" = 'color'
  AND "type" = 'multi-select';
--> statement-breakpoint

UPDATE "listings"
SET "metadata" = jsonb_set(
  "metadata",
  '{color}',
  -- COALESCE: jsonb_set with a NULL value would null the whole metadata.
  to_jsonb(COALESCE(
    CASE
      WHEN jsonb_typeof("metadata" -> 'color') = 'array'
        THEN btrim("metadata" -> 'color' ->> 0)
      ELSE btrim(split_part("metadata" ->> 'color', ',', 1))
    END,
    ''
  ))
)
WHERE "metadata" ? 'color'
  AND (
    jsonb_typeof("metadata" -> 'color') = 'array'
    OR ("metadata" ->> 'color') LIKE '%,%'
  );
