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
- **Category details (listing metadata):** field definitions live in
  `category_fields` / `category_field_options`; a DB trigger mirrors them into
  `categories.metadata_schema` (also read by the mobile app). Supported types
  are `text`, `textarea`, `number`, `boolean`, `single-select`, `multi-select`
  and legacy `select`; other types (`photo-grid`, `video-link`) are skipped by
  the web form. Select options are stored as values (e.g. `brand_new`) and
  `getCategoryMetadataSchema` attaches `optionLabels` for display.
  `createListing` keeps only keys defined for the category, drops empty values
  and validates required/option rules server-side (`app/lib/category-metadata.ts`).
  Multi-select values are stored as JSON string arrays.
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
- **Warranty:** `warranty_available` (Yes/No) gates `warranty_months`
  (whole number 1–120, required only when Yes); both render in the wizard's
  "Condition & Warranty" group (`CONDITION_GROUP_KEYS`). Neither is implied by
  "Brand New". "Required when visible" uses `validation_rules.required`, never
  the `required` column, because the mobile `validate_listing_fields` RPC
  enforces that column unconditionally and ignores `parent_field_id`.
- **Field sets (`scripts/seed-category-fields.ts`, run `pnpm db:seed-fields`):**
  phones (brand, model, storage, RAM, color, SIM slots 0–4, battery health
  only for used/refurbished, warranty pair); cars (adds year 1950–2027);
  property sale/rent/apartments/land/commercial (region, size, bedrooms,
  bathrooms, furnished, title deed, rent period for rentals); jobs
  (job title, employer, pay period, experience, education — no item fields);
  services (region, pricing, years of experience, home service). Sets are
  seeded per subcategory, not inherited, so the mobile app's per-category
  jsonb mirror sees them. `parent_value` may list comma-separated values
  (any one matches). Product owns these lists.
- Do not pack listing detail, payment, seller, image, and interaction logic into one large route file.

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
- `app/lib/pricing.ts`

Rules:

- Package changes can affect seller access and marketplace revenue.
- Package create/update/status/archive/delete actions require confirmation.
- Keep pricing and package display consistent across seller and admin surfaces.
- Document plan/package behavior changes.
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
