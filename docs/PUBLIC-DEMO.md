# Public demo release — existing Render service

**Existing URL:** https://listproof-e5sp.onrender.com/

The public V3 smoke was rerun successfully on 2026-10-30 after the local V4 release candidate. This page describes the **existing V3 service**. The separate V4 staging plan is in [V4 operations](V4-OPERATIONS.md); no V4 public endpoint has been deployed.

The service uses the existing Render Free Docker deployment. The repository Blueprint disables automatic deployment, so a Git push alone does not prove that V3 is live. Check /api/health for **productVersion: v3**, then run the external smoke command. Until both pass, the hosted URL may serve the prior interface.

## Release gates

From Windows PowerShell in the repository:

~~~powershell
npm.cmd run check
cd cre/listproof
bun run typecheck
cd ../..
docker build --pull -t listproof-v3:local .
docker run --rm -p 4203:4173 listproof-v3:local
~~~

In another terminal, smoke the local container:

~~~powershell
npm.cmd run smoke:public -- http://127.0.0.1:4203/ --allow-http-local
~~~

The smoke command checks V3 assets, health/version, both datasets, V1 and legacy screening/verification APIs, four proof outcomes, saved Sepolia and CRE evidence, a fresh Registry read status, and absence of privileged routes. A read-only RPC outage returns **unavailable** and must not be described as a successful live read.

## Deploy to the existing service

1. Push the tested master commit to the existing GitHub repository. Do not create a second Render service.
2. In the owner's Render dashboard, open the existing ListProof service at the URL above and choose **Manual Deploy → Deploy latest commit**. Confirm the selected commit hash matches the tested GitHub HEAD. This requires the owner's authenticated Render session; no Render token is stored in this repository.
3. Wait until Render reports a healthy deploy. Check https://listproof-e5sp.onrender.com/api/health for **productVersion: v3** and **caseStorage: browser-local**.
4. From an independent network, run:

~~~powershell
npm.cmd run smoke:public -- https://listproof-e5sp.onrender.com/
~~~

5. Open Overview, Address screening, Cases, Proof explorer, On-chain registry and Chainlink CRE in a normal browser. Capture the actual deployed screens for the video. If the release fails, use Render's deploy history to redeploy the previous working commit; do not rewrite Git history.

## Public image and data boundary

The Dockerfile copies only the Node proof API, public web assets, synthetic JSON fixtures, curated Sepolia summary and two saved CRE logs. It runs as an unprivileged user. It does not include the local MetaMask deployment UI, deployment server, keys, wallet configuration, Foundry build cache, or administrative endpoints. Publication and signing routes return 404. The API sends CSP, nosniff and no-referrer headers, omits cross-origin access and limits requests per socket address.

Screening, proof generation and independent verification are real, but use bundled synthetic fixtures. The Registry status page can make a fresh **read-only** Sepolia RPC query. The saved Gate calls and mined publication transaction are separately labeled evidence. The CRE page presents official **local simulation** logs; it does not run a DON job on every page view.

Cases use browser-local storage. Render Free filesystem persistence is not relied on. Cases survive ordinary page reloads in the same browser but can be cleared or edited by its owner and are not multi-user audit records. Export a bundle before clearing browser data. A production shared case service would require durable storage and real authentication.

Render Free may sleep after inactivity; allow for a cold start during judging. The server reads the host-provided PORT and binds to 0.0.0.0 inside Docker. No wallet, RPC secret or CRE credential is required for the public service. A custom HTTPS Sepolia RPC URL can be set by the owner as LISTPROOF_SEPOLIA_RPC_URL if the default public RPC is unreliable; it must not be committed.
