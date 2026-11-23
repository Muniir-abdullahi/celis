import assert from "node:assert/strict";
import test from "node:test";
import { discountedFee, discountInputSchema, listingTierKey } from "../app/lib/listing-discounts";
import { cancellationSchema } from "../app/lib/package-cancellation";

test("percentage and fixed discounts round to cents without negative fees", () => {
  assert.equal(discountedFee(250, "percentage", 4000), 150);
  assert.equal(discountedFee(250, "percentage", 2500), 188);
  assert.equal(discountedFee(250, "percentage", 0), 250);
  assert.equal(discountedFee(250, "percentage", 10000), 0);
  assert.equal(discountedFee(250, "fixed", 100), 150);
  assert.equal(discountedFee(50, "fixed", 100), 0);
  for (const value of [-1, 10001, 0.5, NaN]) assert.throws(() => discountedFee(250, "percentage", value));
});

test("tier identity survives renames but fails closed when ranges change", () => {
  const tier = { label: "Premium", minCents: 500000, maxCents: null, feeCents: 250, expiryDays: 30 };
  assert.equal(listingTierKey(tier), listingTierKey({ ...tier, label: "High value" }));
  assert.notEqual(listingTierKey(tier), listingTierKey({ ...tier, minCents: 600000 }));
});

test("definitions require positive duration and limits; cancellation requires explicit acknowledgement", () => {
  const input = { name: "Premium offer", tierKey: "500000:*", type: "percentage", value: 4000, listingLimit: 50, durationDays: 30 };
  assert.equal(discountInputSchema.safeParse(input).success, true);
  for (const extra of [{ listingLimit: 0 }, { durationDays: -1 }, { durationDays: 1.5 }, { value: -1 }]) assert.equal(discountInputSchema.safeParse({ ...input, ...extra }).success, false);
  const cancel = { assignmentId: crypto.randomUUID(), reason: "admin_decision", confirmed: true };
  assert.equal(cancellationSchema.safeParse(cancel).success, true);
  assert.equal(cancellationSchema.safeParse({ ...cancel, confirmed: false }).success, false);
  assert.equal(cancellationSchema.safeParse({ ...cancel, reason: "unknown" }).success, false);
});

