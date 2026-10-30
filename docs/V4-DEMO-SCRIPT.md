# ListProof V4 judge demo — 135 seconds

Record this only against an actually tested V4 staging URL. Until then, use the local release candidate and label the video **local V4 preview**. The public Render URL currently serves V3. No video has been recorded or uploaded.

| Time | Screen and action | Voiceover cue |
|---|---|---|
| 0–14 s | V4 Overview: show real workspace count and synthetic limitation. | “ListProof turns a narrow screening result into evidence an auditor can recheck.” |
| 14–30 s | Screen synthetic address ending `06` against epoch 1. | “The server binds this result to an exact dataset ID, epoch, content hash and Merkle root.” |
| 30–46 s | Open Proof inspector; show predecessor `05`, successor `09`, paths and PASS. | “Two authenticated adjacent neighbors prove absence from this committed set. The receipt's claimed verdict is ignored.” |
| 46–63 s | Create case; set Under Review; add a note. | “The private workspace stores the analyst's review and event history in a database.” |
| 63–77 s | Reverify, export the JSON bundle and show audit event hashes. | “The same receipt is rechecked later. Application event hashes detect edits, but are not independent immutability.” |
| 77–91 s | Dataset page: show synthetic version; optionally import a separate synthetic CSV draft and its root. | “Source provenance and owner approval are separate from cryptographic correctness; imported data is unverified.” |
| 91–108 s | CRE Operations: open `cre-public-audit-settings.txt` and `cre-v4-bad-hash.txt`. | “Official CRE simulation fetched the public pinned bytes, checked the root and read finalized Sepolia Registry state; bad content was rejected.” |
| 108–123 s | Registry: show published epoch 1 and read-only status, then the V3 live URL. | “The epoch-one Registry transaction is real. This CRE run made no transaction and is not live DON execution.” |
| 123–135 s | Return to claim and limits. | “Absence from one synthetic version is independently checkable. It is never sanctions clearance.” |

Capture the actual screen and command outputs; do not add simulated activity or a live DON badge. If staging is unavailable, omit the production persistence claim from the spoken demo and use the verified local PostgreSQL test evidence in the README instead.
