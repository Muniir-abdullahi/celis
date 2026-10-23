import assert from "node:assert/strict";
import test from "node:test";
import { customerAccountSchema, provisionCustomerAccount } from "../app/lib/customer-account";

const base = { email: "Buyer@example.com", password: "Test-password-123", displayName: "Test Buyer", role: "buyer" };

test("customer input normalizes email and cannot create staff or inject privileges", () => {
  assert.equal(customerAccountSchema.parse(base).email, "buyer@example.com");
  assert.equal(customerAccountSchema.parse(base).playReviewer, false);
  for (const extra of [{ role: "admin" }, { isInternal: true }, { isSuperAdmin: true }, { app_metadata: { play_reviewer: true } }]) {
    assert.equal(customerAccountSchema.safeParse({ ...base, ...extra }).success, false);
  }
});

test("seller and reviewer fields validate", () => {
  assert.equal(customerAccountSchema.safeParse({ ...base, role: "seller", sellerType: "shop" }).success, false);
  assert.equal(customerAccountSchema.safeParse({ ...base, role: "seller", sellerType: "shop", businessName: "Test Shop", playReviewer: true }).success, true);
  for (const extra of [{ password: "short" }, { phone: "611234567" }, { playReviewer: "true" }]) {
    assert.equal(customerAccountSchema.safeParse({ ...base, ...extra }).success, false);
  }
});

test("successful creation returns no password and does not delete the account", async () => {
  const calls: string[] = [];
  const result = await provisionCustomerAccount(customerAccountSchema.parse(base), {
    async createAuth() { calls.push("auth"); return "new-id"; },
    async saveCustomer(id) { calls.push(`save:${id}`); },
    async deleteAuth() { calls.push("delete"); },
  });
  assert.deepEqual(calls, ["auth", "save:new-id"]);
  assert.equal("password" in result, false);
});

test("database failure removes only the newly created Auth account", async () => {
  const deleted: string[] = [];
  await assert.rejects(provisionCustomerAccount(customerAccountSchema.parse(base), {
    async createAuth() { return "new-id"; },
    async saveCustomer() { throw new Error("database failed"); },
    async deleteAuth(id) { deleted.push(id); },
  }), /database failed/);
  assert.deepEqual(deleted, ["new-id"]);
});

test("Auth rejection never writes or deletes local/customer accounts", async () => {
  await assert.rejects(provisionCustomerAccount(customerAccountSchema.parse(base), {
    async createAuth() { throw new Error("duplicate email"); },
    async saveCustomer() { assert.fail("must not save"); },
    async deleteAuth() { assert.fail("must not delete"); },
  }), /duplicate email/);
});

test("cleanup failure reports the orphan id without revealing credentials", async () => {
  await assert.rejects(provisionCustomerAccount(customerAccountSchema.parse(base), {
    async createAuth() { return "orphan-id"; },
    async saveCustomer() { throw new Error(base.password); },
    async deleteAuth() { throw new Error(base.password); },
  }), (error: Error) => error.message.includes("orphan-id") && !error.message.includes(base.password));
});
