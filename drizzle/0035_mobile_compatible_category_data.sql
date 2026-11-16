-- Keep shared category data compatible with the mobile app (D:\celis mobile),
-- which reads the same rows directly. Idempotent and safe to run whether or
-- not an earlier draft of 0034 / the field seed was applied.
--
-- 1. Conditional fields must not use validation_rules.required: the mobile
--    form validates it on every field, hidden ones included, which blocked
--    mobile sellers who answered "No" to "Warranty available?". Move it to
--    the web-only key requiredWhenVisible.
-- 2. Mobile shows a conditional field only when the parent value equals
--    parent_value exactly, so comma-separated "any of" lists (an earlier seed
--    draft gated Battery Health this way) hid the field on mobile forever.
--    Remove those conditions; the field becomes always shown (optional).
-- 3. Listing metadata written by older web code used JSON arrays for
--    multi-select and true/false for booleans. Mobile and its RPC use
--    comma-joined strings and "yes"/"no". Rewrite those values in place; the
--    web reads both shapes, so this changes nothing on the web.
--
-- Not tracked in drizzle/meta/_journal.json; apply by hand after 0034.
-- Revert with 0035_mobile_compatible_category_data.down.sql (steps 1-2 only;
-- step 3 is a lossless format change and is not reverted).

UPDATE "category_fields"
SET
  "validation_rules" = ("validation_rules" - 'required')
    || jsonb_build_object('requiredWhenVisible', true),
  "updated_at" = now()
WHERE "parent_field_id" IS NOT NULL
  AND ("validation_rules" ->> 'required') = 'true';
--> statement-breakpoint

UPDATE "category_fields"
SET
  "parent_field_id" = NULL,
  "parent_value" = NULL,
  "updated_at" = now()
WHERE "parent_value" LIKE '%,%';
--> statement-breakpoint

-- Arrays of strings → "a,b"; booleans → "yes"/"no". Other values untouched.
UPDATE "listings" AS l
SET "metadata" = converted.metadata
FROM (
  SELECT
    li."id",
    jsonb_object_agg(
      kv.key,
      CASE
        WHEN jsonb_typeof(kv.value) = 'array' THEN to_jsonb(
          (SELECT string_agg(elem, ',') FROM jsonb_array_elements_text(kv.value) AS elem)
        )
        WHEN jsonb_typeof(kv.value) = 'boolean' THEN
          to_jsonb(CASE WHEN kv.value = 'true'::jsonb THEN 'yes' ELSE 'no' END)
        ELSE kv.value
      END
    ) AS metadata
  FROM "listings" AS li
  CROSS JOIN LATERAL jsonb_each(li."metadata") AS kv
  WHERE jsonb_typeof(li."metadata") = 'object'
    AND EXISTS (
      SELECT 1 FROM jsonb_each(li."metadata") AS x
      WHERE jsonb_typeof(x.value) IN ('array', 'boolean')
    )
  GROUP BY li."id"
) AS converted
WHERE l."id" = converted."id";
