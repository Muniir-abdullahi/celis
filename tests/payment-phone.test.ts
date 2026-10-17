import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("app/components/listings/payment-modal.tsx", "utf8");
const action = readFileSync("app/server/payments.functions.ts", "utf8");
const payment = readFileSync("app/server/payments.server.ts", "utf8");

test("payment uses the editable payer number throughout the request boundary", () => {
  assert.match(modal, /const phone = enteredPhone \?\? user\?\.phone \?\? ""/);
  assert.match(modal, /onChange=\{\(e\) => setPhone\(e\.target\.value\)\}/);
  assert.match(modal, /provider:[\s\S]*?\n\s+phone,/);
  assert.match(action, /data\.phone/);
  assert.match(payment, /normalizeWaafiAccountNo\(phone\)/);
  assert.match(payment, /accountNo: normalizedPhone/);
  assert.doesNotMatch(payment, /user\.phone|user\.walletPhone/);
});

test("payment phone is locked only during submission and reconciliation", () => {
  assert.match(modal, /disabled=\{loading \|\| !!merchantRef\}/);
  assert.match(modal, /!success && !merchantRef/);
  assert.match(modal, /setPhone\(null\)/);
});
