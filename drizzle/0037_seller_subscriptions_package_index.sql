-- Admin package detail (/admin/packages/[id]) lists the sellers assigned to a
-- package, filtered by status and expiry. seller_subscriptions had no index
-- on package_id. Additive and safe to re-run.
-- Not tracked in drizzle/meta/_journal.json; apply by hand after 0036.

CREATE INDEX IF NOT EXISTS "idx_seller_subscriptions_package"
  ON "seller_subscriptions" ("package_id", "status", "expires_at");
