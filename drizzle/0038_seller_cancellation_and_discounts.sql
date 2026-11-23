CREATE TABLE "seller_package_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_package_usages_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "listing_discount_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tier_key" text NOT NULL,
	"tier_label" text NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"listing_limit" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_package_values" CHECK ("listing_discount_packages"."value" >= 0 AND "listing_discount_packages"."listing_limit" > 0 AND "listing_discount_packages"."duration_days" > 0 AND ("listing_discount_packages"."type" = 'fixed' OR ("listing_discount_packages"."type" = 'percentage' AND "listing_discount_packages"."value" <= 10000)))
);
--> statement-breakpoint
CREATE TABLE "listing_fee_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"assignment_id" uuid,
	"regular_fee_cents" integer NOT NULL,
	"discount_cents" integer NOT NULL,
	"final_fee_cents" integer NOT NULL,
	"request_key" text NOT NULL,
	"payment_key" text NOT NULL,
	"merchant_ref" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_fee_checkouts_listing_id_unique" UNIQUE("listing_id"),
	CONSTRAINT "listing_fee_checkouts_payment_key_unique" UNIQUE("payment_key"),
	CONSTRAINT "discount_checkout_amounts" CHECK ("listing_fee_checkouts"."regular_fee_cents" >= 0 AND "listing_fee_checkouts"."discount_cents" >= 0 AND "listing_fee_checkouts"."final_fee_cents" >= 0 AND "listing_fee_checkouts"."regular_fee_cents" = "listing_fee_checkouts"."discount_cents" + "listing_fee_checkouts"."final_fee_cents")
);
--> statement-breakpoint
CREATE TABLE "seller_discount_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"tier_key" text NOT NULL,
	"terms" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_by" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancellation_notes" text
);
--> statement-breakpoint
ALTER TABLE "seller_subscriptions" ADD COLUMN "listings_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_subscriptions" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "seller_subscriptions" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_subscriptions" ADD COLUMN "cancellation_reason" varchar(40);--> statement-breakpoint
ALTER TABLE "seller_subscriptions" ADD COLUMN "cancellation_notes" varchar(500);--> statement-breakpoint
ALTER TABLE "seller_package_usages" ADD CONSTRAINT "seller_package_usages_subscription_id_seller_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."seller_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_fee_checkouts" ADD CONSTRAINT "listing_fee_checkouts_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_fee_checkouts" ADD CONSTRAINT "listing_fee_checkouts_assignment_id_seller_discount_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."seller_discount_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_discount_assignments" ADD CONSTRAINT "seller_discount_assignments_package_id_listing_discount_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."listing_discount_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_discount_assignments" ADD CONSTRAINT "seller_discount_assignments_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_discount_assignments" ADD CONSTRAINT "seller_discount_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_discount_assignments" ADD CONSTRAINT "seller_discount_assignments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_checkout_usage" ON "listing_fee_checkouts" USING btree ("assignment_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_seller_discount_tier" ON "seller_discount_assignments" USING btree ("seller_id","tier_key") WHERE "seller_discount_assignments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "discount_assignment_package_status" ON "seller_discount_assignments" USING btree ("package_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "discount_assignment_seller" ON "seller_discount_assignments" USING btree ("seller_id","tier_key","expires_at");--> statement-breakpoint
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

--> statement-breakpoint
-- Preserve the former eligibility count at cutover; future usage is assignment-bound.
UPDATE seller_subscriptions s SET listings_used = (SELECT count(*) FROM listings l WHERE l.seller_id = s.seller_id AND l.created_at >= s.started_at AND l.status IN ('active','pending_review','sold'));
--> statement-breakpoint
INSERT INTO seller_package_usages (subscription_id, listing_id) SELECT DISTINCT ON (l.id) s.id, l.id FROM listings l JOIN seller_subscriptions s ON s.seller_id = l.seller_id AND l.created_at >= s.started_at WHERE l.status IN ('active','pending_review','sold') ORDER BY l.id, s.started_at DESC ON CONFLICT (listing_id) DO NOTHING;

--> statement-breakpoint
ALTER TABLE "seller_package_usages" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "listing_discount_packages" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "seller_discount_assignments" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "listing_fee_checkouts" ENABLE ROW LEVEL SECURITY;
