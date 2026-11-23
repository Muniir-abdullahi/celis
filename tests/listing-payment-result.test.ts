import assert from "node:assert/strict";
import test from "node:test";
import { listingPaymentStatus } from "../app/lib/listing-payment-result";
import { parseWaafiPurchaseResponse } from "../app/lib/waafi";

test("unknown or incomplete gateway responses keep reservations for reconciliation", () => {
  assert.equal(listingPaymentStatus(parseWaafiPurchaseResponse(null), 150), "pending_reconciliation");
  assert.equal(listingPaymentStatus(parseWaafiPurchaseResponse({ responseCode: "2001", params: { state: "PENDING" } }), 150), "pending_reconciliation");
  assert.equal(listingPaymentStatus(parseWaafiPurchaseResponse({ responseCode: "2001", params: { state: "APPROVED" } }), 150), "pending_reconciliation");
  assert.equal(listingPaymentStatus(parseWaafiPurchaseResponse({ params: { state: "DECLINED" } }), 150), "failed");
  const approved = parseWaafiPurchaseResponse({ responseCode: "2001", params: { state: "APPROVED", transactionId: "test", txAmount: "1.50" } });
  assert.equal(listingPaymentStatus(approved, 150), "completed");
  assert.equal(listingPaymentStatus(approved, 250), "pending_reconciliation");
});
