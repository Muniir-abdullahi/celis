import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// Admin package detail page: package summary + the sellers assigned to it.

const read = (f: string) => readFileSync(f, "utf8");
const query = read("app/server/package-subscribers.server.ts");
const adminFns = read("app/server/admin.functions.ts");
const page = read("app/admin/packages/[id]/page.tsx");
const content = read("app/admin/packages/[id]/package-detail.tsx");
const list = read("app/admin/packages/packages-content.tsx");
const schema = read("app/db/schema/seller-packages.ts");

function fnBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("detail action is admin-only with the packages page permission", () => {
  const body = fnBody(adminFns, "fetchAdminPackageDetail");
  assert.match(body, /requirePermission\("settings:manage"\)/);
  assert.match(body, /getPackageSubscribers\(/);
});

test("sellers are filtered, searched and paginated on the server", () => {
  const body = fnBody(query, "getPackageSubscribers");
  assert.match(body, /eq\(sellerSubscriptions\.packageId, options\.packageId\)/);
  assert.match(body, /\.limit\(options\.limit\)\s*\.offset\(offset\)/);
  assert.match(body, /ilike\(users\.email,/);
  // Listings used is computed for the current page only.
  assert.match(body, /inArray\(sellerSubscriptions\.id, rows\.map/);
});

test("'active' means status active and not past expiry", () => {
  assert.match(
    query,
    /case "active":\s*return and\(\s*eq\(sellerSubscriptions\.status, "active"\),\s*gte\(sellerSubscriptions\.expiresAt, now\)/
  );
  assert.match(query, /effectiveStatus:/);
});

test("page handles unknown packages and links from the package list", () => {
  assert.ok(existsSync("app/admin/packages/[id]/page.tsx"));
  assert.match(page, /"PACKAGE_NOT_FOUND"\) notFound\(\)/);
  assert.match(list, /href=\{`\/admin\/packages\/\$\{p\.id\}`\}/);
  assert.match(list, /View sellers/);
  assert.match(content, /Sellers with this package/);
});

test("package_id lookups are indexed", () => {
  assert.match(schema, /index\("idx_seller_subscriptions_package"\)\.on\(\s*table\.packageId,/);
  const m = read("drizzle/0037_seller_subscriptions_package_index.sql");
  assert.match(m, /CREATE INDEX IF NOT EXISTS "idx_seller_subscriptions_package"/);
});
