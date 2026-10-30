# Public comparison — 2026-10-30

The requested exact repository URLs for [yangdongsuk/foreman](https://github.com/yangdongsuk/foreman) and [predgeAI/bli-settlement-evidence](https://github.com/predgeAI/bli-settlement-evidence) could not be fetched from the available public index. Their current features, tests and deployment status are **unverified**. Search results showed similarly named projects, which cannot safely be substituted for the requested repositories.

[LexProof's public README](https://github.com/pgskannan/LexProof) describes a live public verifier, Sepolia contracts and transaction links, a CRE simulation, and larger backend/frontend test suites. These are claims visible in its repository; they were not re-executed here. ListProof now has actual Sepolia Registry/Gate and epoch-1 root publication receipts, a saved official local CRE simulation and a generated JS-to-Solidity fixture. Its current expanded Solidity suite and public demo URL remain unverified.

| Area | ListProof verified here | LexProof public artifact | Foreman / settlement evidence |
|---|---|---|---|
| Cryptographic proof | Local Merkle tests and independent verifier pass | Public README describes browser-side fingerprint verification | Unverified |
| Smart contract | Sepolia Registry/Gate and root publication receipts; owner reported 6 prior Foundry passes, strengthened tests need rerun | Public README links Sepolia contracts/receipts | Unverified |
| Chainlink CRE | Official local simulation log saved; no on-chain read/write | Public README reports successful CRE simulation | Unverified |
| UI | Local HTTP scenarios pass | Public live verifier linked | Unverified |
| Reproducibility | Zero-dependency Node tests pass; CRE lockfile present | Repository lists detailed setup/tests | Unverified |
| Public evidence | Sepolia explorer links; no public demo or GitHub URL | Public site and explorer links in README | Unverified |

No code from these projects was copied. ListProof's distinct focus remains authenticated *non-membership* in an address dataset, with narrow claims and explicit synthetic provenance. No superiority claim follows from the current evidence.
