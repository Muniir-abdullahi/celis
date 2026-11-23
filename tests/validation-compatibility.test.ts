import assert from "node:assert/strict";
import test from "node:test";
import { listingSchema } from "../app/lib/validation";

const metadata = listingSchema.shape.metadata;

test("listing metadata keeps defaults and supported value types after the Zod upgrade", () => {
  assert.deepEqual(metadata.parse(undefined), {});
  const values = { color: "blue", year: 2025, warranty: true, extras: ["case"], other: null };
  assert.deepEqual(metadata.parse(values), values);
});

test("listing metadata rejects unsupported and oversized values", () => {
  for (const value of [
    { nested: { unsafe: true } },
    { description: "x".repeat(2001) },
    { extras: Array(51).fill("case") },
    { extras: ["x".repeat(201)] },
  ]) {
    assert.equal(metadata.safeParse(value).success, false);
  }
});
