# Public demo deployment — Render Free Web Service

**Status:** prepared and locally testable; no Render service or public URL has been verified. The owner must authenticate to Render and create the service. Do not add a guessed URL to the README or DoraHacks.

## Why a Node web service

The existing judge UI calls `/api/proof` and `/api/verify`. Those routes use the established Node SHA-256/Buffer proof implementation and its independent verifier. A static host would require a second browser cryptography implementation and new cross-language proof compatibility checks. The current zero-dependency Node server is the fastest credible path. Render's [Web Service guide](https://render.com/docs/web-services) supports public Git repositories and Docker, HTTPS and a host-provided `PORT`. Its [Free plan](https://render.com/docs/free) can sleep after 15 minutes of inactivity; expect about a minute for a cold start.

## Public image boundary

The [Dockerfile](../Dockerfile) copies only `scripts/server.mjs`, `src/core.mjs`, `src/verify.mjs`, the public page, synthetic JSON and two CRE simulation logs. It runs as the unprivileged `node` user. `deploy-server.mjs`, `web/deploy.html`, `web/deploy.js`, wallet UI dependencies, Solidity artifacts, ignored receipts and environment files are excluded. The public server implements no signing, root-publication or evidence-writing route; it returns 404 for those paths. CSP, `nosniff` and `no-referrer` headers are set.

The API proof buttons verify against bundled synthetic fixtures. The Sepolia panel displays the committed, read-only six-case evidence summary; clicking a proof button does **not** make an RPC call or transaction. CRE audit text is an official *local simulation* with a real Registry read, not a live DON write.

## Local Docker release gate

From Windows PowerShell in the repository:

```powershell
npm.cmd run check
docker build --pull -t listproof-demo:local .
docker run --rm -p 4173:4173 listproof-demo:local
```

In another PowerShell window:

```powershell
npm.cmd run smoke:public -- http://127.0.0.1:4173/ --allow-http-local
```

The smoke command checks the page, health, both commitments, dataset, four proof outcomes, six saved Sepolia reads, CRE audit text, security header and absence of five privileged routes. It exits nonzero on failure.

## Owner action: create the free Render service

1. Sign in to [Render](https://dashboard.render.com/). Choose **New → Web Service → Public Git Repository** and enter `https://github.com/chapaevv123/listproof`. This public-repository route does not need GitHub account connection, but Render account authentication is required.
2. Select branch `master`, runtime **Docker**, Dockerfile `./Dockerfile`, and compute plan **Free**. Use a unique service name such as `listproof-demo`; Render assigns the actual `onrender.com` URL. Keep the service public. Set the HTTP health check path to `/api/health`.
3. The Dockerfile already sets `LISTPROOF_HOST=0.0.0.0`. Leave `PORT` at Render's assigned value; `scripts/server.mjs` reads it. Add no wallet, RPC or CRE credentials. The repository also contains [render.yaml](../render.yaml) for a Blueprint deployment if preferred; review its Free plan before applying it.
4. Wait for Render to report a successful deploy and copy the **actual** HTTPS URL. From a separate machine or network, run `npm.cmd run smoke:public -- https://ACTUAL-URL/`. A cold Free service may take about a minute to wake.
5. Open the real URL in desktop and mobile browsers. Click valid, listed, stale and tampered scenarios, open Sepolia explorer links and the CRE audit log. Confirm the URL stays accessible without login or wallet.
6. Only after this passes, add the real URL to the README and [submission draft](SUBMISSION.md). Record the actual deployed demo for DoraHacks.

Render's [free-tier documentation](https://render.com/docs/free) states that inactive services spin down, the filesystem is ephemeral, and included usage has limits. This demo stores no mutable state, so spin-down does not lose proofs. Open the URL before judging to warm it. A cold start or quota exhaustion can still affect availability.

## CRE dataset caution

For a future live CRE workflow, a public URL must serve byte-identical `/dataset/2` JSON with SHA-256 `0xc2517b4c734fa5c5189324244325b5766aa534024c89b4670daf279347ca7a92`. Do not configure a live DON with `localhost`. No live DON deployment is part of this hosting step.
