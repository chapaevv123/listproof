# CRE reproduction and evidence

The pinned local source uses official `@chainlink/cre-sdk` 1.21.1 and is compatible with owner-reported CRE CLI 1.39.0. The saved [local simulation log](../evidence/cre-local-simulation.txt) shows dataset fetch and hash/root validation, a Sepolia header read and a prepared signed report. Its own JSON states **no registry configured, no on-chain read, no receiver configured, no transaction sent**. It is local simulation evidence, not a DON deployment or receipt.

```powershell
cd C:\Users\Win10_Game_OS\Pulse\projects\listproof
npm.cmd run serve
# In a second PowerShell window:
cd C:\Users\Win10_Game_OS\Pulse\projects\listproof\cre\listproof
bun install --frozen-lockfile
bun run typecheck
cd ..\..
powershell -NoProfile -File .\scripts\run-cre-simulations.ps1
```

The runner saves eight logs under `evidence/` and exits nonzero if a positive target fails or a negative target does not show its expected rejection. Targets: local, deployed-Registry audit, on-chain stale epoch, bad hash, bad root, local stale epoch, invalid schema, and unavailable endpoint. These new target simulations have **not** yet been executed by Codex in the current sandbox; the Node adapter tests cover their local equivalents.

For an on-chain read/write, copy `cre/listproof/config.sepolia.example.json` to ignored `cre/listproof/config.sepolia.json`, fill in the actual public dataset URL and verified registry/receiver addresses, then simulate `sepolia-settings`. The workflow checks registry dataset ID, epoch and previous root at a finalized block before preparing a report. Start with simulation and inspect status. Chainlink [CRE overview](https://docs.chain.link/cre/overview) says live DON deployment requires approval. `cre workflow supported-chains` is the appropriate tenant-specific network/forwarder discovery command; no forwarder address is hardcoded here.

CRE report payload ABI is `(uint256 chainId, bytes32 datasetId, uint256 epoch, bytes32 root, bytes32 contentHash, uint256 count)`. The receiver checks forwarder, 64-byte metadata, workflow ID, chain ID and dataset ID. Registry checks authorized publisher and sequential epoch. A real Sepolia transaction must be confirmed independently from RPC/explorer before describing the root as on-chain.

## Audit the published Sepolia epoch 1

`cre/listproof/config.onchain.json` uses `mode: audit-current`, the actual Registry address, the canonical synthetic epoch-1 fixture and **no receiver**. The workflow reads finalized Registry epoch/root/dataset ID/content hash/count and rejects any mismatch, then prepares a signed **read-only audit** report. It cannot write to the Registry in this mode. `config.onchain-stale.json` is a negative case: it asks the live epoch-1 Registry to match epoch 2 and must fail.

Start `npm.cmd run serve` in one PowerShell window, then from the repository root run `powershell -NoProfile -File .\scripts\run-cre-simulations.ps1` in another ordinary PowerShell window with authenticated CRE CLI 1.39.0. The runner now covers the original local target, the real Registry audit, an on-chain stale case and the five original negative cases, saving separate original CLI logs under `evidence/`. Require `onchain-settings: PASS` and `onchain-stale-settings: PASS` before claiming that the CRE workflow read Sepolia. The earlier `evidence/cre-local-simulation.txt` predates the Registry read and must be described separately.
