-- Reverts the field type change of 0036_single_choice_color.sql.
-- Listings keep the single color 0036 kept; extra colors are not restored.

UPDATE "category_fields"
SET "type" = 'multi-select', "updated_at" = now()
WHERE "field_key" = 'color'
  AND "type" = 'single-select';
