# Genuine 90–120 second demo capture

After hosting passes `npm.cmd run smoke:public`, record the **actual HTTPS demo** and the saved official CRE CLI log. A genuine local initial-state screenshot is saved at `docs/assets/demo-desktop.png`; no GIF or video is claimed. Capture 1080p at 100% browser zoom. Show only public URLs and synthetic data.

| Time | Screen | English voiceover |
|---|---|---|
| 0–12s | Actual deployed HTTPS URL and README hero | “ListProof makes one precise claim: an address is absent from a specific committed synthetic dataset at a specific epoch.” |
| 12–28s | Demo commitment and address `...06` | “The three-address epoch-one set is committed by this root. The proof authenticates the neighboring addresses ending 05 and 09.” |
| 28–43s | Valid proof and downloadable receipt in the deployed demo | “Both Merkle paths, their order and adjacent indices verify independently. The public server checks this proof without sending a transaction.” |
| 43–58s | Listed `...05`, stale, tampered | “A listed address is rejected. The old epoch and altered witness are rejected too.” |
| 58–78s | Sepolia evidence panel and explorer | “The Registry and Gate are deployed on Sepolia. Epoch one was published in this mined transaction. Six separate read-only Gate calls passed.” |
| 78–103s | `evidence/cre-onchain-settings.txt` | “The official Chainlink CRE simulator fetched and checked the pinned dataset, read the real Sepolia Registry, and prepared an audit report. This is simulation, not live DON execution or an on-chain CRE write.” |
| 103–115s | README security limits | “The proof concerns only this synthetic committed set. Source completeness and legal clearance remain outside the claim.” |

Before upload, verify the capture actually shows each stated result, contains no wallet secrets or account tokens, and labels the local proof, Sepolia read, publication transaction and CRE simulation distinctly. Put the actual uploaded video URL into the README and submission only after it resolves publicly.
