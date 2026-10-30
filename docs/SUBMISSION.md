# DoraHacks submission package — draft for owner review

## V4 continuation addendum (not submitted)

The V4 branch adds a locally verified private workspace with PostgreSQL migrations, authenticated and role-scoped cases, server-side audit events, batch screening and draft dataset imports. A temporary local PostgreSQL instance passed the server restart and cross-workspace denial test. The public URL below remains V3; no persistent public V4 claim should be submitted until a separate staging endpoint passes [the staging runbook](V4-OPERATIONS.md). The official CRE CLI now also has a [successful public-HTTPS audit simulation](../evidence/cre-public-audit-settings.txt) and structured negative evidence; [live DON deployment is blocked by deploy access](CRE-V4-FEASIBILITY.md). A [135-second V4 shot list](V4-DEMO-SCRIPT.md) is ready, but no V4 video has been recorded. The official-source [assessment](DATASET-SOURCES-V4.md) does not claim live sanctions coverage.

**Project:** ListProof

**Tagline:** Cryptographic evidence that an address is absent from one versioned, committed dataset.

**Primary bounty:** Chainlink — Best workflow with CRE. The [organizer states October 31, 2026](https://bli.tools/international-hackathon-with-ryo-digital-chainlink-labs-focuses-on-ai-payrails-stablecoins-more/) as the submission date. Bounty criteria and the exact DoraHacks cutoff time still require confirmation in the live form. Do not submit this draft without owner approval.

**GitHub:** https://github.com/chapaevv123/listproof

**Public service:** https://listproof-e5sp.onrender.com/ . Confirm `/api/health` reports `productVersion: v3` and run the external smoke test before submitting V3 claims; this service uses manual Render deployment.

**Video:** Not recorded or uploaded.

## Short summary (about 150 words)

ListProof makes a narrow address-screening claim independently checkable: an EVM address is absent from one specified synthetic dataset at one epoch. A sorted, domain-separated SHA-256 Merkle tree authenticates the nearest committed neighbors and their adjacency. The public application generates and independently verifies proofs, saves browser-local cases, supports analyst notes and review status, exports receipts and reports, and rechecks imported evidence. The browser workspace is personal and editable; it is not a durable multi-user audit system. A publisher-controlled Registry holds the epoch-1 commitment on Ethereum Sepolia in a real mined transaction. Six read-only Gate scenarios have been captured. The official Chainlink CRE simulator fetches the pinned dataset, validates hash, schema, provenance, count and root, reads the real Sepolia Registry, and prepares an audit report. This is reproducible simulation, not live DON execution or an on-chain CRE write. The source contains only synthetic addresses; ListProof makes no legal or sanctions-compliance assertion.

## Technical description (about 370 words)

### Problem

A conventional “not on the list” response is hard to audit. It may not identify which source, timestamp or version was checked. An auditor cannot distinguish a valid absence result from a response generated against a stale or incomplete dataset. ListProof addresses the cryptographic part of this problem by committing a precisely identified set and producing independently verifiable evidence for a specific query.

### Architecture and innovation

The synthetic JSON dataset has a chain ID, dataset ID, epoch and address list. The adapter normalizes each EVM address to 20 lowercase bytes, sorts the list and rejects duplicates. A SHA-256 content hash pins the exact served JSON. Merkle leaves include a domain byte, chain ID, hashed dataset ID, epoch and address. Internal nodes use a separate domain byte and ordered child hashes. An odd final node is promoted unchanged. This prevents a proof from being silently reused under a different chain, dataset or epoch.

For a target between two listed addresses, the prover returns membership witnesses for the immediate predecessor and successor. The independent verifier recomputes both paths, checks strict address ordering and verifies that the indices are adjacent. Boundary proofs authenticate the first or last committed address. The Solidity Gate reads the Registry's current epoch, root and count and applies the same proof logic. Its test-only transfer ledger adds nonce and evidence replay checks. The Registry restricts root publication to its publisher and requires sequential epochs.

### Why CRE

The Chainlink CRE workflow joins the off-chain source and on-chain commitment in one auditable execution. A cron trigger starts an HTTP fetch of the pinned dataset. The workflow validates the response's exact SHA-256 hash, schema, chain/dataset/epoch and recomputed Merkle root. In audit mode it reads the real Sepolia Registry's epoch, root, dataset ID, content hash and count at finalized state and rejects mismatches. It then prepares a signed audit report in the official local simulator. Negative simulations cover stale on-chain state, invalid schema, unavailable data and wrong hash/root. The saved audit log shows the real Registry read. It does not show live DON execution or a CRE transaction; neither is claimed.

### Evidence and limits

Epoch 1 was published on Sepolia in a real transaction. Six read-only Gate `eth_call` scenarios passed at a fixed block. The repository includes Node and Foundry tests, a curated evidence summary and official CRE logs. The V3 interface supports browser-local case review and portable evidence exports; it does not claim server-persistent case storage. The dataset is synthetic. A valid proof establishes absence only from this committed set; source completeness, legal status, identity linkage and future freshness remain outside the claim. The publisher remains a trust assumption.

## Judge walkthrough

1. Read the one-sentence claim and the synthetic-data limitation in the README.
2. Open the public service after V3 health and smoke verification. Screen synthetic address `0x0000000000000000000000000000000000000006`; inspect neighbors `...05` and `...09` and download the local proof receipt.
3. Save the result as a browser-local case, add a note, reverify, export a report, then import the receipt into Proof explorer. Try listed `...05`, stale epoch and tampered proof; each must reject.
4. Open the Sepolia Registry, Gate and epoch-1 publication transaction. Inspect the curated six-case `eth_call` summary. These calls sent no transaction.
5. Open `evidence/cre-onchain-settings.txt`. Show the matching Registry observation and the explicit `no transaction sent` status. Open `evidence/cre-onchain-stale-settings.txt` for rejection.
6. Explain that the result concerns one synthetic committed dataset, not legal clearance.

## Direct evidence

- Registry: https://sepolia.etherscan.io/address/0x1607Af4E1DA1C06362871443d2e95C367B984Efa
- Gate: https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3
- Root publication: https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d
- CRE workflow: `cre/listproof/main.ts`; audit log: `evidence/cre-onchain-settings.txt`
- Public evidence summary: `data/sepolia-public.json`
- Reproduction: `npm.cmd run check`, Docker Foundry test command in README, `npm.cmd run onchain:proofs`, CRE runner in README.

## Remaining submission fields

- V3 release verification: pending manual deployment to the existing Render service and external smoke result, unless those steps have been completed and independently checked.
- Video URL: pending genuine recording and upload.
- Official bounty eligibility and exact cutoff time: verify in the actual DoraHacks form before submission.
- No RYO-CHAN autonomous-agent bounty claim is made.
