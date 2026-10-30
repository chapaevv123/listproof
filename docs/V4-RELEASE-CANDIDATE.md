# ListProof V4 release candidate

**Claim:** Prove the evidence, not just the screening result. A valid non-membership witness proves absence from one exact committed dataset version. It does not establish sanctions clearance, source quality, or permission to transact.

## Architecture and scope

The V3 public demo stays available at `/`. V4 adds `/workspace` and authenticated `/api/v2/*` routes when a database is configured. The Node server computes the same domain-separated Merkle commitments and witnesses as V3. Case records, notes, sessions, imports, screenings, and application audit events live in PostgreSQL in production or file-backed SQLite for local development. The production server refuses SQLite-only configuration because ephemeral host disks are not durable.

`src/platform-db.mjs` applies schema migration 1. Dataset versions belong to a workspace except the two shared, explicitly synthetic fixtures. Imported sources start as `imported-unverified` drafts. Owner approval permits local screening; it does not verify provenance or publish a root. The web UI provides a V3 browser-local case replay option: it creates new screenings and cases, notes the prior case ID, and keeps the browser record intact. Historical V3 timestamps and audit events are not represented as server-authored V4 events.

Passwords use salted scrypt hashes. Login is rate limited per address and email; sessions use random, hashed tokens in HttpOnly SameSite cookies. Mutations require a CSRF header. The server derives organization and role from the session and scopes private queries to that organization. Owners may import and approve data; analysts may screen and review; auditors have read-only access. The API has no public signup, API keys, blockchain write, or shell execution endpoint. Application audit events form a hash chain, but a database administrator can rewrite the chain; no external immutability claim is made.

## Run locally and in production

Use Node 22.23 or newer. Set `LISTPROOF_DB_PATH` to an absolute path on a persistent local disk, then run `npm.cmd ci`, `node scripts/bootstrap-owner.mjs` with owner variables from the environment, and `npm.cmd run serve`. Owner bootstrap is one-time and rejects a populated user table. Open `/workspace`. Use unique credentials and keep them out of command history and the repository.

For production, provision a persistent PostgreSQL database, set `DATABASE_URL` and `NODE_ENV=production`, run `npm.cmd run migrate:platform`, then run `node scripts/bootstrap-owner.mjs` once before allowing users in. Production startup does not run migrations automatically. `LISTPROOF_DB_SSL=verify` is the default; `disable` is available only for a trusted private network that cannot negotiate TLS. The owner must arrange backups, retention, and restoration testing. The existing Render V3 service has no PostgreSQL binding and stays on master. Do not point it at local SQLite or treat its ephemeral filesystem as persistent. See the [staging operations runbook](V4-OPERATIONS.md).

## API and evidence

`GET /api/v2/openapi.json` describes the private API. `POST /api/v2/login` returns a CSRF token and cookie; send `X-CSRF-Token` for every mutation. Screenings, batches (100 rows maximum), case lifecycle, notes, reverification, dataset import and approval are supported. JSON case bundles and human reports are browser exports. The proof inspector ignores the receipt's claimed verdict and verifies its witness against a selected stored commitment.

The official CRE workflow is `cre/listproof/main.ts`. In audit mode it validates fetched dataset bytes, schema, normalized addresses, count, provenance, dataset ID, epoch, content hash and Merkle root, then reads the finalized Sepolia Registry epoch, root, dataset ID, content hash and count. V4 adds a public-HTTPS audit target, structured check receipts and classified failures; [new evidence](CRE-V4-FEASIBILITY.md) is separate from the original logs. No verified live DON deployment or CRE on-chain write exists. The public Registry endpoint is a separate read-only RPC observation; the epoch-1 publication transaction predates V4.

## Verification and release gate

Run `npm.cmd run check`, `bun run typecheck` in `cre/listproof`, `docker build -t listproof:v4-rc .`, and the Foundry command in the README. With a local server on port 4173, run `powershell -NoProfile -File scripts/run-cre-simulations.ps1`. Check every CLI exit and matching log text. `node scripts/browser-v4-smoke.mjs` checks login, screening, case notes, reverification, proof inspection and mobile width in headless Chrome and writes [desktop](assets/v4-workspace-local.png) and [mobile](assets/v4-workspace-mobile.png) screenshots. Dataset import is covered by the Node tests. A local Docker PostgreSQL integration test runs with `LISTPROOF_TEST_DATABASE_URL` and `LISTPROOF_DB_SSL=disable`. Before production, add hosted PostgreSQL connectivity, backup/restore exercise, and a security review of deployment configuration.

## Demo script and submission outline

1. Show V3's public synthetic proof and its exact dataset-bound claim.
2. Sign in to V4 and screen a synthetic address. Display the witness, commitment and independent check.
3. Create a case, add a review note, change status, reverify, and export the case bundle.
4. Import a synthetic address CSV, inspect normalization, root, content hash and provenance, then approve it for local use.
5. Show the official CRE audit log with a finalized Sepolia Registry observation and one stale or tampered negative simulation. State clearly that this is local CLI simulation, with no live DON or transaction.
6. Close with the trust boundary: a correct proof says nothing about whether the underlying source is authoritative or current.

For DoraHacks, use the repository, public V3 URL, contract addresses, CRE evidence paths and this script. Describe V4 as a locally validated release candidate until hosted PostgreSQL, browser verification and deployment are complete. Do not submit a live DON claim.
