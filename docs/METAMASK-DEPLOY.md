# Local MetaMask deployment interface

The deployment page is served **only** on `http://127.0.0.1:4183`. It uses the injected EIP-1193 MetaMask provider through ethers.js 6.15.0. No private key, seed phrase or wallet password is requested, read or saved. It deploys only the existing `ListProofRegistry` and `ListProofGate` contracts. It does not publish a root, deploy a CRE receiver, or send any transaction on page load.

## Prerequisites and launch (ordinary Windows PowerShell)

```powershell
cd C:\Users\Win10_Game_OS\Pulse\projects\listproof
# If out/ListProof.sol/*.json is absent in a fresh clone, compile first:
docker run --rm --entrypoint forge -v "${PWD}:/app" -w /app ghcr.io/foundry-rs/foundry:stable build
cd .\deploy-ui
npm.cmd install
cd ..
npm.cmd run check
npm.cmd run deploy:local
```

Open **http://127.0.0.1:4183** in the browser with MetaMask. The first `npm.cmd install` generates `deploy-ui/package-lock.json`; commit that lockfile after review. The Codex sandbox could not fetch ethers from npm (`EACCES`), so the browser wallet flow was not executed here. The root package lock and public demo remain independent of this local wallet dependency.

If the public Sepolia RPC used for independent evidence verification is unavailable, set `LISTPROOF_SEPOLIA_RPC_URL` to another trusted **HTTPS Sepolia RPC** in the current PowerShell session before launching the server. The server never sends transactions. Do not paste an API credential into committed files or screenshots.

## Wallet steps

1. In MetaMask, select **Ethereum Sepolia (11155111)** and the Pulse account **`0x765fb7e6a0BdDDc29f57eeCE34AEda0Fb318805d`**. The Foundry dry-run sender `0x1804c8ab1f12e6bbf3894d4083f33e07309d1f38` is never used.
2. Click **Connect MetaMask**. Connection requests account access only; it does not request a transaction signature.
3. Click **Estimate & review Registry**. The page displays account, chain, contract, constructor arguments, estimated gas, 20% gas-limit headroom, estimated maximum fee and transaction value `0 ETH`. It validates solc 0.8.24, optimizer 200, `viaIR`, the artifact source hash and the dataset ID from `DeploySynthetic.s.sol`.
4. Click **Confirm Registry deployment** and accept the separate browser confirmation **only if** the displayed details are correct. MetaMask then shows its own signing prompt. You may reject either prompt. The page waits for the receipt and deployed code; the local server independently checks the Sepolia receipt, exact creation input, Pulse sender, on-chain code and registry state before writing evidence.
5. After the Registry result says **VERIFIED**, click **Estimate & review Gate**. Its sole constructor argument must be that verified Registry address. Click **Confirm Gate deployment** only after reviewing a new estimate and a new confirmation. The Gate transaction is never sent automatically after Registry.
6. If the browser closes after signing, paste the actual transaction hash into **Recover evidence**. The server re-verifies it before saving.

Verified results are written to `evidence/sepolia-deployments.json`, which is ignored by Git. Each record includes the actual address, transaction hash, block, gas used, constructor arguments and Sepolia Etherscan links. A submitted transaction is not called verified until the receipt and on-chain checks succeed. If RPC verification fails, the UI shows the hash and asks you to retry recovery; it does not invent a success result.

## Boundaries

- Each deployment incurs Sepolia gas fees. The estimated fee can change in MetaMask; review its final confirmation.
- The Registry is initially deployed with publisher equal to the Pulse wallet. Root publication is a separate action described in [SEPOLIA.md](SEPOLIA.md).
- The Gate is a **test-only ledger**, not an ERC-20 token.
- Do not deploy a CRE receiver until the official Sepolia forwarder and actual workflow ID are verified. Local simulation does not supply a live workflow ID.
- Do not publish this deployment page to a public host. It is intentionally a localhost-only signing interface.

## Publish the synthetic epoch-1 root (after Registry and Gate deployment)

The same localhost page now includes a separate **Publish synthetic epoch-1 root** panel. Stop any older server on port 4183 with `Ctrl+C` in its own PowerShell window, then run `npm.cmd run deploy:local` again from the repository root. Open `http://127.0.0.1:4183`, connect the approved Pulse wallet on Sepolia, and click **Refresh Sepolia state**. The panel will show the actual current `epoch`, `root`, `contentHash`, `count`, publisher, dataset ID, Gate registry, and bytecode checks. It disables publication unless the Registry is still at epoch 0 with zero root/hash/count.

Click **Estimate & review root publication**. The canonical epoch-1 synthetic fixture is recomputed with the existing `src/core.mjs` and `src/adapter.mjs` pipeline and checked against the pinned CRE config. Review the Registry address, dataset ID, epoch 1, root, content hash, count, current on-chain state, gas and estimated maximum fee, and `0 ETH` transaction value. Click **Confirm epoch-1 publication** only if those details are correct; the page asks again before MetaMask requests a signature. No transaction is sent on load, connect, refresh or estimate.

After a successful receipt, the page reads the Registry again and asks the local server to verify the exact `publish(uint256,bytes32,bytes32,uint256)` calldata, `RootUpdated` event, runtime bytecode, Registry state and Gate reference through Sepolia RPC. It saves `evidence/sepolia-root-publication.json` only after those checks. The publication recovery field accepts a real transaction hash if the browser closes after signing. This is a **publisher-wallet transaction**, not a CRE write.
