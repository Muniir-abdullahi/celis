import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseFetch } from "../app/lib/supabase/fetch";

const loginUrl = "https://example.supabase.co/auth/v1/token?grant_type=password";
const disconnected = () => new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });

test("retries an interrupted password exchange once and preserves the request", async () => {
  const calls: RequestInit[] = [];
  const response = new Response("ok");
  const transport: typeof fetch = async (_input, init) => {
    calls.push(init!);
    if (calls.length === 1) throw disconnected();
    return response;
  };
  const init = { method: "POST", body: JSON.stringify({ email: "test@example.com", password: "test-only" }), headers: { apikey: "test-only" } };
  assert.equal(await createSupabaseFetch(transport)(loginUrl, init), response);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { ...init, cache: "no-store" });
  assert.deepEqual(calls[1], calls[0]);
});

test("does not retry rejected credentials or HTTP errors", async () => {
  for (const status of [400, 401, 429, 503]) {
    let count = 0;
    const request = createSupabaseFetch(async () => { count++; return new Response(null, { status }); });
    assert.equal((await request(loginUrl, { method: "POST" })).status, status);
    assert.equal(count, 1);
  }
});

test("stops after the second transport failure", async () => {
  let count = 0;
  const request = createSupabaseFetch(async () => { count++; throw disconnected(); });
  await assert.rejects(request(loginUrl, { method: "POST" }), /fetch failed/);
  assert.equal(count, 2);
});

test("does not replay account writes, refresh tokens, payments, or canceled requests", async () => {
  for (const url of [
    "https://example.supabase.co/auth/v1/signup",
    "https://example.supabase.co/auth/v1/token?grant_type=refresh_token",
    "https://example.supabase.co/rest/v1/wallet_payments",
  ]) {
    let count = 0;
    const request = createSupabaseFetch(async () => { count++; throw disconnected(); });
    await assert.rejects(request(url, { method: "POST" }));
    assert.equal(count, 1);
  }
  let count = 0;
  const request = createSupabaseFetch(async () => { count++; throw disconnected(); });
  await assert.rejects(request(loginUrl, { method: "POST", signal: AbortSignal.abort() }));
  assert.equal(count, 1);
});

test("auth reads recover from a single transport failure", async () => {
  let count = 0;
  const request = createSupabaseFetch(async () => {
    if (++count === 1) throw disconnected();
    return new Response(null, { status: 200 });
  });
  assert.equal((await request("https://example.supabase.co/auth/v1/user")).status, 200);
  assert.equal(count, 2);
});
