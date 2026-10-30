# Evidence index — 2026-10-30

## Sepolia deployment and root publication

The owner provided actual Sepolia receipts saved locally in ignored `evidence/sepolia-deployments.json` and `evidence/sepolia-root-publication.json`. The existing localhost verification endpoint rechecked deployment receipts, exact creation input, runtime bytecode and Registry/Gate constructor state through Sepolia RPC. The publication evidence records receipt status, exact `publish(uint256,bytes32,bytes32,uint256)` calldata, `RootUpdated` event, runtime bytecode and post-publication state. These are locally inspected RPC results; Codex's current sandbox could not make a fresh direct Sepolia RPC call.

| Item | Actual value / link |
|---|---|
| Chain | Ethereum Sepolia, 11155111 |
| Registry | [`0x1607Af4E1DA1C06362871443d2e95C367B984Efa`](https://sepolia.etherscan.io/address/0x1607Af4E1DA1C06362871443d2e95C367B984Efa) |
| Gate | [`0xf88F9870fe6e135d5bD56852750c8af8a466A9A3`](https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3) |
| Epoch-1 publication | [Transaction `0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d`](https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d), block 12026768, gas used 461135 |
| Dataset ID | `0xa911b05f7ffdc54a7c72dfc23ca6f7ccaa8e15eec7af7c2ef1215254db6ff9ed` |
| Root | `0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888` |
| Content hash | `0x847808cb140145db952ee309dc5229106e1923a0499ecd91e07dbe175fb42b57` |
| Count | 3 synthetic addresses |

The pinned JavaScript fixture recomputes the dataset ID, root, content hash and count. `data/sepolia-public.json` exports the public addresses, links and current check statuses for the demo without including local files or signing endpoints.

## Checks executed by Codex in this revision

| Check | Status | Result |
|---|---|---|
| `npm.cmd run check` | **PASS** | 16 Node tests, 0 failed; syntax and generated Solidity fixture match |
| `npm.cmd run demo` | **PASS** | Clean, listed, stale and tampered local proof scenarios behaved as expected |
| `npm.cmd run preflight` | **PASS** | Canonical epoch-1 root, content hash, dataset ID and count reproduced |
| `npm.cmd run public:evidence` | **PASS** | Curated summary generated; `proofCheck: not-run` |
| `bun run typecheck` from `cre/listproof` | **PASS** | TypeScript compiler exited 0 |
| PowerShell CRE runner parse | **PASS** | No syntax errors |
| Local HTTP integration | **PASS** | Included in Node test suite; `/api/sepolia` and all four local proof scenarios checked |
| Direct Sepolia Gate `eth_call` suite | **BLOCKED** | RPC access returned `EACCES` in Codex sandbox; no six-case RPC result is claimed |
| Official CRE Registry-read simulation and negatives | **NOT RUN** | CRE CLI absent from sandbox PATH; owner authenticated CLI needed |
| Foundry current build/test | **BLOCKED** | Docker named-pipe access denied in Codex sandbox; owner previously reported six tests passing before later edits |

`evidence/sepolia-proof-calls.json` does **not** exist. Once `npm.cmd run onchain:proofs` passes all six checks from ordinary PowerShell, that command saves fixed-block RPC calldata/results and block hash. `npm.cmd run public:evidence` then updates the public summary. Failed calls cannot produce a success file.

## Chainlink CRE evidence

[The saved official local CRE simulation log](../evidence/cre-local-simulation.txt) was produced in the owner's environment with CRE CLI 1.39.0 and `@chainlink/cre-sdk` 1.21.1. It shows dataset fetch and hash/root checks, a Sepolia block header and a prepared signed report. It explicitly says **“not configured; no onchain read”** and **“no receiver configured, no transaction sent.”** Codex inspected the file; it did not reproduce the CLI run in this sandbox.

`cre/listproof/config.onchain.json` and `config.onchain-stale.json` are new audit targets for the deployed Registry. Their official CLI logs are not yet captured. The [CRE runbook](CRE-RUNBOOK.md) contains the exact commands and expected rejection strings. No CRE receiver was deployed; no DON execution or CRE on-chain transaction is claimed.

## Public submission gates

No Git remote, public GitHub URL, public demo URL or video URL was verified in this workspace. The owner must run the read-only Sepolia proof suite, official CRE audit and negatives, current Foundry suite, then publish the repository/demo/video only with explicit approval. The submission status remains **NO-GO** until judge-accessible links and essential proof evidence exist.
