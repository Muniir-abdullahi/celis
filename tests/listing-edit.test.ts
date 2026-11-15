import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  changedListingFields,
  checkPaidPriceTier,
  isListingEditable,
  statusAfterEdit,
} from "../app/lib/listing-edit.ts";

const action = readFileSync("app/server/listing-edit.functions.ts", "utf8");
const server = readFileSync("app/server/listing-edit.server.ts", "utf8");
const create = readFileSync("app/server/listings.functions.ts", "utf8");
const wizard = readFileSync("app/components/listings/listing-wizard.tsx", "utf8");
const dashboard = readFileSync("app/dashboard/dashboard-content.tsx", "utf8");

test("only draft, in-review, live and rejected listings are editable", () => {
  for (const s of ["draft", "pending_review", "active", "rejected"]) {
    assert.equal(isListingEditable(s), true, s);
  }
  for (const s of ["sold", "expired", "suspended", "inactive", "nope"]) {
    assert.equal(isListingEditable(s), false, s);
  }
});

test("editing a live or rejected listing sends it back to review", () => {
  assert.equal(statusAfterEdit("active", "active"), "pending_review");
  assert.equal(statusAfterEdit("rejected", "active"), "pending_review");
  assert.equal(statusAfterEdit("pending_review", "active"), "pending_review");
  assert.equal(statusAfterEdit("draft", "pending_paid"), "draft");
  // A rejected listing that was never paid for returns to draft (pay first).
  assert.equal(statusAfterEdit("rejected", "pending_paid"), "draft");
});

test("a paid fee allows the same or a cheaper tier, never a pricier one", () => {
  assert.deepEqual(checkPaidPriceTier({ feePaid: true, paidFeeCents: 100, newFeeCents: 100 }), { ok: true });
  assert.deepEqual(checkPaidPriceTier({ feePaid: true, paidFeeCents: 250, newFeeCents: 100 }), { ok: true });
  assert.deepEqual(
    checkPaidPriceTier({ feePaid: true, paidFeeCents: 100, newFeeCents: 250 }),
    { ok: false, paidFeeCents: 100, newFeeCents: 250 }
  );
  // Unpaid drafts, shop package and commission-only listings are not limited.
  assert.deepEqual(checkPaidPriceTier({ feePaid: false, paidFeeCents: 100, newFeeCents: 250 }), { ok: true });
});

test("changed fields ignore key order and blank metadata", () => {
  assert.deepEqual(
    changedListingFields(
      { title: "A", price: 100, metadata: { brand: "apple", model: "x" }, images: ["1"] },
      { title: "A", price: 200, metadata: { model: "x", brand: "apple", ram: null }, images: ["1", "2"] }
    ),
    ["images", "price"]
  );
});

test("the edit action uses the signed-in seller, never a client seller id", () => {
  assert.match(action, /getCurrentUser\(\)/);
  assert.match(action, /updateSellerListing\(data\.id, user\.id, data\.listing\)/);
  assert.doesNotMatch(action, /sellerId/);
});

test("edits validate details like create, lock the category, and audit in a transaction", () => {
  assert.match(action, /prepareListingDetails\(data\.listing\)/);
  assert.match(create, /prepareListingDetails\(data\.listing\)/);
  assert.match(server, /db\.transaction\(/);
  assert.match(server, /\.for\("update"\)/);
  assert.match(server, /"CATEGORY_LOCKED"/);
  assert.match(server, /"PRICE_TIER_CHANGED"/);
  assert.match(server, /action: "listing\.seller_edit"/);
  assert.match(server, /previousStatus: current\.status/);
});

test("edit page and entry points exist; category is locked in the wizard", () => {
  assert.ok(existsSync("app/listings/[id]/edit/page.tsx"));
  assert.match(wizard, /disabled=\{isEdit\}/);
  assert.match(wizard, /"Save changes"/);
  assert.match(dashboard, /href=\{`\/listings\/\$\{listing\.id\}\/edit`\}/);
});
