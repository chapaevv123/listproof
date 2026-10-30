# Sepolia deployment runbook (historical deployment procedure)

Registry [`0x1607Af4E1DA1C06362871443d2e95C367B984Efa`](https://sepolia.etherscan.io/address/0x1607Af4E1DA1C06362871443d2e95C367B984Efa) and Gate [`0xf88F9870fe6e135d5bD56852750c8af8a466A9A3`](https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3) are already deployed. Synthetic epoch 1 was [published](https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d). **Do not redeploy or repeat the publication commands below.** They document reproducibility of the original process; the current read-only verification procedure is [ONCHAIN-PROOFS.md](ONCHAIN-PROOFS.md).

Use **chain ID 11155111**. The repository contains no private key. [Foundry deployment documentation](https://getfoundry.sh/forge/index.html) describes `forge script --broadcast`; inspect `forge script --help` for the signing option supported by your installed release. Use a secure local signer/keystore controlled by the owner. Never paste a private key into a command, chat, file, or CI variable for this demo.

## 1. Local checks before any wallet use

```powershell
cd C:\Users\Win10_Game_OS\Pulse\projects\listproof
npm.cmd run check
$env:DOCKER_CONFIG = "$PWD" # optional: only if Docker's user config is inaccessible
docker run --rm --entrypoint forge -v "${PWD}:/app" -w /app ghcr.io/foundry-rs/foundry:stable build
docker run --rm --entrypoint forge -v "${PWD}:/app" -w /app ghcr.io/foundry-rs/foundry:stable test -vvv
```

The Docker `--rm` removes only the temporary container. It does not delete repository files. `out/` and `cache/` are ignored. Run from ordinary owner PowerShell if the Codex sandbox cannot access Docker's named pipe.

## 2. Read-only network checks

Choose a Sepolia RPC URL you trust and set it only in the current PowerShell session. Set `LISTPROOF_PUBLISHER` to the public address of the wallet you control. Do not place secrets in `.env.example`.

```powershell
$env:SEPOLIA_RPC_URL = 'https://YOUR_SEPOLIA_RPC'
$env:LISTPROOF_PUBLISHER = '0xYOUR_PUBLIC_WALLET_ADDRESS'
cast chain-id --rpc-url $env:SEPOLIA_RPC_URL # must equal 11155111
cast balance $env:LISTPROOF_PUBLISHER --rpc-url $env:SEPOLIA_RPC_URL
forge script script/DeploySynthetic.s.sol:DeploySynthetic --rpc-url $env:SEPOLIA_RPC_URL
# If forge is available only through Docker, use this dry run instead:
docker run --rm --entrypoint forge -v "${PWD}:/app" -w /app -e LISTPROOF_PUBLISHER ghcr.io/foundry-rs/foundry:stable script script/DeploySynthetic.s.sol:DeploySynthetic --rpc-url $env:SEPOLIA_RPC_URL
```

Both script commands are dry runs without `--broadcast`; use whichever toolchain is available. Inspect simulation gas and balance. The script deploys `ListProofRegistry(datasetId, publisher)` and `ListProofGate(registry)`. `datasetId` is `0xa911b05f7ffdc54a7c72dfc23ca6f7ccaa8e15eec7af7c2ef1215254db6ff9ed` (SHA-256 of `listproof-synthetic-demo`). No transaction is sent during this dry run. The `cast` commands in this guide require native Foundry; the same read-only calls can be made with `docker run --rm --entrypoint cast ghcr.io/foundry-rs/foundry:stable ...`.

## 3. Owner-approved broadcast and verification

Only after explicit approval for wallet signing and Sepolia fees, use the installed Foundry wallet option and add `--broadcast` to the exact dry-run command. Record the transaction hashes, addresses, gas estimate, actual gas used, block number, and `https://sepolia.etherscan.io/tx/<ACTUAL_HASH>` URLs. Verify receipt `status == 1` and `chainId == 11155111` with `cast receipt <ACTUAL_HASH> --rpc-url $env:SEPOLIA_RPC_URL` and check deployed bytecode with `cast code <ACTUAL_ADDRESS> --rpc-url ...`.

Registry constructor: `(bytes32 datasetId, address publisher)`. Gate constructor: `(ListProofRegistry registry)`. Receiver constructor: `(ListProofRegistry registry, address forwarder, bytes32 workflowId)`.

Publish the pinned synthetic epoch 1 only after the registry address and publisher are confirmed:

```powershell
$env:LISTPROOF_REGISTRY = '0xACTUAL_REGISTRY_ADDRESS'
cast call $env:LISTPROOF_REGISTRY 'publisher()(address)' --rpc-url $env:SEPOLIA_RPC_URL
cast call $env:LISTPROOF_REGISTRY 'datasetId()(bytes32)' --rpc-url $env:SEPOLIA_RPC_URL
# Owner-approved signed transaction; add the secure wallet option from `cast send --help`:
cast send $env:LISTPROOF_REGISTRY 'publish(uint256,bytes32,bytes32,uint256)' 1 0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888 0x847808cb140145db952ee309dc5229106e1923a0499ecd91e07dbe175fb42b57 3 --rpc-url $env:SEPOLIA_RPC_URL
cast call $env:LISTPROOF_REGISTRY 'epoch()(uint256)' --rpc-url $env:SEPOLIA_RPC_URL
cast call $env:LISTPROOF_REGISTRY 'root()(bytes32)' --rpc-url $env:SEPOLIA_RPC_URL
```

The owner must supply the wallet option; **do not run the displayed `cast send` until approval and signer setup**. Use `forge verify-contract <ACTUAL_ADDRESS> contracts/ListProof.sol:ListProofRegistry --chain sepolia` (and similarly for Gate/Receiver), following current explorer API requirements. Explorer source verification is a separate gate from a successful receipt.

## 4. CRE receiver sequence

The receiver needs the **actual** workflow ID and the correct CRE Sepolia forwarder. Get network-specific forwarder information from authenticated `cre workflow supported-chains` and official Chainlink documentation; verify code at the address. Do not use a guessed or local mock forwarder on Sepolia. [CRE deployment access](https://docs.chain.link/cre/overview) requires approval; local simulation alone does not create a live workflow ID.

After the workflow ID exists, set public `LISTPROOF_REGISTRY`, `LISTPROOF_FORWARDER`, and `LISTPROOF_WORKFLOW_ID`, dry-run `forge script script/DeployReceiver.s.sol:DeployReceiver --rpc-url $env:SEPOLIA_RPC_URL`, then owner-approved broadcast. Check `registry()`, `forwarder()`, `workflowId()` on the receiver. Transfer registry publisher to the receiver via an owner-approved `cast send` only **after** all addresses and workflow identity are verified. This transfer removes direct EOA publishing until another authorized transfer; plan it carefully. The receiver then accepts only the configured forwarder and workflow ID. Sequential epochs prevent replay.

For CRE's next update, serve a pinned **publicly reachable** synthetic epoch-2 JSON URL. Configure `expectedEpoch: 2`, epoch-2 content hash/root, `expectedPreviousRoot` equal to epoch-1 root, and verified registry/receiver addresses. `localhost` is for local simulation only; it cannot be used by a live DON. Preserve any actual write transaction hash, receipt, registry `RootUpdated` event and explorer links. A `writeReport` result alone is not a verified receipt.
