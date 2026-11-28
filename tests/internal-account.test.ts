import assert from "node:assert/strict";
import test from "node:test";
import { internalAccountSchema, provisionInternalAccount } from "../app/lib/internal-account";
import { adminMutation, AdminInputError } from "../app/lib/admin-mutation";
import { roleInputSchema } from "../app/lib/role-input";

const input = internalAccountSchema.parse({ fullName: " Staff Member ", email: " Staff@EXAMPLE.com ", password: "Test-password-123", role: "finance_officer", department: " Finance " });

function fixture() {
  const calls: string[] = [];
  return { calls, dependencies: {
    async isInternalRole(role: string) { calls.push(`role:${role}`); return true; },
    async createAuth() { calls.push("auth"); return "new-id"; },
    async saveAccount(id: string) { calls.push(`save:${id}`); },
    async deleteAuth(id: string) { calls.push(`delete:${id}`); },
  } };
}

test("staff input normalizes identity and bounds provider/database fields", () => {
  assert.equal(input.email, "staff@example.com");
  assert.equal(input.fullName, "Staff Member");
  assert.equal(input.department, "Finance");
  for (const extra of [{ fullName: " " }, { fullName: "x".repeat(61) }, { staffId: "CELIS-000001" }, { password: "short" }, { password: "x".repeat(73) }, { department: "x".repeat(101) }, { isSuperAdmin: true }, { role: "" }]) {
    assert.equal(internalAccountSchema.safeParse({ ...input, ...extra }).success, false);
  }
});

test("staff creation validates the role before Auth and returns no credentials", async () => {
  const { calls, dependencies } = fixture();
  const result = await provisionInternalAccount(input, dependencies);
  assert.deepEqual(calls, ["role:finance_officer", "auth", "save:new-id"]);
  assert.deepEqual(result, { id: "new-id", email: "staff@example.com" });
});

test("customer and nonexistent roles cannot create Auth accounts", async () => {
  const { calls, dependencies } = fixture();
  dependencies.isInternalRole = async () => false;
  await assert.rejects(provisionInternalAccount(input, dependencies), /internal staff role/);
  assert.deepEqual(calls, []);
});

test("Auth failure never writes or deletes accounts", async () => {
  const { calls, dependencies } = fixture();
  dependencies.createAuth = async () => { throw new AdminInputError("Email already exists."); };
  await assert.rejects(provisionInternalAccount(input, dependencies), /already exists/);
  assert.deepEqual(calls, ["role:finance_officer"]);
});

test("local write or audit failure compensates only the newly created Auth account", async () => {
  const { calls, dependencies } = fixture();
  dependencies.saveAccount = async () => { throw new Error("transaction failed"); };
  await assert.rejects(provisionInternalAccount(input, dependencies), /transaction failed/);
  assert.deepEqual(calls, ["role:finance_officer", "auth", "delete:new-id"]);
});

test("cleanup failure identifies the orphan without exposing credentials", async () => {
  const { dependencies } = fixture();
  dependencies.saveAccount = async () => { throw new Error(input.password); };
  dependencies.deleteAuth = async () => { throw new Error(input.password); };
  const result = await adminMutation(() => provisionInternalAccount(input, dependencies));
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error, /orphan account new-id/);
    assert.equal(result.error.includes(input.password), false);
  }
});

test("admin results preserve expected errors and redact unexpected failures", async () => {
  assert.deepEqual(await adminMutation(async () => ({ id: "role-id" })), { success: true, data: { id: "role-id" } });
  for (const message of ["Unauthorized", "Forbidden"]) {
    const result = await adminMutation(async () => { throw new Error(message); });
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error, /permission/);
  }
  const expected = await adminMutation(async () => { throw new AdminInputError("Role key already exists."); });
  assert.deepEqual(expected, { success: false, error: "Role key already exists." });
  const unexpected = await adminMutation(async () => { throw new Error(`database query password=${input.password}`); });
  assert.equal(unexpected.success, false);
  if (!unexpected.success) assert.equal(unexpected.error.includes(input.password), false);
});

test("role creation normalizes keys before validation and rejects blank names", async () => {
  const role = roleInputSchema.parse({ key: " Finance Officer ", label: " Finance Officer " });
  assert.deepEqual(role, { key: "finance_officer", label: "Finance Officer", domain: "internal" });
  for (const extra of [{ key: "---" }, { key: "x" }, { label: "  " }, { domain: "admin" }]) {
    assert.equal(roleInputSchema.safeParse({ ...role, ...extra }).success, false);
  }
  const result = await adminMutation(async () => roleInputSchema.parse({ key: "---", label: "Finance" }));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /two letters or numbers/);
});
