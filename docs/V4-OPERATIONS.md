# V4 staging and production operations

This runbook applies to the `feat/listproof-v4-platform` branch. The public V3 service remains on `master` and its existing `render.yaml`. `render-v4-staging.yaml` is an **optional separate service definition**; it has not been imported or deployed. Do not use Render's ephemeral web filesystem for SQLite case storage.

## Required configuration

| Variable | Scope | Rule |
|---|---|---|
| `DATABASE_URL` | V4 server, migration, bootstrap | Secret PostgreSQL connection URL. Use a persistent database with backup and restore capability. Never commit or print it. |
| `NODE_ENV` | V4 server | `production` for staging and production; enables Secure session cookies and disables automatic migrations. |
| `LISTPROOF_REQUIRE_DATABASE` | V4 server | `1` to fail startup if `DATABASE_URL` is absent. |
| `LISTPROOF_DB_SSL` | V4 server and jobs | `verify` by default. Use `disable` only on a trusted private network where TLS is unavailable. |
| `LISTPROOF_HOST` | V4 server | `0.0.0.0` on a container host. |
| `PORT` | V4 server | Hosting platform supplies it; local fallback is 4173. |
| `LISTPROOF_OWNER_EMAIL`, `LISTPROOF_OWNER_PASSWORD` | One-time bootstrap only | Owner credentials; password 12–256 characters. Remove from the environment after bootstrap. |
| `LISTPROOF_ORG_SLUG`, `LISTPROOF_ORG_NAME` | One-time bootstrap only | Workspace identity. Defaults are `listproof` and `ListProof Workspace`. |
| `LISTPROOF_SEPOLIA_RPC_URL` | Optional server read | HTTPS Sepolia RPC for read-only Registry observation. |
| `LISTPROOF_RATE_LIMIT` | Optional server | Integer 1–1000 requests per minute per socket address; default 300. |

`LISTPROOF_DB_PATH` is for local SQLite development only. The production server rejects it without `DATABASE_URL`. The staging smoke script accepts optional `LISTPROOF_STAGING_EMAIL`, `LISTPROOF_STAGING_PASSWORD`, and `LISTPROOF_STAGING_ORG_SLUG` for an authenticated read-only check; omit these to test public and unauthorized paths only.

## Controlled setup

1. Provision a separate persistent PostgreSQL database and verify its external or private network connectivity, TLS mode, backup schedule, retention and restoration path. No hosted database or paid resource is provisioned by this repository.
2. Push the reviewed V4 branch. Create a **new** staging web service from that branch or import `render-v4-staging.yaml` only after checking the provider's current plan and database terms. Leave the V3 service and its master branch untouched. Keep automatic deploy off.
3. In a trusted environment with `DATABASE_URL`, `NODE_ENV=production`, and `LISTPROOF_DB_SSL`, run `npm.cmd run migrate:platform` once. This applies migration 1 under a PostgreSQL advisory lock; the production server refuses a missing or unsupported migration. Review the logged version and timestamp, not the connection URL.
4. In the same trusted environment, supply owner variables and run `node scripts/bootstrap-owner.mjs` once. It rejects a populated user table. Remove `LISTPROOF_OWNER_PASSWORD` from the runtime environment after this step.
5. Start staging with `NODE_ENV=production`, `LISTPROOF_REQUIRE_DATABASE=1`, and `DATABASE_URL`. `/api/health` must return HTTP 200 with `productVersion: v4-rc`, `caseStorage: postgres`, and `privateWorkspaceEnabled: true`. On connection or migration failure it returns 503 or fails startup.
6. Run `npm.cmd run smoke:staging -- https://STAGING_HOST/`. Optional authenticated smoke uses the three `LISTPROOF_STAGING_*` variables and logs no credential values. Then run the full browser workflow against staging in an authorized account.

## Backup, restore and rollback

Take a provider-managed snapshot before every migration or release. Verify that backups are encrypted, retained for the owner's chosen period and restorable to a **new isolated database**. A backup is not proven until a restore has been tested. Record the application commit, schema version and backup timestamp together. Keep credentials in the provider's secret store or a protected password file, never in Git, command arguments, terminal transcripts or the demo video.

For a failed V4 application release, redeploy the preceding tested **V4 staging** image/commit and point it at the same database only if its schema version is supported. Do not downgrade a production schema in place. For data recovery, restore the pre-change snapshot into an isolated database, verify case counts and audit event chains, then switch staging after review. The public V3 service needs no rollback because this process never changes it.

## Security limits

The server enforces workspace and role checks, CSRF, session expiry, body size limits and no public privileged blockchain write routes. Application event hashes detect changes to event rows only; administrators can modify the database and recompute hashes. Case status and notes are not externally anchored. A verified non-membership proof says nothing about legal clearance or whether the source list is complete or current. Imported data stays `imported-unverified` even after owner approval for local screening. A production launch still requires hosting configuration review, backup restoration test, TLS/secret review and external staging smoke.
