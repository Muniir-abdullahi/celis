CREATE TABLE "auth_message_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_auth_message_deliveries_due" ON "auth_message_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_auth_message_deliveries_expiry" ON "auth_message_deliveries" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_auth_message_deliveries_retention" ON "auth_message_deliveries" USING btree ("updated_at");
--> statement-breakpoint
-- Authenticated mobile clients must not read or mutate the server-only outbox.
ALTER TABLE "auth_message_deliveries" ENABLE ROW LEVEL SECURITY;
