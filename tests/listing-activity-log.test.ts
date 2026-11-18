import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Admin listing detail shows that listing's audit / activity log, and the
// key listing events (creation, package submission, fee payments) are audited.

const read = (f: string) => readFileSync(f, "utf8");
const listingsFns = read("app/server/listings.functions.ts");
const paymentsServer = read("app/server/payments.server.ts");
const audit = read("app/server/audit.server.ts");
const adminFns = read("app/server/admin.functions.ts");
const adminPage = read("app/admin/listings/[id]/page.tsx");
const activity = read("app/admin/listings/[id]/listing-activity.tsx");

function fnBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("audit query can be narrowed to one listing (indexed columns)", () => {
  assert.match(audit, /eq\(auditLogs\.resourceType, options\.resourceType\)/);
  assert.match(audit, /eq\(auditLogs\.resourceId, options\.resourceId\)/);
  const body = fnBody(adminFns, "fetchListingAuditLogs");
  assert.match(body, /requirePermission\("audit:read"\)/);
  assert.match(body, /resourceType: "listing"/);
});

test("admin listing page shows a paginated activity log, hidden without audit:read", () => {
  assert.match(adminPage, /fetchListingAuditLogs\(\{[\s\S]*?\}\)\.catch\(\(\) => null\)/);
  assert.match(adminPage, /\{activity && <ListingActivity data=\{activity\} \/>\}/);
  assert.match(activity, /\?activity=\$\{p\}/);
  assert.match(activity, /"listing\.seller_edit": "Edited by seller"/);
});

test("creation, package submission and fee payments are now audited", () => {
  assert.match(listingsFns, /action: "listing_created"/);
  assert.match(listingsFns, /action: "listing_submitted_with_package"/);
  assert.match(paymentsServer, /"listing_fee_paid"/);
  assert.match(paymentsServer, /"listing_fee_payment_failed"/);
  // The payment audit runs in the same transaction and never stores the phone.
  const start = paymentsServer.indexOf("metadata: {", paymentsServer.indexOf("Listing activity log"));
  const stored = paymentsServer.slice(start, paymentsServer.indexOf("},", start));
  assert.match(stored, /merchantRef/);
  assert.doesNotMatch(stored, /phone/i);
});
