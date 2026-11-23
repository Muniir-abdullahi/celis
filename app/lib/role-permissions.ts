export type PermissionOption = { key: string; label: string; description: string | null };

const moduleLabels: Record<string, string> = {
  admin: "Admin access", audit: "Audit & compliance", audit_logs: "Audit & compliance",
  categories: "Categories", listings: "Listings", orders: "Orders", payouts: "Payouts",
  reports: "Reports", reviews: "Reviews", seller: "Seller verification", settings: "Settings", users: "Users & staff",
};

export function groupPermissions(permissions: PermissionOption[], query = "") {
  const groups = new Map<string, PermissionOption[]>();
  const search = query.trim().toLowerCase();
  for (const permission of permissions) {
    const module = permission.key.split(":")[0];
    const label = moduleLabels[module] ?? module.replaceAll("_", " ");
    if (search && !`${label} ${permission.label} ${permission.description ?? ""} ${permission.key}`.toLowerCase().includes(search)) continue;
    groups.set(label, [...(groups.get(label) ?? []), permission]);
  }
  return Array.from(groups, ([label, items]) => ({ label, items }));
}

export function permissionsChanged(current: string[], original: string[]) {
  const selected = new Set(current);
  const baseline = new Set(original);
  return selected.size !== baseline.size || [...selected].some((key) => !baseline.has(key));
}
