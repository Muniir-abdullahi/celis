-- Reverts 0034_conditional_warranty_fields.sql.
-- warranty_months values that 0034 rounded to whole numbers stay rounded.

UPDATE "listings"
SET "metadata" = "metadata" - 'warranty_available'
WHERE "metadata" ? 'warranty_available';
--> statement-breakpoint

UPDATE "category_fields"
SET
  "label" = 'Warranty (months)',
  "help_text" = NULL,
  "parent_field_id" = NULL,
  "parent_value" = NULL,
  "min_value" = NULL,
  "max_value" = NULL,
  "validation_rules" = COALESCE("validation_rules", '{}'::jsonb)
    - 'required' - 'integer' - 'min' - 'max',
  "updated_at" = now()
WHERE "field_key" = 'warranty_months';
--> statement-breakpoint

-- Options cascade with the field.
DELETE FROM "category_fields" WHERE "field_key" = 'warranty_available';
