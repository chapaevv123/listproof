# Evidence index — 2026-10-30

Every status below names the evidence class. A local simulation, a read-only RPC call and a mined transaction are different events.

| Class | Claim | Public source / reproduction | Status |
|---|---|---|---|
| **ONCHAIN_TRANSACTION** | Registry and Gate deployed; epoch 1 published | [Registry](https://sepolia.etherscan.io/address/0x1607Af4E1DA1C06362871443d2e95C367B984Efa), [Gate](https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3), [publication receipt](https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d) | PASS |
| **ONCHAIN_READ** | Six Gate `eth_call` cases passed at fixed block 12026859 | [Curated JSON](../data/sepolia-public.json); original calldata/results in ignored `evidence/sepolia-proof-calls.json`; rerun `npm.cmd run onchain:proofs` | PASS, saved read-only evidence |
| **OFFICIAL_CRE_SIMULATION** | Pinned dataset validation and actual Sepolia Registry audit matched epoch 1; report prepared, no transaction | [Audit log](../evidence/cre-onchain-settings.txt), [workflow source](../cre/listproof/main.ts), [config](../cre/listproof/config.onchain.json) | PASS, local simulation |
| **OFFICIAL_CRE_SIMULATION** | Local and seven other targets: on-chain stale, bad hash, bad root, local stale, invalid schema, unavailable source | [CRE log files](../evidence/), `scripts/run-cre-simulations.ps1` | PASS, saved logs |
| **LOCAL_TEST** | 16 Node tests, generated fixture and syntax checks | `npm.cmd run check` | PASS, rerun 2026-10-30 |
| **LOCAL_TEST** | Seven Solidity tests | Docker Foundry `test --via-ir --optimize -vvv` | PASS, rerun 2026-10-30 |
| **LOCAL_TEST** | Bun TypeScript typecheck | `cd cre/listproof; bun run typecheck` | PASS, rerun 2026-10-30 |
| **PREPARED_ONLY** | Receiver contract and publisher-transfer workflow | `contracts/ListProof.sol`, `cre/listproof/main.ts` | No receiver deployed |
| **LOCAL_TEST** | Genuine local application screenshot | [Captured desktop PNG](assets/demo-desktop.png) | PASS, initial UI state |
| **BLOCKED** | Public demo and video | [Hosting runbook](PUBLIC-DEMO.md), [recording script](DEMO.md) | No verified URL or video |

The canonical synthetic epoch-1 commitment is dataset ID `0xa911b05f7ffdc54a7c72dfc23ca6f7ccaa8e15eec7af7c2ef1215254db6ff9ed`, root `0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888`, content hash `0x847808cb140145db952ee309dc5229106e1923a0499ecd91e07dbe175fb42b57`, count 3. `npm.cmd run preflight` reproduces these from `data/epoch-1.json`.

The original full deployment, publication and Gate RPC reports are intentionally ignored by Git and retained locally. The public summary exports only contract IDs, transaction links and six-case results. On 2026-10-30 a second read-only RPC run reached block 12026924 and all six cases returned expected results, but the command exited 1 because the original proof evidence file already existed. It did **not** overwrite that file or create a new success artifact. The saved block 12026859 is the evidence represented in the public summary.

The CRE CLI logs show a simulated signed audit report. They do not demonstrate DON quorum execution or a live CRE on-chain write. The older `cre-local-simulation.txt` had no Registry configured; the later `cre-onchain-settings.txt` includes the real Sepolia Registry read. The read-only audit and its negative case are separate from the original local target.

The audit target was rerun on 2026-10-30 after the audit-mode Registry guard was added. The direct CLI command exited 0 and observed Sepolia block 12026987. A second CLI run completed and observed block 12026989; [its separate log](../evidence/cre-onchain-rerun-2026-10-30.txt) was captured with PowerShell redirection. That wrapper exited 1 because it treated the CLI's initialization text on stderr as a native command error, despite the log's completed simulation. The original log remains untouched.
