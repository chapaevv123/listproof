# DoraHacks submission draft — do not publish before owner approval

**Title:** ListProof — Verifiable non-membership in a committed address dataset

**Description:** ListProof proves that an EVM address is absent from one versioned, committed **synthetic** address set. A canonical adapter hashes the dataset and builds a domain-separated sorted Merkle tree. Independent JavaScript and Solidity verifiers authenticate adjacent neighbors and reject forged or stale witnesses. The Sepolia Registry stores a publisher-authorized epoch-1 root; the Gate enforces the current epoch for a test-only ledger. Registry, Gate and epoch-1 publication have real Sepolia receipt evidence. The Chainlink CRE TypeScript workflow fetches the pinned dataset with the official HTTP capability, checks content hash, schema and root, reads a Sepolia block and prepares a signed report in the official local simulator. The saved simulation did not read the Registry or write on-chain. A new Registry-read audit target awaits official simulation. No CRE receiver or live DON deployment is claimed.

**Trust and limits:** The proof is bound to chain ID, dataset ID, epoch, root and normalization scheme. It depends on the publisher choosing and updating an accurate dataset. It does not establish sanctions compliance, KYC or legal clearance.

**Sepolia evidence:** [Registry](https://sepolia.etherscan.io/address/0x1607Af4E1DA1C06362871443d2e95C367B984Efa), [Gate](https://sepolia.etherscan.io/address/0xf88F9870fe6e135d5bD56852750c8af8a466A9A3), [epoch-1 publication](https://sepolia.etherscan.io/tx/0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d). These links do not prove a Gate transfer or CRE write.

**Chainlink files:** `cre/listproof/main.ts`, `cre/listproof/workflow.yaml`, `cre/listproof/config.onchain.json`, `cre/project.yaml`, `evidence/cre-local-simulation.txt`.

**Links to complete before submission:**

- [ ] Public GitHub repository URL
- [ ] Public, independently accessible demo URL
- [ ] Public video URL showing the actual CRE simulation
- [ ] Official event/bounty rule and public submission deadline URL
- [x] CRE local simulation output file, clearly distinguished from live DON execution
- [x] Testnet Registry/Gate addresses and epoch-1 publication receipt/explorer links
- [ ] Sepolia Gate read-only proof-call evidence
- [ ] Official CRE Registry-read audit and negative-case logs
- [ ] Live DON / CRE receiver evidence, if required by final bounty rules

Do not present the saved local simulation as a live DON run or on-chain CRE write. A [BLI organizer article](https://bli.tools/international-hackathon-with-ryo-digital-chainlink-labs-focuses-on-ai-payrails-stablecoins-more/) states October 31 is the submission date; the public DoraHacks cutoff time and bounty-specific rules still require direct verification. October 31, 2026 20:00 Europe/Kyiv is an internal deadline only.
