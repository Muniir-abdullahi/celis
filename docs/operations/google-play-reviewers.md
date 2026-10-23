# Google Play reviewer access

The web admin is maintained separately at `C:\Users\munii\Herd\celis`.
Both apps must point to the same Supabase project. Customer creation lives in
the web admin; the mobile app contains no service-role credentials.
The Supabase Email provider must be enabled for password sign-in. The web
server needs its existing database and Supabase service-role environment
variables configured; these must never be copied into the mobile app.

## Create reviewer accounts

1. In web admin, open Users → Customers → Create customer.
2. Create a buyer using a dedicated email and a strong password.
3. Enable **Google Play reviewer account**. Phone is optional.
4. Repeat for a seller (individual or shop; shop name required).
5. Keep the passwords in a password manager. They are not returned, logged,
   embedded in the app, or stored in documentation.

The server requires `users:manage`, creates a confirmed-email Supabase Auth
identity, sets `app_metadata.play_reviewer = true`, and transactionally creates
the customer/profile records. The seller receives a seller number. If the local
transaction fails, the newly created Auth identity is deleted; cleanup failures
identify the orphan for administrator follow-up. Duplicate email errors never
overwrite existing users. Customer creation is audited without passwords.

Reviewer accounts have ordinary customer permissions and RLS. They do not gain
staff access, seller verification, listing approval, payment waivers, or payouts.
Do not use real payment accounts for review. Listing submission still follows
the normal payment and moderation flow; prepare approved sample listings for
the seller separately and document any payment restrictions in App access.

## Mobile sign-in

Profile → Sign in or create account → **Sign in with email** → enter the
reviewer's email and password. This is standard Supabase password authentication.
The signed server-owned `app_metadata` flag skips phone onboarding for reviewer
accounts only. Setting `user_metadata.play_reviewer` has no effect. Ordinary
accounts without a phone still follow phone onboarding.

Buyer features: browse, save, and message the prepared seller account.
Seller features: open Sell/seller dashboard, view/manage owned sample listings,
and reply to the buyer. Confirm these paths on the release build before upload.

## Play Console instructions template

Under App content → App access, supply the two emails and passwords securely
and add these instructions (replace placeholders; never commit passwords):

> Open Profile, select Sign in or create account, then Sign in with email.
> Enter the supplied buyer or seller credentials. No phone verification or
> one-time code is required for these accounts. Use the buyer account for saved
> listings and messaging; use the seller account for the seller dashboard and
> listing management. Sign out from Profile/Account before switching accounts.

Credentials remain usable until changed/deleted; normal session token expiry
still applies. Keep both accounts available throughout review. To revoke the
phone-onboarding exception, an authorized operator can set
`app_metadata.play_reviewer = false` using the Supabase server-side Admin API.
Revocation is reflected when the mobile session refreshes its Auth metadata.
Deploy the web changes and include the mobile changes in a new Android build;
local source edits do not update an already-uploaded bundle.
