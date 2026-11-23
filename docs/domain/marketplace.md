# Marketplace Domain

This is the compact domain guide for Celis. The full product source is `somalia-p2p-marketplace-prd.md`.

## Core Terms

- **User:** Marketplace account, buyer, seller, admin, or platform staff depending on role.
- **Listing:** Marketplace item/service posted by a seller.
- **Category:** Listing classification. Two-level hierarchy (parent → subcategory).
  `categories.is_active` hides a (sub)category from browse, search, and the
  seller listing wizard without touching its existing listings; admins still
  see inactive rows. Deletion stays blocked while a category has listings or
  child categories.
- **Seller:** User who creates listings and may buy seller packages.
- **Buyer:** User browsing listings and initiating orders/payments.
- **Order:** Transactional record connecting buyer, seller, listing, and payment state.
- **Payment:** Charge or collection event.
- **Payout:** Seller disbursement event.
- **Seller package:** Paid package controlling seller listing capabilities and benefits.
- **Package usage:** Assignment-bound, non-refundable listing credit consumption.
- **Listing discount package:** Versioned percentage/fixed listing-fee offer for one tier.
- **Discount assignment:** Seller-specific frozen terms, validity and eligible-listing limit.
- **Listing-fee checkout:** Original/final fee snapshot and reserved discount usage;
  uncertain payments keep their reservation until reconciled. See
  `../backend/listing-discounts.md` for policies and the table/lifecycle map.
- **Moderation review:** Admin review record for marketplace safety.
- **Audit log:** Durable trace of sensitive platform actions.
- **RBAC:** Roles, permissions, role-permissions, and server-enforced access controls.
- **Platform config:** Admin-managed marketplace settings.
- **Listing interaction:** User behavior such as views, saves, contacts, or similar engagement events.

## Listings

Key files:

- `app/db/schema/listings.ts`
- `app/db/schema/listing-reviews.ts`
- `app/db/schema/listing-interactions.ts`
- `app/server/listings.server.ts`
- `app/server/listings.functions.ts`
- `app/server/listing-interactions.functions.ts`
- `app/listings/[id]/page.tsx`
- `app/sell/page.tsx`
- `app/listings/[id]/edit/page.tsx`
- `app/server/listing-edit.server.ts`, `app/server/listing-edit.functions.ts`
- `app/server/listing-details.server.ts` (condition + details rules shared by create/edit)
- `app/lib/listing-edit.ts`
- `app/search/page.tsx`
- `app/browse/page.tsx`
- `app/components/listings/**`
- `scripts/expire-listings.ts`

Rules:

- Search and browse must use scoped, paginated result sets.
- Listing creation should use Zod validation.
- Uploaded listing images use optimized Supabase URLs with a fallback to their
  original public URL if image rendering fails.
- Shop listing publication requires an active package with remaining listing
  credits; the wizard shows the reason and a support contact when blocked.
- Listing status changes require confirmation and audit consideration.
- Listing expiry behavior belongs in the documented cron path.
- **Seller identity:** seller-scoped server actions (`createListing`,
  `submitShopListing`, `fetchSellerListingEligibility`, `updateListing`,
  `getListingImageUploadUrl`) act as `requireCurrentUser()` and never accept a
  seller id from the client. `submitShopListingForReview` also checks the
  listing belongs to the seller and is still a `draft` before using a package
  credit. Image uploads always go to the signed-in user's storage folder.
- **Seller edit** (`/listings/[id]/edit`, reuses the listing wizard):
  - Editable statuses: `draft`, `pending_review`, `active`, `rejected`.
    Sold, expired, suspended and inactive listings are not seller-editable.
  - The seller is always the signed-in user; other sellers' listings 404.
  - The category is locked (`CATEGORY_LOCKED`).
  - Condition and category details go through `prepareListingDetails`, the
    same validation as create.
  - Editing an `active` or `rejected` listing moves it to `pending_review`
    (hidden until re-approved); a rejected listing that was never paid returns
    to `draft`. Drafts continue into the normal publish / payment flow.
  - Price: once a per-listing fee is paid, the new price may not fall in a
    more expensive fee tier (`PRICE_TIER_CHANGED`); unpaid drafts are re-priced.
    Paid fee snapshots are never changed by an edit.
  - Each save runs in a transaction with a row lock and writes an
    `listing.seller_edit` audit entry (previous/new status, changed fields,
    reason) for moderators.
- **Category details (listing metadata):** field definitions live in
  `category_fields` / `category_field_options`; a DB trigger mirrors them into
  `categories.metadata_schema` (also read by the mobile app). Supported types
  are `text`, `textarea`, `number`, `boolean`, `single-select`, `multi-select`
  and legacy `select`; other types (`photo-grid`, `video-link`) are skipped by
  the web form. Select options are stored as values (e.g. `brand_new`) and
  `getCategoryMetadataSchema` attaches `optionLabels` for display.
  `createListing` keeps only keys defined for the category, drops empty values
  and validates required/option rules server-side (`app/lib/category-metadata.ts`).
  Multi-select values are stored as comma-joined strings and booleans as
  "yes"/"no" (see Mobile compatibility below).
- **Field resolution:** `getCategoryMetadataSchema` builds the field list from
  `category_fields` for the selected (sub)category plus ancestor fields with
  `applies_to_descendants = true` (same rule as the listing RPC). The nearest
  category wins a `field_key`; inherited fields come first. Categories with no
  applicable rows fall back to the nearest legacy `metadata_schema` jsonb.
- **Conditional fields:** `parent_field_id` + `parent_value` become
  `showWhen`. A conditional field is shown, required and stored only while its
  (visible) parent holds that value; booleans match `yes`/`true`, multi-select
  matches if the array contains it. Hidden values are stripped client- and
  server-side. Numeric `min_value`/`max_value` and `validation_rules.integer`
  are enforced. The mobile app still reads the per-category jsonb mirror,
  which does not include inherited or conditional metadata.
- **Listing condition:** `listings.condition` is the only condition source.
  Options come from `category_conditions` of the category or its nearest
  ancestor that defines any; when options exist, a condition is required and
  must be one of them (client and `createListing`), otherwise none is stored.
  A `condition` category field is a reserved key: it is not rendered, stored
  or validated as metadata. Conditional fields may still use
  `parent field = condition` and are evaluated against the listing condition.
  Older listings that only have `metadata.condition` display it as a fallback.
- **Color** is single-select (one value) for every category; the wizard draws
  it as one-click chips (`SINGLE_CHOICE_CHIP_KEYS`), radio semantics.
- **Warranty:** `warranty_available` (Yes/No) gates `warranty_months`
  (whole number 1–120, required only when Yes); both render in the wizard's
  "Condition & Warranty" group (`CONDITION_GROUP_KEYS`). Neither is implied by
  "Brand New". "Required when visible" uses `validation_rules.requiredWhenVisible`
  (web-only), never the `required` column or `validation_rules.required`.
- **Field sets (`scripts/seed-category-fields.ts`, run `pnpm db:seed-fields`):**
  phones (brand, model, storage, RAM, color, SIM slots 0–4, battery health
  (optional, not conditional), warranty pair); cars (adds year 1950–2027);
  property sale/rent/apartments/land/commercial (region, size, bedrooms,
  bathrooms, furnished, title deed, rent period for rentals); jobs
  (job title, employer, pay period, experience, education — no item fields);
  services (region, pricing, years of experience, home service). Sets are
  seeded per subcategory, not inherited, so the mobile app's per-category
  jsonb mirror sees them. Product owns these lists.
- Do not pack listing detail, payment, seller, image, and interaction logic into one large route file.

## Mobile compatibility

The Expo app (`D:\celis mobile`) reads and writes the same Supabase rows
directly (RPC `save_listing_with_fields`, `category_fields`,
`category_field_options`) and calls `/api/mobile/payments/listing-fee`. Shared
data must follow its contract:

- Multi-select metadata: comma-joined string (`"black,white"`).
- Boolean metadata: `"yes"` / `"no"`.
  The web reads arrays/true-false too, but always writes the shared format
  (`serializeMetadataForStorage` in `prepareListingDetails`).
- Mobile validates `required` and `validation_rules.required` on every field,
  hidden conditional ones included. Conditional fields that are required when
  shown must use `validation_rules.requiredWhenVisible` (web-only).
- Mobile shows a conditional field only when the parent value equals
  `parent_value` exactly: use one value, never a comma list. The web's any-of
  matching exists only for web-defined schemas.
- Mobile checks `listings.condition` against the category's `condition` field
  options; the web checks `category_conditions`. Keep both lists aligned.

## Orders

Key files:

- `app/db/schema/orders.ts`
- `app/admin/orders/page.tsx`
- `fig_3_1_order_state_machine.png`

Rules:

- Order state transitions must match the documented state machine.
- Status-changing actions require confirmation dialogs.
- Multi-record order updates should use transactions.
- Admin order tables must paginate/filter on the server.
- Order changes with financial impact must be audit-friendly.

## Payments & Payouts

Key files:

- `app/db/schema/payments.ts`
- `app/db/schema/payment-gateways.ts`
- `app/db/schema/payouts.ts`
- `app/server/payments.server.ts`
- `app/server/payments.functions.ts`
- `app/server/payment-gateways.server.ts`
- `app/server/waafi.server.ts`
- `app/admin/payouts/page.tsx`
- `app/components/listings/payment-modal.tsx`

Rules:

- Financial actions require confirmation dialogs.
- Financial actions should create or preserve audit context.
- Use transactions for multi-record updates.
- Do not hide failures behind generic UI states.
- Never perform payment/payout changes without updating docs and changelog.
- Admin renewal may reactivate an expired listing only when its monetization
  status is active; renewal extends from the current time and is audit logged.
- A manual listing-payment override is limited to `pending_paid` listings,
  requires an administrator reason, moves the listing to `pending_review`, and
  must never create a fabricated wallet-provider transaction.
- Payment-provider credentials are encrypted at rest and decrypted only inside server payment modules.
- Client applications never choose the authoritative fee amount or receive provider credentials.
- **Fee tiers:** `findListingTier` returns the tier containing the price or
  null — there is no fallback tier. An empty price or one below the lowest
  tier's minimum is "unpriced": the wizard shows "Enter a price to calculate
  the listing fee" and blocks Next, and every charging path (`createListing`,
  `updateListing`, `initiatePayment`, the mobile listing-fee route) uses
  `getListingPricing`, which throws `PRICE_OUTSIDE_TIERS` (422).
  `computeListingPricing` (may be unpriced) is only for previews and expiry
  of existing listings. Admins set tier ranges in Admin → Settings → Pricing;
  to accept $1–$9.99 listings, set the first tier's minimum to $1.00.
- Sellers never choose the listing type. `listings.monetization_type` is
  derived on the server from the admin `platform_monetization_model`
  (`monetizationTypeForModel`: `fixed_only` → `fixed_rate`, `commission_only`
  and `hybrid` → `commission`) at creation and re-snapshotted when payment
  starts. Fees come only from `getListingPricing`. Existing rows keep their
  stored value. The wizard shows fixed fee tiers only for `fixed_only` and
  `hybrid`.
- Waafi purchase success requires provider code `2001`, state `APPROVED`, a transaction ID, and amount reconciliation.

## Seller Packages

Key files:

- `app/db/schema/seller-packages.ts`
- `app/server/seller-packages.server.ts`
- `app/admin/packages/page.tsx`
- `app/admin/packages/[id]/page.tsx` (package detail + assigned sellers)
- `app/server/package-subscribers.server.ts`
- `app/lib/pricing.ts`

Rules:

- Package changes can affect seller access and marketplace revenue.
- Package create/update/status/archive/delete actions require confirmation.
- Keep pricing and package display consistent across seller and admin surfaces.
- Document plan/package behavior changes.
- **An active subscription covers listing fees for any seller type** (shop or
  individual). `getSellerListingEligibility` checks the subscription first;
  only sellers without one fall back to their type (individual: pay per
  listing; shop: cannot list). `getSellerListingPricing`
  (`app/server/seller-pricing.server.ts`) stores package listings with a $0
  listing fee (any valid price allowed), and web/mobile listing-fee payments
  refuse covered listings (`LISTING_COVERED_BY_PACKAGE`, 409). The wizard
  shows "covered by your package" with remaining credits instead of fees.
- **Package detail** (`/admin/packages/[id]`, `settings:manage`): package
  settings, counts (active sellers, sellers ever assigned, assignments) and a
  server-paginated table of assignments with seller, status, listings used,
  period, who assigned it and price paid. Filters: active (status active and
  not past `expires_at`), expired (status expired or lapsed active), cancelled,
  all; search by name, business or email. `seller_subscriptions.package_id`
  is indexed (`0037`).
- `listing_packages.is_active` is the enable flag and the archive flag.
  Inactive packages are excluded from `listListingPackages` (seller purchase)
  and rejected by `assignSellerPackage` (admin assignment).
- Deactivating or archiving a package cancels live `seller_subscriptions`
  (status `cancelled`); subscription rows are never deleted so history and
  financial records stay intact.
- `deleteListingPackage` hard-deletes only when no `seller_subscriptions`
  row (active or historical) references the package; otherwise it throws and
  records a `package_delete_blocked` audit event. Referenced packages must be
  archived instead.
- Package `package_created`, `package_updated`, `package_status_changed`,
  `package_archived`, `package_deleted`, and `package_delete_blocked` events
  are written to `audit_logs` with the actor, timestamp, and old → new values.

## Moderation, RBAC & Audit

- **Listing activity log:** `/admin/listings/[id]` shows that listing's
  `audit_logs` (resource `listing`), paginated 10 per page via `?activity=`,
  for staff with `audit:read` (`fetchListingAuditLogs`). Listing events:
  `listing_created`, `listing_submitted_with_package`, `listing_fee_paid` /
  `listing_fee_payment_failed` (and feature-fee equivalents, written in the
  payment transaction, no phone numbers), `listing.seller_edit`,
  `listing_approved`, `listing_rejected`, `listing_status_changed`,
  `listing_renewed`, `listing_expiry_extended`,
  `listing_payment_marked_paid_manually`. Events before 18 Nov 2026 for
  creation/payment were not recorded.


Key files:

- `app/db/schema/listing-reviews.ts`
- `app/db/schema/permissions.ts`
- `app/db/schema/role-permissions.ts`
- `app/db/schema/audit-logs.ts`
- `app/server/admin.server.ts`
- `app/server/admin.functions.ts`
- `app/server/audit.server.ts`
- `app/admin/listings/page.tsx`
- `app/admin/roles/page.tsx`
- `app/admin/audit-log/page.tsx`

Rules:

- Approval/rejection actions require confirmation.
- Record enough context to understand why a moderation decision happened.
- Server-side authorization is the source of truth.
- Role/permission mutations require confirmation.
- Sensitive admin and financial actions should write audit logs.
- Audit log tables must paginate and filter on the server.
