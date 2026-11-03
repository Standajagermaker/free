# Feel Free 2 — access-control review and deployment

Review date: 2026-11-03. Base commit: db5ef6c8579242e2b180661a5aa6ef4c4d55fb84.
Repository: https://github.com/Standajagermaker/free

## Confirmed and unconfirmed findings

| Finding | Evidence / status |
| --- | --- |
| Client-side password authorization | Confirmed in original app/page.js: readReplies compares user input with ad.password. This is not an access-control boundary. |
| Client attempts to fetch password-bearing records | Confirmed: both home and statistics use ads?select=*. A functioning client-side password comparison requires the password to reach the browser. Actual live returned data has NOT been observed. |
| Client reads responses directly | Confirmed code path: anonymous REST reads include both messages and contacts; counts also query responses directly. Whether deployed grants/RLS permit private rows is UNCONFIRMED. |
| Missing database policy evidence | Repository has SQL for pay_requests/pay_votes/pay_images, but no original schema, grants, policies or views for ads/responses. No database-management credentials are available in this session. |
| Actual password/private reply disclosure | NOT CONFIRMED. The live read-only probe was blocked before execution by automatic approval review because of a target-domain mismatch. No live response body was obtained and no live data was modified. Repository homepage is free-one-neon.vercel.app; the reviewer referenced feelfree2.vercel.app. Verify the production domain and project pairing before probing. |
| Framework dependencies | Original Next.js 14.2.3 was obsolete. npm audit also identified advisories after an intermediate 14.2.35 upgrade; the change updates to 16.4.4 and React/React DOM 19.3.1, with a lockfile and async route params. |

## Implemented boundary

The browser calls same-origin Next.js routes for listing, creation, submitting replies and reading replies. It never receives password hashes or stored plaintext passwords. Passwords entered for creation/read are necessarily transmitted over HTTPS to the server; they are never placed in a URL, local storage or returned API object. The read field is masked and cleared on success. Failed reads clear previously displayed replies.

The server uses SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC_) for four narrowly defined PostgreSQL functions. SQL functions are SECURITY INVOKER and executable only by service_role; public/anon/authenticated have no table or column privileges and no RLS policies on ads/responses. Both RLS and grants are enforced. The server exposes no generic table proxy. Listings use explicit public fields, only expose public_contact in public mode, and return aggregate counts without reply identities. Responses have Cache-Control: no-store, private. Internal database errors are not returned to visitors.

Migration replaces plaintext passwords with salted bcrypt cost-12 hashes using pgcrypto, removes the password column, and keeps legacy short passwords working. New private ads require at least 12 characters and at most 72 UTF-8 bytes. Legacy values longer than 72 bytes abort the transaction rather than being silently truncated. Explicit response_mode='public' alone authorizes public reading; ambiguous legacy modes become secret. Ads without a usable password remain locked; arrange an owner-verified reset privately rather than making them public.

A persistent database budget allows 30 private reads per ad per 15-minute window, across all server instances. Failed attempts commit; correct credentials do not bypass an exhausted budget. The budget is deliberately per ad, so a hostile caller can temporarily block its owner by exhausting it. This is an availability tradeoff. A trusted edge limiter/CAPTCHA can reduce abuse further. Public ad/reply creation remains anonymous as before; anti-spam and storage-abuse controls are outside this change.

## Deployment — do not merge/deploy first

1. In Supabase SQL Editor run supabase/audit_ads_access.sql and retain the results privately. Confirm the real ads/responses column types match the fixture used by the tests (event_date and event_time are free-text fields in this application). Check exposed views and SECURITY DEFINER functions for alternate routes to these tables. Existing out-of-repository views/functions cannot be secured by a source-only review. Review inherited/custom roles as well as anon/authenticated.
2. Back up the database and test this migration against a staging copy with the real schema. The migration is a one-time transaction, not a repeatable setup script. It intentionally fails on incompatible types/dependencies or extension placement. Do not add CASCADE to force it through. pgcrypto must be in the extensions schema.
3. Prepare the new application deployment and set SUPABASE_SERVICE_ROLE_KEY in the hosting provider's server environment for the correct Supabase project. Retain NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for existing unrelated features (uploads, visits, pay voting). Never expose the service-role key to the client or commit it. Use a Node version supported by Next.js 16 (20.9+; tests used Node 24).
4. Put the old site into maintenance. Apply supabase/ads_security.sql FIRST, then deploy the matching application. Old clients temporarily fail closed after SQL changes. Existing policies on these two tables are intentionally removed. Keep other project tables and policies unchanged.
5. Re-run audit_ads_access.sql. With public environment variables set, run node scripts/check-ads-access.mjs. Direct ads/password_hash/responses access must fail for the anonymous role. Independently verify with an authenticated Supabase token as well; do not mistake an invalid key or network error for proof that RLS is safe.
6. Smoke-test the deployed API and UI: list ads and statistics; create a secret ad with a fresh 12+ character password; send a reply; attempt absent/wrong password (403, no replies); correct password (200, only that ad); repeat with a second ad and check isolation. Create a public ad, send a response and read it without a password. Confirm the UI warns that public messages and contacts are visible to everyone. Check Network responses contain neither password nor password_hash, and no response is cached. Confirm storage uploads and visit counting still work with their separate existing policies.
7. Test 31 private reads on a disposable staging ad (429 after the budget). Check another server instance shares the same budget. Do not run this against an active owner's ad. Only end maintenance after the checks pass.

Do not roll back to the old browser-side authorization or restore permissive policies. If deployment fails after migration, keep maintenance enabled while fixing the server configuration. Credentials may have been exposed before this fix if the deployed API was permissive: inspect private logs and arrange password changes/recreation of affected ads as appropriate. A hash migration alone does not invalidate a password someone has already learned. Backups containing legacy plaintext also need restricted access and normal retention controls.

## Verification and limits

npm test executes the actual migration and pgcrypto inside embedded PostgreSQL (PGlite), starting with deliberately permissive grants and RLS policies. It verifies direct SELECT/write/RPC denial for anon and authenticated, removal of the plaintext column, hash-only storage, safe listings/counts, correct/wrong/absent passwords, legacy short passwords, unknown modes, missing/cross-ad passwords, public reads, new ad/reply insertion, and persistent budget/reset behavior. Actual route handlers are exercised against these database functions with a REST transport adapter. API tests cover oversized/malformed/cross-origin requests, validation, no-store and suppression of backend errors.

These are real PostgreSQL function/privilege tests against a representative schema, not proof of the deployed Supabase configuration. Supabase/PostgREST integration and browser smoke tests against the actual deployment remain required. No production credentials, RLS changes, password resets or deployment were performed in this session.

Reference: https://supabase.com/docs/guides/api/securing-your-api and https://supabase.com/docs/guides/database/postgres/row-level-security . Service-role credentials bypass RLS; protect them as server secrets. The scoped RPC allowlist, fixed parameters and database permissions are deliberate.
