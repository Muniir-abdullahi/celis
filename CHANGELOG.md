# Changelog

## [v5.0.0] - 2026-11-23

### Fixed

- Internal staff creation handles Supabase-trigger-created users/profiles with
  transactional upserts and audit logging. Failed setup removes only the newly
  created Auth account; failed cleanup reports the orphan ID for support.
- Staff and role create/edit actions return safe, readable validation and
  operation errors instead of masked production React errors. Staff forms use
  the available internal roles and require confirmation before creation.
- Role creation normalizes and validates keys before insertion, handles
  duplicate-key races, and audits creation/editing in the write transaction.

### Changed

- Role creation/editing now enforce the UI's super-admin restriction on the
  server as well as `settings:manage`. System role domains and assigned-role
  domains cannot change. Role saves and permission saves require confirmation.

## [v4.4.1] - 2026-11-23

### Fixed

- Resolve dependency audit findings with Next.js 16.4.6, Firebase Admin 14.5.1,
  Zod 4.6.7 and patched transitive dependencies. Refresh npm and pnpm lockfiles
  and apply the existing security overrides to both package managers.
- Adapt record schemas and parsed admin query defaults to Zod 4, preserving
  metadata validation and pagination defaults. Add metadata validation tests.
- Review and retain the guarded Next.js global-error build patch for 16.4.6.

## [v4.4.0] - 2026-11-19

### Added

- Admin package detail page at `/admin/packages/[id]`: package settings,
  seller counts, and the sellers assigned to the package (status, listings
  used, period, assigned by, price paid), with status filters, search and
  server-side pagination. Package names and a "View sellers" button link to
  it from `/admin/packages`.
- Migration `0037` indexes `seller_subscriptions (package_id, status,
  expires_at)`.

## [v4.3.0] - 2026-11-18

### Added

- Activity log on the admin listing detail page: that listing's audit events,
  paginated, for staff with `audit:read`.
- New listing audit events: `listing_created`,
  `listing_submitted_with_package`, `listing_fee_paid`,
  `listing_fee_payment_failed` (and feature-fee equivalents).
- `getAdminAuditLogs` accepts a resource filter.

## [v4.2.4] - 2026-11-18

### Fixed

- Sellers with an active package were still shown (and could be charged) a
  listing fee. Individual sellers' packages were ignored entirely, and the
  wizard showed fee tiers and the fee to every seller. An active package now
  covers the fee for any seller type: listings are stored with a $0 fee, the
  wizard shows "covered by your package" with remaining credits, and web and
  mobile listing-fee payments refuse covered listings.

## [v4.2.3] - 2026-11-16

### Fixed (IT report 16 Nov 2026)

- 02 Listing fee: a price outside every tier no longer falls back to the
  Premium tier. Empty prices showed "Premium tier, $2.50" and $1–$9.99
  listings were actually charged $2.50. Unpriced amounts now show a neutral
  "Enter a price to calculate the listing fee" summary, block the Pricing
  step, and are refused by every charging path (`PRICE_OUTSIDE_TIERS`, 422).
  Stale preview replies can no longer restore a cleared fee. The mobile
  listing-fee route returns the real error status instead of 500.
- 01 Color: Color is single-select; the wizard keeps the chip look but one
  click replaces the previous color (radio group). Migration `0036` switches
  existing color fields and keeps one color on listings that saved several;
  the seed is updated.

## [v4.2.2] - 2026-11-15

### Fixed (mobile app compatibility)

- Migration 0034 stored "required when visible" as
  `validation_rules.required`, which the mobile app enforces on hidden fields:
  mobile sellers answering "No" to warranty could not post. It now uses the
  web-only `requiredWhenVisible`; new migration `0035` repairs databases that
  applied the earlier 0034.
- Battery Health is no longer conditional in the seed; mobile only supports
  single exact-match conditions. The seed now rejects comma-list conditions.
- The web stores multi-select as comma-joined strings and booleans as
  "yes"/"no" (mobile's format) and reads both formats, so mobile-created
  listings can be edited on the web and show labels instead of codes. Search
  filters match both formats. 0035 converts older web-format metadata.

## [v4.2.1] - 2026-11-15

### Security

- `createListing` created the listing under a `sellerId` sent by the browser
  without checking it against the session, so a signed-in user could create
  listings as another seller. It now always uses the signed-in user.
- `submitShopListing` accepted any listing id and client `sellerId`, letting a
  user submit another seller's draft for review (and spend a package credit).
  It now uses the signed-in user and checks ownership and `draft` status.
- `getListingImageUploadUrl` required no sign-in and wrote to a client-chosen
  seller folder. It now requires sign-in and uses the user's own folder.
- `fetchSellerListingEligibility` no longer reveals another seller's package
  eligibility; it reads the signed-in user's.
- Added `requireCurrentUser()` in `auth.server.ts`. Old clients that still send
  `sellerId` keep working; the value is ignored.

## [v4.2.0] - 2026-11-15

### Added

- Seller "Edit listing" page at `/listings/[id]/edit`, reusing the listing
  wizard with the same field, condition, warranty and validation rules as
  create. Edit buttons on the seller dashboard and on the listing page.
- `updateListing` server action: owner-only (session user), category locked,
  transactional with row lock and a `listing.seller_edit` audit entry.
- Editing a live or rejected listing sends it back to review. A paid listing's
  price can change only within its paid fee tier (or a cheaper one).

### Changed

- Condition and category-detail validation moved to the shared
  `prepareListingDetails` helper used by both create and edit.

## [v4.1.0] - 2026-11-15

### Added

- Category field sets in `seed-category-fields.ts` for Property (houses for
  sale/rent, apartments, land, commercial), Jobs (full-time, part-time,
  remote) and Services (repair, construction, cleaning, beauty), so these
  categories no longer show phone/item fields. Cars gain a bounded
  "Year of Manufacture"; phone SIM slots are bounded 0–4.
- Battery Health is asked only when the listing condition is used or
  refurbished.
- Conditional `parent_value` accepts a comma-separated list; any one value
  matches.

### Notes

- Data changes apply only after running `pnpm db:seed-fields` (upsert; fields
  no longer listed are not deactivated). Field lists await product approval.

## [v4.0.0] - 2026-11-15

### Changed

- Removed the seller-facing "Listing type" dropdown (Fixed-rate listing /
  Commission on sale) from the listing wizard. `monetizationType` is no longer
  part of the listing input; `createListing` derives it from the admin
  `platform_monetization_model` via `monetizationTypeForModel`, the same rule
  the payment flow already used. Older clients that still send it are ignored.
  Fees were already computed from configuration only, so billing is unchanged;
  existing listings keep their stored type.
- The wizard's "Listing fee tiers" box is hidden when the platform runs
  commission-only, since fixed tier fees do not apply.

## [v3.2.0] - 2026-11-15

### Added

- Migration `0034_conditional_warranty_fields.sql` (hand-applied, with
  `.down.sql`): adds a "Warranty available?" Yes/No field to every category
  with `warranty_months`, and makes "Warranty duration (months)" appear only
  for Yes, as a required whole number from 1 to 120. Existing listings with a
  positive warranty are backfilled to Yes (duration rounded to whole months);
  zero becomes No. No listing values are removed.
- Wizard groups Condition and the warranty questions under
  "Condition & Warranty".
- `seed-category-fields.ts` supports conditional fields (`parentKey`,
  `parentValue`), numeric bounds and validation rules, and seeds the warranty
  pair for phones.

## [v3.1.1] - 2026-11-15

### Fixed

- Removed the duplicate Condition row: `listings.condition` is now the single
  condition source and the `condition` category field is no longer rendered or
  stored as listing metadata.
- Condition is required (client and server) whenever the category, or its
  nearest ancestor, defines condition options, and must be a valid option.
- Subcategories without their own condition list inherit the nearest
  ancestor's options in the wizard and search filters.
- Listing detail shows the condition label (e.g. "Brand New") and falls back to
  legacy `metadata.condition` for older listings.
- Conditional category fields can depend on the listing condition.

## [v3.1.0] - 2026-11-15

### Added

- Category details now resolve from `category_fields` with inheritance:
  subcategories get ancestor fields marked `applies_to_descendants` plus their
  own, with subcategory fields overriding inherited keys.
- Conditional fields (`parent_field_id` / `parent_value`): shown, required and
  stored only when the parent field holds the configured value; stale values
  are dropped when the parent changes and again on the server.
- Numeric field bounds (`min_value`, `max_value`) and whole-number rules
  (`validation_rules.integer`) are validated client- and server-side.

## [v3.0.2] - 2026-11-15

### Fixed

- Listing wizard now renders `single-select`, `multi-select` and `textarea`
  category fields emitted by the `category_fields` sync; previously Condition,
  Region, Brand, Storage, RAM, Color and Battery Health showed a label with no
  input, so values could not be entered and the review showed "—".
- Required category details are validated when leaving the Details step, and a
  failed publish returns the seller to the step with the error instead of
  failing silently on Review.
- Review step and listing detail page hide empty optional fields and show
  option labels (e.g. "Brand New") instead of stored codes.
- `createListing` stores only fields defined for the category and drops blank
  values; listing metadata accepts string arrays for multi-select.
- Search filters render single/multi-select fields as dropdowns and match
  multi-select listings whose stored array contains the chosen value.
- Number fields normalize leading zeros ("012" → "12").

## [v3.0.1] - 2026-10-26

### Fixed

- Render account deletion information in the shared Celis bilingual legal layout.
- Add a public Delete account link to the shared footer Account column.
- Preserve numbered instructions, bullet lists, and semantic warning styles in legal pages.

## [v3.0.0] - 2026-10-23

- Add permission-checked buyer/seller creation under Admin → Users → Customers, including individual/shop profiles, seller numbers, transactional writes, Auth cleanup on failure, and audit events without credentials.
- Add server-controlled Google Play reviewer accounts using standard email/password login; mobile skips phone onboarding for these accounts only. Customer privileges and moderation/payment rules remain enforced.
- Document reviewer setup and Play Console instructions in docs/operations/google-play-reviewers.md.

## [v1.6.14] - 2026-10-17

### Fixed

- Fall back to original listing image URLs when Supabase image transforms fail.
- Explain shop listing-credit requirements beside the disabled publish action
  and link sellers to package support.

## [v1.6.13] - 2026-10-17

### Changed

- Use the supplied `logo-assets/LOGO PNG 1.png` artwork across the shared Celis
  logo component.

## [v1.6.12] - 2026-10-17

### Fixed

- Synced `pnpm-lock.yaml` with the Vercel Analytics dependency in `package.json`
  so Vercel frozen-lockfile installs succeed.

## [v1.6.11] - 2026-10-17

### Fixed

- Replaced the insecure password reset token flow with Supabase Auth recovery
  emails, generic responses, and password updates bound to the recovery session.
- Pointed production recovery emails at the canonical reset page so Supabase
  cannot fall back to the marketplace landing page when APP_URL differs by host.
- Exchange recovery codes in a server callback and update passwords through a
  server action, avoiding reliance on missing public Supabase browser variables.

## [v1.6.10] - 2026-10-17

### Fixed

- Return signup setup failures to the form instead of surfacing a generic
  React server-action error. Allow an authenticated retry to repair missing
  local user/profile records after a partial Supabase account creation.

## [v1.6.9] - 2026-10-17

### Fixed

- Added Celis phone, email, and Mogadishu address to the shared site footer.
- Allowed buyers and sellers to use any valid Somali wallet number for web and
  mobile payments, independent of their registered profile number.

## [v1.6.8] - 2026-10-16

### Fixed

- Retry one interrupted Supabase password sign-in or auth read, with uncached
  requests and safe network error codes for diagnosing repeated timeouts.

## [v1.6.7] - 2026-10-16

### Fixed

- Returned clear sign-in errors for Supabase connection failures, invalid credentials,
  rate limits, and unconfirmed emails without throwing expected failures as HTTP 500s.
- Increased the stacked logo size for better readability in navigation and auth screens.

## [v1.6.6] - 2026-10-16

### Fixed

- Prefilled the payment wallet field from the seller profile while allowing a different payer number, with explicit payment-prompt guidance and a lock during submission.
- Replaced shared Celis branding and browser icons with the approved artwork from logo-assets/new.

## [v1.6.5] - 2026-09-28

### Security

- Audited codebase against the Next.js 16.3.6 `ImageResponse` / `next/og` RCE advisory. Confirmed the project runs on the patched Next.js 16.3.6 and does not use `next/og` dynamic SVG image generation.
- Aligned `drizzle-kit` dependency declaration in `package.json` and lockfiles to `^0.31.11`.

## [v1.6.4] - 2026-09-27

### Fixed

- Pinned Vercel's Next.js framework preset in `vercel.json` so deployments
  publish App Router functions and routes rather than only static assets.

## [v1.6.3] - 2026-09-27

### Fixed

- Added a standalone global 404 page and request rendering for the root layout
  to avoid Next.js 16.3.6 crashing while prerendering client providers on
  Vercel.

## [v1.6.2] - 2026-09-27

### Fixed

- Prevented Next.js 16.3.6 from prerendering its synthetic `/_global-error`
  route during Vercel builds. The version-guarded build patch fails loudly if
  Next.js changes its internal route classification.

## [v1.6.1] - 2026-09-27

### Fixed

- Removed the manual root-layout `<head>` that conflicted with Next.js metadata
  rendering during Vercel prerendering. Moved viewport and theme color to the
  Next.js viewport export and retained Inter loading in the global stylesheet.

## [v1.6.0] - 2026-09-27

### Changed

- Fixed potential hydration mismatches by initializing theme state identically
  for SSR and the first client render, and making displayed date and number
  formatting independent of the runtime locale and timezone.
- Began the Next.js migration: the app now builds and runs through Next.js
  16.3.6 on React 19.3.0, with a Next App Router layout, Vercel-compatible
  routing, and the mobile listing-fee Route Handler.
- Converted marketplace server-function modules into Zod-validated Next.js
  Server Actions and moved Supabase SSR cookie handling to Next's request
  context. The existing TanStack client route tree remains as a compatibility
  layer until individual screens are ported.
- Added native App Router home, browse, search, listing detail, shop, sell,
  account, dashboard, admin dashboard, listings and listing detail, categories,
  packages, reports, settings, users, roles, orders, payouts, audit log, seller
  verifications, notifications,
  full
  password recovery, sign-in, sign-up, privacy, and terms pages. Protected
  account, dashboard, notification, and admin routes validate sessions and
  permissions on the server. Home and
  browse load live marketplace data through existing server actions;
  search reads its filters from the URL and renders results on the server. Legal
  pages use the canonical HTML documents. Shared auth, theme, query providers,
  and navigation now use the Next root layout and App Router. Replaced the
  optional route fallback with a required catch-all so Next can serve `/`
  directly.
- Completed the migration to Next.js App Router across marketplace, auth,
  seller, admin, legal, and mobile API routes. Removed the TanStack Router/Start
  route tree, catch-all mount, router-only loading UI, and Vite configuration
  and dependencies. TanStack Query remains for client data caching. Updated
  the App Router, Vercel, and mobile API development documentation.

## [v1.5.0] - 2026-09-02

### Added

- Migration `0033_category_active_flag.sql` adds a non-destructive
  `categories.is_active` flag (all existing rows stay active). Deactivated
  parents and subcategories drop out of browse, search, and the seller listing
  wizard while their listings stay intact; admins still see them.
- Admin Categories: per-row activate/deactivate switch, up/down reorder
  controls, and inline success/error feedback. Deactivating a category that
  still has listings or children asks for confirmation first. `updateCategory`
  now audits `category_status_changed` and `reorderCategory` audits
  `category_reordered`, both with old → new context. The expanded selection is
  preserved across all related actions.
- Admin Packages: Archive (soft-delete) and Delete row actions, both behind a
  confirm dialog that names the package. Delete is a hard delete only when no
  `seller_subscriptions` row references the package; referenced packages are
  blocked and the attempt is audited. Create/edit/status/archive/delete now
  write `audit_logs` events with the actor, timestamp, and old → new values.
- Bilingual Terms of Service at `/terms` (pending qualified legal review).
  Source lives at `public/terms/index.html` and is also reachable directly at
  `/terms/index.html`.
- `/privacy` and `/terms` now render inside the standard Celis header/footer
  shell with an English / Somali toggle (`LegalDocument` +
  `parseLegalDoc`), instead of as bare standalone HTML documents. The privacy
  body is still pulled from the generated `public/privacy/index.html`, so it
  stays the single source of truth.
- Sign-up now shows "By creating an account, you agree to Celis's Terms of
  Service and Privacy Policy" under the submit button, linking both pages.

### Fixed

- Admin Packages: the edit-dialog Active switch is now driven by freshly
  loaded data instead of a stale snapshot, routes through a confirmation, and
  reports success/failure. Required-field validation now surfaces on save.
  Mutating actions are gated on the `settings:manage` permission in the UI.
- The footer Privacy link 404'd: the trailing-slash `/privacy/` redirected to
  `/privacy`, which had no route and no static match. Added `app/routes/privacy.tsx`
  and `app/routes/terms.tsx`; the footer now links to both with `<Link>`. The
  Terms link previously pointed at the home page.

## [v1.4.0] - 2026-08-30

- Removed anonymous reads from the `profiles` and `users` base tables and added
  a bounded public marketplace identity RPC containing no contact information.
- Added the generated bilingual policy at `/privacy/` and linked it from the
  public footer.

## [v1.3.0] - 2026-08-25

- Replaced the category card list with an expandable tree that displays nested
  subcategories using hierarchy branches while retaining lazy child loading.
- Added an audited admin-only manual payment override for listings awaiting
  payment; confirmed overrides activate monetization and submit the listing for
  review without creating a fake provider transaction.

## [v1.2.0] - 2026-08-25

- Added a guarded admin renewal action that reactivates paid expired listings,
  records the new expiry, and writes a renewal audit event.
- Reworked category management into a root-category browser with subcategories
  loaded only after selection.
- Scoped Conditions and Fields actions to subcategory rows and added hierarchy
  counts so destructive actions remain safe.

## [v1.1.2] - 2026-08-25

- Corrected direct WaafiPay purchases to use the documented `WEB` channel.
- Allowed definitively failed idempotent payments to retry safely while preserving
  the same ledger record and merchant reference.
- Replaced raw Waafi provider codes with seller-safe payment messages.

## [v1.1.1] - 2026-08-25

- Exposed the local Vite payment API on the LAN for physical-device testing.
- Added credential-safe lifecycle logging for mobile listing-fee requests and Waafi gateway outcomes.

All notable changes to Celis will be documented in this file.

## [v1.1.0] - 2026-08-25

### Added

- Added an authenticated mobile listing-fee endpoint that validates Supabase
  bearer tokens, listing ownership, server-side pricing, and idempotency before
  initiating WaafiPay.
- Added migration `0031_unpaid_listings_stay_draft.sql` to prevent unpaid
  listings from entering review or becoming active.

## [v1.0.1] - 2026-08-25

### Changed

- Reorganized Admin → Settings into five responsive tabs for fees, WaafiPay,
  features and payment methods, listing pricing tiers, and audit information.
- Removed the route-wide settings fetch and added permission-checked,
  section-scoped loading when each tab is selected.
- Replaced the WaafiPay loading message with a form-shaped skeleton, ensured
  successful gateway saves close the confirmation dialog, and added a Fees-tab
  save action.

## [v1.0.0] - 2026-08-25

### Added

- Added an encrypted `payment_gateways` schema and migration for server-managed WaafiPay credentials.
- Added audited Admin → Settings configuration for sandbox/production endpoints, enablement, timeouts, and masked credential replacement.
- Added a server-only Waafi `API_PURCHASE` client with Somali wallet normalization, bounded timeouts, and strict approval parsing.
- Replaced the simulated listing-fee approval path with a real server-initiated Waafi purchase and atomic payment/listing transition.
- Added wallet-payment idempotency, invoice, provider-response, error, and reconciliation fields in migration `0030_wallet_payment_reconciliation.sql`.
- Added focused tests for credential encryption, wallet normalization, and Waafi success-state validation.
- Added `docs/backend/waafi-payments.md` describing configuration, migration, security boundaries, and remaining payment-workflow requirements.

### Security

- Waafi credentials are encrypted with AES-256-GCM using `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` and are never returned to clients or written to audit metadata.
- Provider code `2001` alone is not treated as payment approval; `APPROVED` state and a transaction ID are also required.
- Payment amounts are calculated server-side, returned provider amounts must match, and ambiguous timeouts remain pending reconciliation rather than being marked failed.

## [v0.1.2] - 2026-07-31

### Added

- **FCM Push Notifications**: Firebase Admin SDK integration for remote push notifications.
  - `lib/fcm.ts`: helper module with `sendPushToUser()`, `sendPushToToken()`, and automatic invalid-token cleanup.
  - `scripts/send-test-fcm.ts`: CLI test sender (self-contained, reads `profiles.fcm_token`).
  - `FIREBASE_SERVICE_ACCOUNT` env var (JSON string or file path).
- **Listing approval/rejection pushes**: `approveListing()` and `rejectListing()` now send FCM push notifications to the seller in addition to in-app notifications.
- **Chat message push (DB trigger + job queue)**:
  - Migration `0028_notification_jobs.sql`: `notification_jobs` table + `enqueue_chat_notification()` trigger on `messages` INSERT.
  - `scripts/process-notification-jobs.ts`: background worker that polls `notification_jobs` and sends FCM pushes via Firebase Admin.
  - Push goes to the receiver only. Firebase credentials never exposed to mobile.
- **`fcm_token` column** added to Drizzle `profiles` schema.

### Changed

- Updated `.env.example` with `FIREBASE_SERVICE_ACCOUNT` documentation.
- Updated `docs/fcm-test-sender.md` with usage instructions.
- Added `pnpm cron:process-notifications` and `pnpm notifications:test` scripts.

### Deferred

- Presence-based chat push suppression (pushes currently send even if receiver is viewing the chat).
- Notification preferences gating (toggles exist in mobile UI but pushes always send for now).

## [v0.1.1] - 2026-07-17

### Fixed

- Reduced admin content gutter and removed the centered max-width wrapper so pages use the remaining width when the sidebar is expanded or collapsed.
- Aligned the home route skeleton with the real full-bleed hero layout and changed admin pending UI so static sidebar chrome renders immediately while content loads.
- Fixed search filters duplicate `CategoryListItem` type import that broke Vite React Babel transforms.
- Removed duplicate public header Account/Dashboard actions by keeping them inside the signed-in account dropdown.
- Fixed route loading skeletons so public pages use page-specific placeholders and admin loading keeps the sidebar shell instead of flashing a standalone content skeleton.

## [v0.1.0] - 2026-07-10

### Added

- Added the Celis AI guidance system with `AGENTS.md`, `.ai` rules, product/design/domain context, and documentation scaffold.
- Added marketplace, Drizzle/Postgres, TanStack Start, admin/RBAC, payments/payouts, forms/dialogs/tables, storage, migrations, and listing-expiry documentation.
- Added local project skills for TanStack Start, Drizzle/Postgres, marketplace domain work, admin/RBAC, and payments/payouts.
- Added a shared searchable combobox control and replaced select controls across marketplace and admin forms/filters.
- Added route-level pending skeletons, including admin-specific table skeletons that render inside the admin shell.
- Added an admin listing detail page for moderation review.
- Added a collapsible desktop admin sidebar with persisted icon-only mode.
- Added shared image URL optimization for Supabase Storage render endpoints.

### Changed

- Consolidated narrowly split docs into compact domain, backend, frontend, and operations guides to reduce redundant files.
- Updated the public app header to reduce crowding by moving account actions into a dropdown.
- Improved admin table pagination and removed `page=1` from clean first-page URLs.
- Simplified admin listing filters by removing duplicate status filter controls.
- Changed listing submission success messaging to make pending review clear instead of implying immediate approval.
- Updated dashboard listing links so only active listings link to public detail pages.
- Improved listing card, gallery, and upload image loading states.

### Fixed

- Disabled async buttons while click handlers are pending to reduce accidental duplicate submissions.
- Added confirmation before approving admin listings.
- Fixed admin pending navigation so public appbar/footer skeletons do not appear in admin.
- Fixed admin pending skeleton layout so it no longer creates an extra sidebar offset.
- Fixed admin listing detail routing so `/admin/listings/:id` renders as its own admin page.

### Technical Debt & Notes

- Existing large route/server files are documented as refactor targets and should be split incrementally before more behavior is added.
- Production builds still report large chunk warnings and an existing `audit.server.ts` mixed dynamic/static import warning.
