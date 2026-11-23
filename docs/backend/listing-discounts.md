# Seller cancellation and listing-fee discounts

## Product policies

- Existing `settings:manage` authorizes management, enforced in Server Actions
  and server modules. This does not grant a new role or permission.
- Cancel one seller's assignment, never the shared definition. Require a
  reason and explicit acknowledgement. Repeat cancellation is idempotent.
- Cancellation stops new unused benefits at transaction commit. Existing live
  listings, used featured periods and completed payments stay unchanged. No
  automatic refund is created. Featured allowance is currently configuration
  only: no existing feature-fee path grants subscription-based featured credits.
- External individual and shop sellers can be assigned discounts. Shops retain
  their existing requirement for an allowance package. A covering allowance
  package takes priority and does not consume discounted credits.
- One active assignment per seller and tier; replacement requires confirmation.
  Replacing or cancelling an assignment does not revoke an in-flight quote.
- Definition edits increment version and affect future assignments only.
  Deactivation prevents future assignments; existing snapshots keep working.
- Discounts affect listing fees only, not commission, featured fees or expiry.
  Existing global pricing stays unchanged. USD amounts are integer cents;
  percentages are basis points. Round the final fee to the nearest cent.
  A 25% reduction of $2.50 yields $1.88 and an actual saving of $0.62.
- Fixed discounts cannot exceed the current regular fee when created/assigned.
  If the fee later falls, cap the reduction at that fee. 100% discounts submit
  for review without a gateway call. 0% is a valid configuration.

## Data and concurrency

Migration `0038_seller_cancellation_and_discounts.sql` adds cancellation metadata
and a persisted `listings_used` counter to `seller_subscriptions`, plus:

| Table | Purpose |
| --- | --- |
| `seller_package_usages` | Unique listing-to-assignment consumption; repeated submission cannot spend twice |
| `listing_discount_packages` | Versioned definitions tied to a tier price range |
| `seller_discount_assignments` | Seller, activation/expiry, frozen terms, assigning and cancelling admins |
| `listing_fee_checkouts` | One logical checkout per listing with original/final fee, discount, payment identity and state |

New tables enable RLS with no browser policies. Only the trusted server database
connection reads/writes them. Supabase anon/authenticated clients must use the
protected web actions or mobile endpoint instead of direct table access.

Seller rows serialize package assignment, per-seller cancellation, package
submission, discount assignment and checkout preparation. Submission also locks
the subscription row so other status updates serialize with consumption.
Checkout and real wallet finalization follow the same seller-first lock order
before checkout/wallet/listing writes, avoiding audit-FK/retry deadlocks.
No transaction spans a gateway network call.
Configuration reads occur before obtaining a transaction connection; eligibility
and usage checks inside the transaction use that connection exclusively. This
prevents pool starvation when concurrent checkout count exceeds pool size.

The migration snapshots the former inferred usage count before switching to
assignment-bound consumption. Historical counts therefore retain the former
semantics (qualifying seller listings since activation), not a reconstruction
of payments. Future consumed credits are not restored by changing listing status.
Legacy qualifying listings receive a usage record for their latest assignment.

Tier identity is the configured price range (`minCents:maxCents`, `*` for no
upper bound). Renaming a tier preserves eligibility; changing its boundaries
fails closed for old assignments. Edit and reassign deliberately to enable the
new range. This avoids silently applying an offer to a different price band.

## Payment lifecycle

`listing-fee-checkout.server.ts` owns both web and mobile listing-fee purchases.
It validates ownership and draft status, recomputes seller-aware pricing,
reserves a discount atomically, snapshots fees and creates a unique gateway key.
Client-supplied fees never determine the charge.

Checkout states count against the assignment limit unless `failed`:

1. `processing`: credit reserved before gateway IO; concurrent requests do not
   call the gateway again for that listing.
2. `completed`: permanently consumed. Repeated requests return the saved amount.
3. `failed`: definitive failure releases the credit; a later attempt re-quotes
   and receives a new internal gateway key. Prior attempts remain in wallet
   payment records and audit logs.
4. `pending_reconciliation`: uncertain result retains its credit indefinitely.
   No timer automatically frees it. A retry can synchronize from the existing
   wallet record; it does not send another charge.

Unknown/malformed gateway responses, transport exceptions, and approved amounts
that differ from the expected amount require reconciliation. Only recognized
terminal failure states release a reservation. An application crash after
reservation can also leave a processing record needing operator review.

Web checkout sends `expectedFeeCents` as a display-agreement check. If the server
re-quotes a different fee, it returns that amount without charging and asks for
confirmation again. Mobile accepts the same optional field and returns the
authoritative `amountCents`, including zero. Native mobile display/reconfirmation
changes require the mobile repository; the existing endpoint remains compatible.

Editing is blocked while payment is processing or uncertain. Completed listing
fee snapshots are retained; discounted paid listings use the original regular
fee for the existing price-tier edit restriction, not the discounted payment.

## Operations and verification

Apply migration 0038 before deploying this code. Prerequisite hand-written
migrations 0032–0037 must already be applied; the Drizzle journal does not track
those migrations. Do not substitute a production schema push for this migration.
The snapshot/journal numbering is aligned at 0038, and `pnpm db:generate` reports
no further schema changes. Back up and pause listing writes during the usage
backfill so it cannot race old application instances.

Never retry an uncertain gateway transfer simply to clear a reserved discount.
Check the gateway using the wallet payment merchant reference. Reconcile the
wallet record through the platform's controlled operations process first; a
subsequent checkout request synchronizes its state. If no wallet row was created,
the checkout's payment key and audit event identify the interrupted initiation.
There is no new automated provider reconciliation worker or operator UI in this
change. Do not delete reservations or roll back payment-aware code while there
are unresolved transfers.

The integration suite is deliberately guarded to a disposable PostgreSQL
fixture at `127.0.0.1:55439/postgres`. It resets fixture tables and must not point
at development business data or Supabase:

```powershell
$env:CELIS_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/postgres'
node --import tsx --test tests/integration/listing-discounts.integration.ts
```

Initialize an empty local fixture with the current schema before the first run.
The suite rebuilds the pre-0038 state and applies the actual migration, then
tests legacy usage backfill, permissions, idempotency, simultaneous last-credit purchases, cancellation
races, expiry, snapshots, failed/uncertain payments, free submissions, replacement,
editing protection and RLS. Gateway calls are replaced by local test doubles.
No live payments or Supabase migrations were performed during implementation.

Local verification on 2026-11-23: 14 PostgreSQL integration checks (including real
wallet/listing/audit persistence with fake provider transport) and 24 focused
unit/regression checks pass; TypeScript and the production build pass. The full unit suite has 120 passes
and three pre-existing failures (obsolete admin category/package route paths and
the public-profile SQL assertion). Drizzle reports no further schema changes.
The UI was checked with disposable fixtures in dark/light themes and at narrow
widths, including calculator rounding and the cancellation acknowledgement gate.
This is not authenticated Supabase end-to-end acceptance. ESLint remains absent
from the repository's installed tooling.
