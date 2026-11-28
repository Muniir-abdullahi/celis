import assert from "node:assert/strict";
import test from "node:test";
import { staffIdentityLabels } from "../app/lib/staff-identity";

const staff = { displayName: " Asha Ali ", staffId: "CELIS-000001", department: "Finance", role: "finance_officer", isSuperAdmin: false };

test("distinct staff retain their own identity and ordinary staff are not labelled admin", () => {
  assert.deepEqual(staffIdentityLabels(staff), { name: "Asha Ali", staffId: "CELIS-000001", department: "Finance", accountType: "Internal User" });
  const second = staffIdentityLabels({ ...staff, displayName: "Omar Ali", staffId: "CELIS-000002", department: "Operations" });
  assert.equal(second.name, "Omar Ali");
  assert.equal(second.staffId, "CELIS-000002");
  assert.equal(second.department, "Operations");
});

test("admin role and super admin flag identify administrators without interpreting custom role names", () => {
  assert.equal(staffIdentityLabels({ ...staff, role: "admin" }).accountType, "Admin User");
  assert.equal(staffIdentityLabels({ ...staff, isSuperAdmin: true }).accountType, "Admin User");
  assert.equal(staffIdentityLabels({ ...staff, role: "admin_assistant" }).accountType, "Internal User");
});

test("incomplete existing staff information uses explicit fallbacks", () => {
  assert.deepEqual(staffIdentityLabels({ ...staff, displayName: " ", department: null, staffId: null }), {
    name: "Name not assigned", department: "Department not assigned", staffId: "Staff ID not assigned", accountType: "Internal User",
  });
});
