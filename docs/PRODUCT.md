# ListProof V3 product and API

ListProof is a verifiable evidence workspace for a **synthetic** three-address dataset. A successful proof means only that a target is absent from one identified committed dataset version. It does not establish legal clearance or source completeness.

## User workflow

1. **Overview:** actual counts come from cases in this browser profile. A new visitor sees zero cases.
2. **Address screening:** enter an EVM address, select epoch 1 or 2, then generate and independently verify a neighbor proof. Epoch 1 is published on Sepolia; epoch 2 is a local fixture only. Four example buttons demonstrate absent, listed, stale and tampered outcomes.
3. **Cases & audit trail:** save a screening, set a review status, add notes, reverify the stored receipt and export a Markdown report or JSON evidence bundle. Statuses record an analyst workflow, not transaction approval. The event list preserves original timestamps within the browser record; the browser owner can edit local storage, so it is **not tamper-proof**.
4. **Proof explorer:** paste or upload a receipt or exported case bundle. The verifier ignores the receipt's own verdict, checks the witness against the trusted fixture and separately checks receipt commitment bindings. Download the verification result.
5. **Datasets & commitments:** inspect addresses, exact content hash, Merkle root, classification and publication status.
6. **On-chain registry:** inspect the saved mined publication, six saved Gate read-only calls and a fresh read-only Registry RPC query. RPC failure is displayed as unavailable.
7. **Chainlink CRE:** inspect saved official CLI simulation evidence and source/config links. No live DON execution or CRE on-chain write is claimed.

## Persistence and access model

The public Render service is stateless for cases. CaseStore uses the browser's localStorage key **listproof:cases:v1**; it is one personal workspace per browser profile. No account is created, and no other visitor can retrieve a case from the server. Browser data can be edited, cleared or lost. Export a case bundle for retention; a future server database would require authenticated users and a durable service. The public app offers no administrative writes, wallet signing or root publication.

## HTTP API

Same-origin requests only. Responses are JSON unless noted. No CORS allow header is sent. Default rate limit: 300 requests per minute per socket address; excess returns HTTP 429 and Retry-After: 60. The server enforces body size limits.

| Method | Path | Result |
|---|---|---|
| GET | /api/health | Availability, product version, case-storage mode |
| GET | /api/v1/datasets | Trusted synthetic fixture metadata and canonical addresses |
| POST | /api/v1/screenings | Proof or listed-address result |
| POST | /api/v1/verify | Independent fixture-bound proof check |
| GET | /api/v1/registry/status | Fresh read-only Sepolia RPC result, or explicit unavailable status |
| GET | /api/v1/cre/evidence | Parsed consistency-checked saved official CLI log metadata |
| GET | /api/sepolia | Curated publication and six saved Gate-read facts |
| GET | /evidence/cre-v3-onchain-settings.txt | Saved V3 official CRE audit simulation output |

The legacy /api/proof and /api/verify routes remain available for existing scripts.

### Screening

~~~http
POST /api/v1/screenings
Content-Type: application/json

{"address":"0x0000000000000000000000000000000000000006","epoch":1,"mode":"clean"}
~~~

For an absent address, the response includes status verified, proof, checkedAgainst and a downloadable receipt. For a listed address it returns status listed without a non-membership receipt. The mode may be clean, manual, listed, stale or tampered; the last three are transparent demonstration scenarios.

~~~http
POST /api/v1/verify
Content-Type: application/json

{"proof":<proof from screening>,"againstEpoch":1}
~~~

The response includes verified, the trusted commitment and an explicit statement that this endpoint made no contract call. Unknown epochs, malformed addresses, invalid scenarios or malformed JSON return HTTP 400. Rate limits return HTTP 429. An unavailable CRE evidence file returns HTTP 503. The Registry status route returns HTTP 200 with status unavailable when RPC cannot be reached, so a network failure cannot appear as a successful chain read.

## Architecture

~~~mermaid
flowchart LR
  B[Browser workspace] -->|Screen| A[Public Node API]
  A --> P[Proof engine and independent verifier]
  P --> D[Bundled synthetic epochs]
  B -->|Save and review| L[Browser localStorage]
  B -->|Export| F[Receipt / report / bundle]
  B -->|Read status| R[Sepolia RPC]
  R --> C[Published Registry]
  A --> E[Saved CRE CLI log]
  W[Official CRE workflow simulation] -->|HTTP fetch and validate| D
  W -->|Finalized read| C
~~~

The public Docker image includes only the public app, proof modules, synthetic fixtures and curated evidence. The privileged local deployment interface is separate and absent from this image.
