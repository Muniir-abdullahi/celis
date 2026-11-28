CREATE TABLE "staff_departments" (
	"name" varchar(100) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_id" varchar(30);--> statement-breakpoint
-- Preserve existing department assignments before enforcing the managed list.
INSERT INTO "staff_departments" ("name") SELECT DISTINCT "department" FROM "users" WHERE "department" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_departments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_staff_departments_name_fk" FOREIGN KEY ("department") REFERENCES "public"."staff_departments"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_staff_id_unique" UNIQUE("staff_id");
--> statement-breakpoint
-- A sequence and trigger cover provisioning, role changes and existing staff.
-- This requires SQL because Drizzle cannot model conditional immutable identifiers.
CREATE SEQUENCE public.celis_staff_id_seq;
--> statement-breakpoint
CREATE FUNCTION public.assign_celis_staff_id() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE next_id text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.department IS DISTINCT FROM OLD.department
    AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Staff departments must be managed through an authorized server action';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.staff_id IS NOT NULL THEN
    IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
      RAISE EXCEPTION 'Staff IDs are permanent';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.is_internal OR NEW.is_super_admin OR NEW.role = 'admin' OR EXISTS (
    SELECT 1 FROM public.roles WHERE key = NEW.role AND domain = 'internal'
  ) THEN
    next_id := nextval('public.celis_staff_id_seq')::text;
    NEW.staff_id := 'CELIS-' || repeat('0', greatest(0, 6 - length(next_id))) || next_id;
  ELSE
    NEW.staff_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER celis_staff_identity BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.assign_celis_staff_id();
--> statement-breakpoint
UPDATE public.users SET staff_id = NULL WHERE is_internal OR is_super_admin OR role = 'admin'
  OR role IN (SELECT key FROM public.roles WHERE domain = 'internal');
