import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const testUrl = process.env.CELIS_TEST_DATABASE_URL;
if (!testUrl) throw new Error("Set CELIS_TEST_DATABASE_URL to the disposable localhost:55439 fixture.");
const target = new URL(testUrl);
if (target.hostname !== "127.0.0.1" || target.port !== "55439" || target.pathname !== "/postgres") throw new Error("Refusing a non-fixture database; this test resets fixture tables.");
process.env.DATABASE_URL = testUrl;
process.env.SUPABASE_URL = "http://127.0.0.1:55439";
process.env.SUPABASE_ANON_KEY = "test-only";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
process.env.NODE_ENV = "test";
process.env.DATABASE_POOL_SIZE = "2";
const { db } = await import("../../app/db");
const schema = await import("../../app/db/schema");
const { eq, and, count } = await import("drizzle-orm");
const { consumeSellerPackage, cancelSellerPackage } = await import("../../app/server/package-assignment.server");
const { saveDiscountPackage, assignDiscountPackage, cancelDiscountAssignment, setDiscountPackageActive } = await import("../../app/server/discount-packages.server");
const { payListingFee } = await import("../../app/server/listing-fee-checkout.server");
const { initiateWalletPayment } = await import("../../app/server/payments.server");
const { parseWaafiPurchaseResponse } = await import("../../app/lib/waafi");
const { getSellerListingPricing } = await import("../../app/server/seller-pricing.server");
const { updateSellerListing } = await import("../../app/server/listing-edit.server");
const sql = postgres(testUrl, { max: 1 });
let actorId: string;
let categoryId: string;
const authorize = async (permission: string) => {
  assert.equal(permission, "settings:manage");
  return { id: actorId, isSuperAdmin: true } as Awaited<ReturnType<typeof import("../../app/server/auth.server").requirePermission>>;
};
const forbidden = async () => { throw new Error("Forbidden"); };

before(async () => {
  // Reset only the hard-coded disposable fixture. Recreate the pre-migration state,
  // then run the shipped migration to exercise its SQL rather than just ORM push.
  await sql.unsafe('TRUNCATE TABLE "audit_logs", "seller_package_usages", "listing_fee_checkouts", "seller_discount_assignments", "listing_discount_packages", "seller_subscriptions", "listing_packages", "listings", "profiles", "users", "auth.users", "categories" CASCADE');
  await sql.unsafe('DROP TABLE seller_package_usages, listing_fee_checkouts, seller_discount_assignments, listing_discount_packages');
  await sql.unsafe('ALTER TABLE seller_subscriptions DROP COLUMN listings_used, DROP COLUMN cancelled_by, DROP COLUMN cancelled_at, DROP COLUMN cancellation_reason, DROP COLUMN cancellation_notes');
  const legacySeller = crypto.randomUUID(), legacyPackage = crypto.randomUUID(), legacySub = crypto.randomUUID(), legacyListing = crypto.randomUUID(), legacyCategory = crypto.randomUUID();
  await sql`insert into "auth.users" (id,email) values (${legacySeller},'legacy@example.test')`;
  await sql`insert into users (id,email,role) values (${legacySeller},'legacy@example.test','seller')`;
  await sql`insert into categories (id,name,slug) values (${legacyCategory},'Legacy category','legacy-fixture')`;
  await sql`insert into listing_packages (id,name,listing_allowance,duration_days) values (${legacyPackage},'Legacy package',10,30)`;
  await sql`insert into seller_subscriptions (id,seller_id,package_id,started_at,expires_at) values (${legacySub},${legacySeller},${legacyPackage},now()-interval '1 day',now()+interval '29 days')`;
  await sql`insert into listings (id,seller_id,category_id,title,description,price,delivery_method,status,monetization_status) values (${legacyListing},${legacySeller},${legacyCategory},'Legacy listing','Legacy fixture',500000,${schema.DELIVERY_METHODS[0]},'pending_review','active')`;
  const migration = readFileSync("drizzle/0038_seller_cancellation_and_discounts.sql", "utf8");
  await sql.begin(async (tx) => { for (const statement of migration.split("--> statement-breakpoint").filter((part) => part.trim())) await tx.unsafe(statement); });
  const [legacy] = await sql`select listings_used from seller_subscriptions where id = ${legacySub}`;
  assert.equal(legacy.listings_used, 1);
  const [usage] = await sql`select subscription_id from seller_package_usages where listing_id = ${legacyListing}`;
  assert.equal(usage.subscription_id, legacySub);
  actorId = await seller("admin");
  const [category] = await db.insert(schema.categories).values({ name: "Test", slug: crypto.randomUUID() }).returning();
  categoryId = category.id;
});
after(async () => { await sql.end(); await db.$client.end({ timeout: 2 }); });

async function seller(role = "seller") {
  const id = crypto.randomUUID(), email = `${id}@example.test`;
  await db.insert(schema.authUsers).values({ id, email });
  await db.insert(schema.users).values({ id, email, role, isInternal: role === "admin" });
  await db.insert(schema.profiles).values({ id, displayName: "Test seller", sellerType: "individual" });
  return id;
}
async function listing(sellerId: string, price = 500000) {
  const [row] = await db.insert(schema.listings).values({ sellerId, categoryId, title: "Integration test listing", description: "Disposable integration fixture", price, deliveryMethod: schema.DELIVERY_METHODS[0] }).returning();
  return row;
}
async function allowance(sellerId: string, limit = 1) {
  const [pkg] = await db.insert(schema.listingPackages).values({ name: "Allowance fixture", listingAllowance: limit, durationDays: 30 }).returning();
  const [sub] = await db.insert(schema.sellerSubscriptions).values({ sellerId, packageId: pkg.id, expiresAt: new Date(Date.now() + 86400000) }).returning();
  return sub;
}
async function discount(sellerId: string, limit = 1, value = 4000) {
  const pkg = await saveDiscountPackage({ name: "Premium offer", tierKey: "500000:*", type: "percentage", value, listingLimit: limit, durationDays: 30 }, authorize);
  await assignDiscountPackage({ packageId: pkg.id, sellerIds: [sellerId], confirmed: true }, authorize);
  const [assignment] = await db.select().from(schema.sellerDiscountAssignments).where(eq(schema.sellerDiscountAssignments.sellerId, sellerId));
  return { pkg, assignment };
}
const paymentInput = (sellerId: string, listingId: string) => ({ sellerId, listingId, phone: "252611234567", provider: "evc" as const, requestKey: crypto.randomUUID() });
const approved = async () => ({ merchantRef: crypto.randomUUID(), status: "completed" as const });
const editInput = (row: Awaited<ReturnType<typeof listing>>) => ({
  title: "Edited fixture listing", description: row.description, categoryId: row.categoryId, price: row.price,
  deliveryMethod: row.deliveryMethod, images: [], metadata: {}, condition: row.condition,
});

test("cancellation is authorized, idempotent and does not cancel another seller", async () => {
  const sellerId = await seller(), other = await seller();
  const sub = await allowance(sellerId), otherSub = await allowance(other);
  const published = await listing(sellerId);
  const originalExpiry = new Date(Date.now() + 86400000);
  await db.update(schema.listings).set({ status: "active", isFeatured: true, featuredUntil: originalExpiry, expiresAt: originalExpiry }).where(eq(schema.listings.id, published.id));
  const input = { assignmentId: sub.id, reason: "seller_request", confirmed: true };
  await assert.rejects(cancelSellerPackage(input, forbidden), /Forbidden/);
  await cancelSellerPackage(input, authorize);
  await cancelSellerPackage(input, authorize);
  const [row] = await db.select().from(schema.sellerSubscriptions).where(eq(schema.sellerSubscriptions.id, sub.id));
  assert.equal(row.status, "cancelled"); assert.equal(row.cancelledBy, actorId); assert.equal(row.cancellationReason, "seller_request");
  const [audit] = await db.select({ value: count() }).from(schema.auditLogs).where(and(eq(schema.auditLogs.resourceId, sub.id), eq(schema.auditLogs.action, "seller_package_cancelled")));
  assert.equal(Number(audit.value), 1);
  const [untouched] = await db.select().from(schema.sellerSubscriptions).where(eq(schema.sellerSubscriptions.id, otherSub.id));
  assert.equal(untouched.status, "active");
  const [kept] = await db.select().from(schema.listings).where(eq(schema.listings.id, published.id));
  assert.equal(kept.status, "active"); assert.equal(kept.isFeatured, true); assert.equal(kept.expiresAt?.getTime(), originalExpiry.getTime());
  await assert.rejects(consumeSellerPackage((await listing(sellerId)).id, sellerId), /No active package/);
});

test("simultaneous package submissions cannot overspend the last credit", async () => {
  const sellerId = await seller(), sub = await allowance(sellerId);
  const a = await listing(sellerId), b = await listing(sellerId);
  const results = await Promise.allSettled([consumeSellerPackage(a.id, sellerId), consumeSellerPackage(b.id, sellerId)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  const [row] = await db.select().from(schema.sellerSubscriptions).where(eq(schema.sellerSubscriptions.id, sub.id));
  assert.equal(row.listingsUsed, 1);
  const winning = results[0].status === "fulfilled" ? a : b;
  await consumeSellerPackage(winning.id, sellerId);
  const [again] = await db.select().from(schema.sellerSubscriptions).where(eq(schema.sellerSubscriptions.id, sub.id));
  assert.equal(again.listingsUsed, 1);
});

test("cancellation racing submission serializes and preserves published work", async () => {
  const sellerId = await seller(), sub = await allowance(sellerId), draft = await listing(sellerId);
  await Promise.allSettled([cancelSellerPackage({ assignmentId: sub.id, reason: "admin_decision", confirmed: true }, authorize), consumeSellerPackage(draft.id, sellerId)]);
  const [row] = await db.select().from(schema.sellerSubscriptions).where(eq(schema.sellerSubscriptions.id, sub.id));
  assert.equal(row.status, "cancelled");
  await assert.rejects(consumeSellerPackage((await listing(sellerId)).id, sellerId));
});

test("one discount credit is reserved exactly once across simultaneous purchases", async () => {
  const sellerId = await seller(); await discount(sellerId);
  const a = await listing(sellerId), b = await listing(sellerId);
  const results = await Promise.all([payListingFee(paymentInput(sellerId, a.id), approved), payListingFee(paymentInput(sellerId, b.id), approved)]);
  assert.deepEqual(results.map((item) => item.amountCents).sort((x, y) => x - y), [150, 250]);
});

test("checkout concurrency greater than the database pool size does not deadlock", async () => {
  const sellerId = await seller(); await discount(sellerId);
  const drafts = await Promise.all(Array.from({ length: 5 }, () => listing(sellerId)));
  const results = await Promise.all(drafts.map((draft) => payListingFee(paymentInput(sellerId, draft.id), approved)));
  assert.deepEqual(results.map((row) => row.amountCents).sort((a, b) => a - b), [150, 250, 250, 250, 250]);
});

test("same-listing retries do not call the gateway twice or alter paid snapshots", async () => {
  const sellerId = await seller(); await discount(sellerId);
  const draft = await listing(sellerId); let calls = 0;
  const gateway = async () => { calls++; return approved(); };
  await Promise.all([payListingFee(paymentInput(sellerId, draft.id), gateway), payListingFee(paymentInput(sellerId, draft.id), gateway)]);
  const repeat = await payListingFee(paymentInput(sellerId, draft.id), gateway);
  assert.equal(calls, 1); assert.equal(repeat.amountCents, 150); assert.equal(repeat.status, "completed");
});

test("real wallet finalization and audit writes serialize with checkout retries", async () => {
  const sellerId = await seller(); await discount(sellerId, 5);
  const draft = await listing(sellerId);
  let calls = 0;
  const wallet: typeof initiateWalletPayment = (userId, listingId, orderId, provider, phone, amount, purpose, key) =>
    initiateWalletPayment(userId, listingId, orderId, provider, phone, amount, purpose, key, async (request) => {
      calls++;
      return parseWaafiPurchaseResponse({ responseCode: "2001", params: { state: "APPROVED", transactionId: crypto.randomUUID(), txAmount: (request.amountCents / 100).toFixed(2) } });
    });
  await Promise.all(Array.from({ length: 5 }, () => payListingFee(paymentInput(sellerId, draft.id), wallet)));
  const result = await payListingFee(paymentInput(sellerId, draft.id), wallet);
  assert.equal(calls, 1); assert.equal(result.status, "completed"); assert.equal(result.amountCents, 150);
  const [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, draft.id));
  assert.equal(row.status, "pending_review"); assert.equal(row.monetizationStatus, "active"); assert.equal(row.feeAmountCents, 150);
  const payments = await db.select().from(schema.walletPayments).where(eq(schema.walletPayments.listingId, draft.id));
  assert.equal(payments.length, 1); assert.equal(payments[0].amount, 150); assert.equal(payments[0].status, "completed");
});

test("full discount submits for review without a wallet call", async () => {
  const sellerId = await seller(); await discount(sellerId, 1, 10000);
  const draft = await listing(sellerId);
  const result = await payListingFee({ ...paymentInput(sellerId, draft.id), phone: "" }, async () => { assert.fail("Gateway must not receive zero"); });
  assert.equal(result.status, "completed"); assert.equal(result.amountCents, 0);
  const repeated = await payListingFee(paymentInput(sellerId, draft.id), approved);
  assert.equal(repeated.merchantRef, result.merchantRef);
  const [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, draft.id));
  assert.equal(row.status, "pending_review"); assert.equal(row.feeAmountCents, 0);
  await updateSellerListing(draft.id, sellerId, editInput(draft));
  const [edited] = await db.select().from(schema.listings).where(eq(schema.listings.id, draft.id));
  assert.equal(edited.feeAmountCents, 0);
});

test("definition edits/deactivation preserve assignment terms; cancellation prevents new discounts", async () => {
  const sellerId = await seller(); const { pkg, assignment } = await discount(sellerId, 10);
  await saveDiscountPackage({ id: pkg.id, name: pkg.name, tierKey: pkg.tierKey, type: "percentage", value: 5000, listingLimit: 10, durationDays: 30 }, authorize);
  await setDiscountPackageActive({ id: pkg.id, active: false, confirmed: true }, authorize);
  assert.equal((await getSellerListingPricing(sellerId, 500000, categoryId)).feeCents, 150);
  await cancelDiscountAssignment({ assignmentId: assignment.id, reason: "admin_decision", confirmed: true }, authorize);
  assert.equal((await getSellerListingPricing(sellerId, 500000, categoryId)).feeCents, 250);
});

test("definitive failure releases a credit; unknown outcomes retain it", async () => {
  const sellerId = await seller(); await discount(sellerId);
  const draft = await listing(sellerId);
  await payListingFee(paymentInput(sellerId, draft.id), async () => ({ merchantRef: "declined", status: "failed" }));
  assert.equal((await getSellerListingPricing(sellerId, 500000, categoryId)).feeCents, 150);
  await payListingFee(paymentInput(sellerId, draft.id), async () => ({ merchantRef: "uncertain", status: "pending_reconciliation" }));
  assert.equal((await getSellerListingPricing(sellerId, 500000, categoryId)).feeCents, 250);
});

test("expiry, wrong tier and mismatched display price never consume a discount", async () => {
  const sellerId = await seller(); const { assignment } = await discount(sellerId);
  assert.equal((await getSellerListingPricing(sellerId, 1000, categoryId)).feeCents, 50);
  const draft = await listing(sellerId);
  const review = await payListingFee({ ...paymentInput(sellerId, draft.id), expectedFeeCents: 250 }, async () => { assert.fail("Requote must not charge"); });
  assert.equal(review.status, "failed"); assert.equal(review.amountCents, 150);
  await db.update(schema.sellerDiscountAssignments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.sellerDiscountAssignments.id, assignment.id));
  assert.equal((await getSellerListingPricing(sellerId, 500000, categoryId)).feeCents, 250);
});

test("cancelling a discount during an initiated payment preserves its reserved quote", async () => {
  const sellerId = await seller(); const { assignment } = await discount(sellerId, 2);
  const draft = await listing(sellerId);
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const payment = payListingFee(paymentInput(sellerId, draft.id), async () => { started(); await gate; return approved(); });
  await ready;
  try {
    await assert.rejects(updateSellerListing(draft.id, sellerId, editInput(draft)), /payment is in progress/);
    await cancelDiscountAssignment({ assignmentId: assignment.id, reason: "seller_request", confirmed: true }, authorize);
  } finally { release(); }
  const result = await payment;
  assert.equal(result.amountCents, 150); assert.equal(result.status, "completed");
  assert.equal((await getSellerListingPricing(sellerId, 500000, categoryId)).feeCents, 250);
});

test("duplicate assignments require explicit replacement and preserve another seller", async () => {
  const sellerId = await seller(), otherId = await seller();
  const { pkg, assignment } = await discount(sellerId, 10);
  await assignDiscountPackage({ packageId: pkg.id, sellerIds: [otherId], confirmed: true }, authorize);
  await assert.rejects(assignDiscountPackage({ packageId: pkg.id, sellerIds: [sellerId], confirmed: true }, authorize), /Confirm replacement/);
  await assignDiscountPackage({ packageId: pkg.id, sellerIds: [sellerId], replace: true, confirmed: true }, authorize);
  const [previous] = await db.select().from(schema.sellerDiscountAssignments).where(eq(schema.sellerDiscountAssignments.id, assignment.id));
  assert.equal(previous.status, "cancelled");
  assert.equal((await getSellerListingPricing(otherId, 500000, categoryId)).feeCents, 150);
});

test("new discount and usage tables expose no rows to a non-owner database role", async () => {
  await sql.unsafe("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'celis_discount_test_client') THEN CREATE ROLE celis_discount_test_client NOLOGIN; END IF; END $$");
  await sql.unsafe("GRANT SELECT ON seller_package_usages, listing_discount_packages, seller_discount_assignments, listing_fee_checkouts TO celis_discount_test_client");
  await sql.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE celis_discount_test_client");
    for (const name of ["seller_package_usages", "listing_discount_packages", "seller_discount_assignments", "listing_fee_checkouts"]) {
      const [row] = await tx.unsafe(`SELECT count(*) AS count FROM ${name}`);
      assert.equal(Number(row.count), 0);
    }
  });
});
