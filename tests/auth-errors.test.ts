import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSignInErrorMessage } from "../app/lib/auth-errors";

test("connection failures offer a retry without exposing provider details", () => {
  for (const error of [
    { name: "AuthRetryableFetchError", message: "fetch failed" },
    { message: "connection timed out" },
    { status: 0 },
    { status: 503, message: "internal provider details" },
  ]) {
    assert.equal(getSignInErrorMessage(error), "Unable to connect to the sign-in service. Please try again in a moment.");
  }
});

test("invalid credentials stay distinct from rate limits and unconfirmed emails", () => {
  assert.equal(getSignInErrorMessage({ code: "invalid_credentials", status: 400 }), "Invalid email or password");
  assert.match(getSignInErrorMessage({ status: 429 }), /Too many sign-in attempts/);
  assert.match(getSignInErrorMessage({ code: "email_not_confirmed" }), /confirm your email/);
  assert.equal(getSignInErrorMessage({ message: "private provider detail" }), "Invalid email or password");
});

test("sign-in form stops before refreshing or redirecting on an expected failure", () => {
  const form = readFileSync("app/auth/sign-in/sign-in-form.tsx", "utf8");
  assert.match(form, /if \(!result.success\)\s*\{\s*setError\(result.error\);\s*return;\s*\}\s*await refresh\(\)/);
  assert.match(form, /role="alert"/);
});
