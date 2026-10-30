# 120-second judge video script

Record only after the public service's /api/health reports productVersion v3 and the external smoke command passes. This is a **shot list and English voiceover**, not a claim that a video exists. Record at 1080p, normal browser zoom, no wallet or private tabs. Use the actual HTTPS service: https://listproof-e5sp.onrender.com/

| Time | Exact action and expected screen | Voiceover |
|---|---|---|
| 0–12 s | Open /#overview. Show zero or real browser-local case counts and the synthetic-data notice. | “ListProof turns an address screening result into evidence that can be independently checked later. Today the source is a clearly labeled synthetic dataset.” |
| 12–27 s | Click **Address screening**. Show epoch 1, three addresses, root and content hash. | “Each result is bound to a dataset ID, chain, epoch and Merkle commitment. Epoch one is published on Sepolia.” |
| 27–43 s | Enter address ending 06 and click **Generate & verify proof**. Show “Not present in committed dataset” and neighbors ending 05 and 09. Click **Download JSON receipt**. | “The proof authenticates the adjacent neighbors, checks their ordering, and verifies the witness independently. This is local verification, not a transaction.” |
| 43–58 s | Click **Save as case**. In the case detail, add a note, set **Under Review**, click **Reverify stored proof**, then **Download human report**. | “The browser workspace keeps the original receipt, review status and event times. It is personal local storage, not a tamper-proof enterprise database.” |
| 58–69 s | Click **Inspect proof** or open **Proof explorer**, paste the downloaded JSON, then **Verify receipt**. Show “Proof verified.” | “The explorer ignores the receipt's claimed verdict and checks its witness against the trusted fixture again.” |
| 69–82 s | Return to **Address screening** and click **Listed · ...05**, **Stale epoch**, **Tampered proof** in sequence. | “Listed, stale and altered proofs are rejected; a green result is never used for these failure cases.” |
| 82–98 s | Click **On-chain registry**. Show the mined epoch-1 transaction, fresh read status if online, and six saved Gate calls. Open the Etherscan publication link. | “The commitment was published in a real Sepolia transaction. Six separate Gate read-only calls passed. They sent no transaction.” |
| 98–113 s | Click **Chainlink CRE** and **Open CLI log**. Show matching epoch/root/hash/count and “no transaction sent.” | “The official CRE simulator fetched the pinned dataset, recomputed the commitment, read finalized Registry state and prepared a signed audit report. Live DON execution has not been deployed.” |
| 113–120 s | Return to Overview or README limits. | “ListProof proves absence only from this specific synthetic version. It does not declare legal or sanctions clearance.” |

Show the public README's CRE reproduction command and evidence link in the video description. If the live Registry RPC is unavailable during recording, show the explicit unavailable state and saved publication evidence; do not narrate a fresh successful read. Verify the recording contains each stated result before uploading. Do not add a video URL to the README or submission until the uploaded URL resolves publicly.
