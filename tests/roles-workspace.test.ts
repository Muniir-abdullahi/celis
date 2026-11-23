import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { groupPermissions, permissionsChanged } from "../app/lib/role-permissions";
import { RolesWorkspace } from "../app/components/admin/roles-workspace";

const permissions = [
  { key: "audit:read", label: "View audit log", description: "View platform changes" },
  { key: "audit_logs:read", label: "Read audit logs", description: null },
  { key: "users:manage", label: "Manage users", description: "Change staff roles" },
];

test("permissions group by module and preserve distinct audit permissions", () => {
  const groups = groupPermissions(permissions);
  assert.deepEqual(groups.map((group) => [group.label, group.items.length]), [["Audit & compliance", 2], ["Users & staff", 1]]);
  assert.deepEqual(groupPermissions(permissions, " STAFF ").map((group) => group.items[0].key), ["users:manage"]);
  assert.equal(groupPermissions(permissions, "not-present").length, 0);
  assert.equal(groupPermissions(permissions, "audit_logs:read")[0].items.length, 1);
});

test("dirty state compares sets independently of order and resets when edits are undone", () => {
  assert.equal(permissionsChanged(["a", "b"], ["b", "a"]), false);
  assert.equal(permissionsChanged(["a", "a"], ["a"]), false);
  assert.equal(permissionsChanged(["a"], ["a", "b"]), true);
  assert.equal(permissionsChanged(["a", "c"], ["a", "b"]), true);
  assert.equal(permissionsChanged([], []), false);
});


const role = { id: "role-id", key: "finance", label: "Finance", description: null, domain: "internal" as const, isSystem: false, createdAt: new Date(), updatedAt: new Date() };
function workspace(overrides = {}) {
  const noop = () => {};
  return renderToStaticMarkup(createElement(RolesWorkspace, {
    roles: [role], permissions, selectedRole: "finance", selectedKeys: [], canManage: true,
    loading: false, saving: false, saved: false, dirty: false, error: "",
    onSelect: noop, onToggle: noop, onEdit: noop, onDelete: noop, onSave: noop, onReset: noop, onRetry: noop,
    ...overrides,
  }));
}

test("role workspace labels searches and switches and shows a clean initial save state", () => {
  const html = workspace();
  assert.match(html, /aria-label="Search roles"/);
  assert.match(html, /aria-label="Search permissions"/);
  assert.match(html, /aria-label="Manage users"/);
  assert.match(html, /All changes saved/);
  assert.match(html, /disabled=""[^>]*>Save changes/);
});

test("loading hides permission switches and read-only state disables changes", () => {
  const loading = workspace({ loading: true });
  assert.match(loading, /Loading permissions/);
  assert.doesNotMatch(loading, /role="switch"/);
  const readOnly = workspace({ canManage: false });
  assert.match(readOnly, /Read-only access/);
  assert.doesNotMatch(readOnly, />Save changes</);
  assert.match(workspace({ dirty: true }), /You have unsaved changes/);
});
