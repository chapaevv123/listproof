# DoraHacks submission package — draft for owner review

**Project:** ListProof

**Tagline:** Cryptographic evidence that an address is absent from one versioned, committed dataset.

**Primary bounty:** Chainlink — Best workflow with CRE. The [organizer states October 31, 2026](https://bli.tools/international-hackathon-with-ryo-digital-chainlink-labs-focuses-on-ai-payrails-stablecoins-more/) as the submission date. Bounty criteria and the exact DoraHacks cutoff time still require confirmation in the live form. Do not submit this draft without owner approval.

**GitHub:** https://github.com/chapaevv123/listproof

**Public demo:** Not verified. Local demo: `npm.cmd run serve`, then `http://127.0.0.1:4173`.

**Video:** Not recorded or uploaded.

## Short summary (about 150 words)

ListProof makes a narrow address-screening claim independently checkable: an EVM address is absent from one specified synthetic dataset at one epoch. The dataset is canonicalized into a sorted, domain-separated SHA-256 Merkle tree. A non-membership witness authenticates the nearest committed addresses and proves their ordering and adjacency. A JavaScript verifier and a Solidity Gate independently reject listed addresses, forged witnesses and stale epochs. A publisher-controlled Registry stores the current commitment on Ethereum Sepolia; its epoch-1 publication is a real mined transaction. Six read-only Gate calls, including positive and negative cases, have been captured. A Chainlink CRE workflow retrieves the pinned dataset, checks its byte hash, schema and Merkle root, reads the actual Sepolia Registry in official local simulation, and prepares an audit report. This is reproducible CRE simulation, not a live DON deployment or an on-chain CRE write. The demonstration uses only synthetic addresses and makes no legal or sanctions-compliance assertion.

## Technical description (about 370 words)

### Problem

A conventional “not on the list” response is hard to audit. It may not identify which source, timestamp or version was checked. An auditor cannot distinguish a valid absence result from a response generated against a stale or incomplete dataset. ListProof addresses the cryptographic part of this problem by committing a precisely identified set and producing independently verifiable evidence for a specific query.

### Architecture and innovation

The synthetic JSON dataset has a chain ID, dataset ID, epoch and address list. The adapter normalizes each EVM address to 20 lowercase bytes, sorts the list and rejects duplicates. A SHA-256 content hash pins the exact served JSON. Merkle leaves include a domain byte, chain ID, hashed dataset ID, epoch and address. Internal nodes use a separate domain byte and ordered child hashes. An odd final node is promoted unchanged. This prevents a proof from being silently reused under a different chain, dataset or epoch.

For a target between two listed addresses, the prover returns membership witnesses for the immediate predecessor and successor. The independent verifier recomputes both paths, checks strict address ordering and verifies that the indices are adjacent. Boundary proofs authenticate the first or last committed address. The Solidity Gate reads the Registry's current epoch, root and count and applies the same proof logic. Its test-only transfer ledger adds nonce and evidence replay checks. The Registry restricts root publication to its publisher and requires sequential epochs.

### Why CRE

The Chainlink CRE workflow joins the off-chain source and on-chain commitment in one auditable execution. A cron trigger starts an HTTP fetch of the pinned dataset. The workflow validates the response's exact SHA-256 hash, schema, chain/dataset/epoch and recomputed Merkle root. In audit mode it reads the real Sepolia Registry's epoch, root, dataset ID, content hash and count at finalized state and rejects mismatches. It then prepares a signed audit report in the official local simulator. Negative simulations cover stale on-chain state, invalid schema, unavailable data and wrong hash/root. The saved audit log shows the real Registry read. It does not show live DON execution or a CRE transaction; neither is claimed.

### Evidence and limits

Epoch 1 was published on Sepolia in a real transaction. Six read-only Gate `eth_call` scenarios passed at a fixed block. The repository includes 16 Node tests, seven Foundry tests, a curated evidence summary and official CRE logs. The dataset is synthetic. A valid proof establishes absence only from this committed set; source completeness, legal status, identity linkage and future freshness remain outside the claim. The publisher remains a trust assumption.

## Judge walkthrough

1. Read the one-sentence claim and the synthetic-data limitation in the README.
2. Run the local demo. Verify synthetic address `0x0000000000000000000000000000000000000006`; inspect neighbors `...05` and `...09` and the local proof receipt.
3. Try listed `...05`, stale epoch and tampered proof; each must reject.
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

- Public demo URL: pending hosting and external HTTP verification.
- Video URL: pending genuine recording and upload.
- Official bounty eligibility and exact cutoff time: verify in the actual DoraHacks form before submission.
- No RYO-CHAN autonomous-agent bounty claim is made.
