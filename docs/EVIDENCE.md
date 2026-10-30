# Evidence index — 2026-10-30

## V4 continuation evidence

The V4 branch adds an [official CRE simulation against the public HTTPS fixture](../evidence/cre-public-audit-settings.txt), [eight rerun target logs](../evidence/) with `-v4` suffix, and a [classified bad-hash rejection](../evidence/cre-v4-bad-hash.txt). The earlier CRE logs below remain historical evidence. The new audit is still **local official CLI simulation**, not live DON execution. The [V4 feasibility report](CRE-V4-FEASIBILITY.md) lists exact prerequisites.

Local V4 evidence: [desktop screenshot](assets/v4-workspace-local.png), [390 px mobile screenshot](assets/v4-workspace-mobile.png), [case workbench](assets/v4-case-workbench-local.png), [CRE operations](assets/v4-cre-operations-local.png), PostgreSQL lifecycle test in `test/platform-postgres.test.mjs`, and [staging/backup runbook](V4-OPERATIONS.md). These do not prove a public V4 deployment.

Every status below names the evidence class. A local simulation, a read-only RPC call and a mined transaction are different events.

| Class | Claim | Public source / reproduction | Status |
|---|---|---|---|
| **ONCHAIN_TRANSACTION** | Registry and Gate deployed; epoch 1 published | [Registry](https://sepolia.etherscan.io/address/0x1607Af4E1DA1C06362871443d2e95C367B984Efa), [Gate](https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3), [publication receipt](https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d) | PASS |
| **ONCHAIN_READ** | Six Gate `eth_call` cases passed at fixed block 12026859 | [Curated JSON](../data/sepolia-public.json); original calldata/results in ignored `evidence/sepolia-proof-calls.json`; rerun `npm.cmd run onchain:proofs` | PASS, saved read-only evidence |
| **OFFICIAL_CRE_SIMULATION** | Pinned dataset validation and actual Sepolia Registry audit matched epoch 1; report prepared, no transaction | [Audit log](../evidence/cre-onchain-settings.txt), [workflow source](../cre/listproof/main.ts), [config](../cre/listproof/config.onchain.json) | PASS, local simulation |
| **OFFICIAL_CRE_SIMULATION** | Local and seven other targets: on-chain stale, bad hash, bad root, local stale, invalid schema, unavailable source | [CRE log files](../evidence/), `scripts/run-cre-simulations.ps1` | PASS, saved logs |
| **LOCAL_TEST** | 28 Node tests passed, one PostgreSQL integration skipped in default run; generated fixture and syntax checks | `npm.cmd run check` | PASS, rerun 2026-10-30; PostgreSQL integration runs separately with `LISTPROOF_TEST_DATABASE_URL` |
| **LOCAL_TEST** | Seven Solidity tests | Docker Foundry `test --via-ir --optimize -vvv` | PASS, rerun 2026-10-30 |
| **LOCAL_TEST** | Bun TypeScript typecheck | `cd cre/listproof; bun run typecheck` | PASS, rerun 2026-10-30 |
| **PREPARED_ONLY** | Receiver contract and publisher-transfer workflow | `contracts/ListProof.sol`, `cre/listproof/main.ts` | No receiver deployed |
| **LOCAL_TEST** | V3 browser flow: screening, case status/note, reverify, receipt import, forged receipt rejection and navigation | [Browser smoke script](../scripts/browser-smoke.mjs), real headless Chrome; [390px screenshot](assets/v3-mobile-local.png) | PASS, local only; 390px viewport and document width both 390px |
| **LOCAL_TEST** | Render-compatible Docker image and public smoke against local container | [Dockerfile](../Dockerfile), `npm.cmd run smoke:public -- http://127.0.0.1:4203/ --allow-http-local` | PASS; fresh Registry RPC online inside container |
| **OFFICIAL_CRE_SIMULATION** | V3 count/provenance-pinned audit compiled and completed with real Sepolia Registry read at block 12027310 | [Separate V3 CLI capture](../evidence/cre-v3-onchain-settings.txt) | PASS in CLI output; PowerShell capture wrapper returned 1 because CLI initialization was written to stderr |
| **LOCAL_TEST** | Genuine local V3 UI screenshots | [Overview](assets/v3-overview-local.png), [screening](assets/v3-screening-local.png) | PASS, initial UI states |
| **PUBLIC_SERVICE** | Stable V3 remains available separately from V4 | [Existing Render URL](https://listproof-e5sp.onrender.com/), [release runbook](PUBLIC-DEMO.md), [recording script](DEMO.md) | Live V3 smoke must be rerun before release; V4 has not been deployed |

The canonical synthetic epoch-1 commitment is dataset ID `0xa911b05f7ffdc54a7c72dfc23ca6f7ccaa8e15eec7af7c2ef1215254db6ff9ed`, root `0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888`, content hash `0x847808cb140145db952ee309dc5229106e1923a0499ecd91e07dbe175fb42b57`, count 3. `npm.cmd run preflight` reproduces these from `data/epoch-1.json`.

The original full deployment, publication and Gate RPC reports are intentionally ignored by Git and retained locally. The public summary exports only contract IDs, transaction links and six-case results. On 2026-10-30 a second read-only RPC run reached block 12026924 and all six cases returned expected results, but the command exited 1 because the original proof evidence file already existed. It did **not** overwrite that file or create a new success artifact. The saved block 12026859 is the evidence represented in the public summary.

The CRE CLI logs show a simulated signed audit report. They do not demonstrate DON quorum execution or a live CRE on-chain write. The older `cre-local-simulation.txt` had no Registry configured; the later `cre-onchain-settings.txt` includes the real Sepolia Registry read. The read-only audit and its negative case are separate from the original local target.

The audit target was rerun on 2026-10-30 after the audit-mode Registry guard was added. The direct CLI command exited 0 and observed Sepolia block 12026987. A second CLI run completed and observed block 12026989; [its separate log](../evidence/cre-onchain-rerun-2026-10-30.txt) was captured with PowerShell redirection. That wrapper exited 1 because it treated the CLI's initialization text on stderr as a native command error, despite the log's completed simulation. The original log remains untouched.
