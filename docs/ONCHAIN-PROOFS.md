# Read-only Sepolia Gate proof checks

`ListProofGate` is the already deployed **test-only ledger** at [`0xf88F9870fe6e135d5bD56852750c8af8a466A9A3`](https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3). The registry's synthetic epoch-1 root was published in [transaction `0x824c…478d`](https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d). The checks below use `eth_call` at **one fixed block**, so they spend no gas and do not change Gate state.

From ordinary Windows PowerShell with a working Sepolia RPC:

```powershell
cd C:\Users\Win10_Game_OS\Pulse\projects\listproof
npm.cmd run onchain:proofs
npm.cmd run public:evidence
```

The first command validates the published Registry state, the exact runtime bytecode of Registry and Gate (including immutable values), Gate→Registry reference, Pulse sender balance and nonce. It builds proofs from `data/epoch-1.json` using `src/core.mjs`, then ABI-encodes `ListProofGate.transfer(address,uint256,uint256,NonMember)` from the **compiled artifact**. It expects valid middle and lower/upper boundary proofs to return successfully. Listed, tampered and stale-epoch evidence must revert with reason `proof`. The calls are independent and do not consume the nonce.

Only if all six cases pass does the script create ignored `evidence/sepolia-proof-calls.json` with the fixed block number/hash, calldata, results and revert reasons. The second command updates checked-in `data/sepolia-public.json` with a small public result summary. If any call fails, the script exits nonzero and **does not save a success report**. Do not describe the read-only check as a Gate transfer transaction.

If the Codex sandbox returns `EACCES` for the RPC, run the commands in the owner's ordinary PowerShell. A public Sepolia RPC is used by default; a trusted HTTPS endpoint may be supplied with `LISTPROOF_SEPOLIA_RPC_URL` in that shell only. Do not commit API credentials. No MetaMask wallet connection is needed for `eth_call` because the sender address is a public RPC call parameter; it does **not** sign anything.
