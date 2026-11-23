# Seller assignment cancellation and listing-fee discounts

Status: Implemented locally after the user's instruction to implement the plan;
Target migration/deployment verification and live gateway acceptance remain pending.
Source: `Celis_Combined_Feature_Requests.pdf`, 21 Nov 2026,
and the two supplied UI references. Document examples are illustrative prices,
not instructions to overwrite configured pricing. Preserve Celis design tokens.

## Baseline code and integration points (before implementation)

- `sellerSubscriptions` in `app/db/schema/seller-packages.ts` supports cancelled
  status but has no dedicated cancellation actor/time/reason fields.
- Package reassignment and global package deactivation already cancel rows;
  the new per-seller action must not call the global deactivation operation.
- Eligibility reads active subscriptions, but submission checks and listing
  writes are separate. Cancellation and consumption need a shared transaction
  and lock discipline, not only a UI action or another eligibility check.
- Existing package usage is inferred from seller listings since activation,
  rather than an assignment-bound consumption ledger. Review its suitability
  for race protection and historical reporting before choosing the migration.
- `seller-pricing.server.ts` is the seller-aware pricing entry point;
  `config.server.ts` owns baseline pricing. The web wizard, server actions,
  mobile listing-fee endpoint and payment finalization must agree.
- `payments.server.ts` records payment attempts and idempotency, then invokes
  the external gateway. Its amount validation rejects zero-value payments.
- Featured allowance exists in package configuration; audit actual featured
  benefit consumption before claiming cancellation covers that path.

## Phase 1: Cancel an individual seller package

1. Add cancellation metadata through a Drizzle migration: actor, timestamp,
   validated reason and optional notes. Audit assignment/seller/package IDs,
   previous status and the consequence. Preserve assignment/payment history.
2. Add a validated Server Action with server permission enforcement. Cancel
   only the requested active assignment. Repeated cancellation returns the
   existing result without another transition or duplicate audit event.
3. Make cancellation and package-benefit consumption serialize on the same
   assignment lock; recheck status, expiry and remaining allowance at write time.
   Handle concurrent submissions and reassignment using a documented lock order.
4. Reuse the package-detail seller table with an Actions column, confirmation
   dialog, reason selection and explicit acknowledgement. Show cancellation
   history in the existing Cancelled/All filters. Retain server pagination.
5. Test authorized/forbidden operations, wrong assignment IDs, repeat requests,
   concurrent usage/cancellation, benefits after cancellation, and isolation
   from other sellers. Define the cancellation boundary as transaction commit.

Proposed policy: no refund; existing listings and already-used featured periods
continue until their original expiry. Unused benefits stop immediately.

## Phase 2: Discount definitions and assignments

1. Add separate discount definition, seller assignment and usage/reservation
   records. Do not overload allowance-based seller packages. Store USD cents
   and percentage basis points, with positive integer duration and limits.
2. Give definitions a stable tier reference. Current tier labels are editable;
   determine a stable identity strategy so renaming/reordering does not silently
   retarget discounts. Preserve configured baseline fees and listing expiry.
3. Snapshot assignment terms and retain definition versions. Record assigning
   actor, activation/expiry and cancellation metadata. Add indexes supporting
   seller eligibility and paginated/filterable assignment queries.
4. Add Discount Packages under listing pricing management: create/edit,
   activate/deactivate, assign selected sellers, view assignments and cancel
   one assignment. Reuse admin table, confirmation and skeleton components.
5. Show a calculator preview using real configured fees. Validate percentages
   in 0–100%, fixed amounts no greater than the eligible regular fee, and a
   nonnegative final fee. Document integer rounding and later fee reductions.

## Phase 3: Checkout and payment correctness

1. Extend seller-aware pricing for matching tier, seller, validity, status and
   remaining discounted credits. Apply one deterministic assignment; never stack.
   A covering allowance package takes precedence and consumes no discount.
2. Return baseline, discount, final amount and eligibility explanation to the
   web preview. Recompute authoritatively for web and mobile payment requests;
   never trust client-provided fees or eligibility.
3. Atomically reserve one discounted credit per logical listing purchase before
   contacting the gateway. Bind the quote/amount to the payment's idempotency key.
   Commit consumption on confirmed success; release only on definitive failure.
   Keep uncertain gateway outcomes reserved until reconciliation; do not expire
   a reservation merely because a timer elapsed while payment may have succeeded.
4. Define retries and in-flight cancellation: an initiated payment preserves
   its original amount; cancellation prevents new discounted reservations.
   Never hold a database transaction open during external gateway requests.
5. Handle a zero final fee through an audited free-submission path, rather than
   calling the gateway with zero. Preserve normal moderation and listing expiry.
6. Persist original fee, applied assignment, discount and final charged amount.
   Completed payment amounts remain immutable after subsequent configuration edits.
7. Test boundary rounding, fixed/percentage discounts, tier mismatch, expiry,
   exhaustion, cancellation, competing assignments, concurrent last-credit
   purchases, idempotent retries, failure/reconciliation and zero-fee submission.

## Adopted policies

The implementation uses the recommended defaults under the user's implementation
instruction: existing `settings:manage`, no refunds or listing/featured-period
revocation, external sellers with shops' existing package requirement retained,
one active discount per seller/tier with explicit replacement, assignment terms
snapshotted at activation, definition deactivation affecting future assignments
only, nearest-cent rounding, 100% free submission, and preserved in-flight quotes.
See `docs/backend/listing-discounts.md` for implemented behavior and verification.

Original questions considered:

- Which administrators may manage each feature: existing `settings:manage`,
  super admins only, or new dedicated permissions?
- Confirm treatment of published listings, used featured periods and refunds.
- Both individual and shop sellers? Keep shops' existing requirement for an
  allowance package, or explicitly introduce pay-per-listing for shops?
- Multiple active discounts per seller/tier? Recommend one active assignment
  per seller/tier, with explicit replacement confirmation.
- Do definition edits affect current assignments? Recommend assignment snapshots;
  edits affect future assignments only. Does deactivation stop future assignments
  only, or also suspend benefits on existing assignments?
- Confirm free submissions at 100% discount, rounding to nearest cent, and
  preserving reserved quotes for payments already initiated before cancellation.

## Delivery and verification

- Implement and verify cancellation separately before integrating discounts.
- Keep schema/data, backend/payment and admin UI changes reviewable; split large
  existing server files into focused modules as needed.
- Update domain, backend/payment, frontend and migration/runbook docs per phase.
  Append SemVer entries; schema/payment/RBAC changes require major entries under
  this repository's policy.
- Generate/review Drizzle migrations and validate in a development database.
  Run focused unit/integration concurrency tests, `pnpm typecheck`, `pnpm build`,
  and lint when its tooling is available. Browser-check both themes, narrow
  screens, confirmation/errors/loading and assignment filtering.
- Verify server payment behavior for web and mobile. Native mobile presentation
  changes, if needed, require the owning mobile repository as a separate scope.
- Do not deploy, charge live payments or apply production migrations as part of
  planning. Record local/test/deployed verification separately.
