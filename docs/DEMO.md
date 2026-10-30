# 90-second demo script

**0–15s:** State the narrow claim: absence from one committed synthetic address dataset. Show dataset ID, Sepolia chain identifier, epoch and root.

**15–30s:** Enter synthetic address `0x...06`. Generate adjacent membership witnesses and verify independently against epoch 1.

**30–42s:** Enter synthetic address `0x...05`. Show listed rejection.

**42–57s:** Show the stale epoch-1 proof failing against epoch 2 and a tampered proof rejection.

**57–72s:** Open the Sepolia evidence panel. Show the [Registry](https://sepolia.etherscan.io/address/0x1607Af4E1DA1C06362871443d2e95C367B984Efa), [Gate](https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3) and [epoch-1 publication receipt](https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d). If fixed-block `eth_call` proof evidence has been captured, show its actual results; otherwise say those calls are pending. Do not describe the local proof buttons as Gate calls.

**72–90s:** Open `cre/listproof/main.ts` and the saved official CRE simulation log. If the new Registry-read audit passed, show its separate CLI log and finalized on-chain state. Otherwise point to the earlier log's explicit `no onchain read` and `no transaction sent` messages. Close with the limitation: absence in one list is not legal clearance.
