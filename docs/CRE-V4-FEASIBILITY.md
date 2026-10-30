# Chainlink CRE V4 feasibility and evidence

The installed official CLI is **v1.39.0**. On 2026-10-30, `cre whoami` reported **Deploy Access: Not enabled**. `cre registry list` showed `private`, and `cre workflow supported-chains` listed `ethereum-testnet-sepolia`. These are read-only account and capability observations. No workflow was deployed or activated.

[Chainlink's deploy-access guide](https://docs.chain.link/cre/guides/operations/deploy-access) states that DON deployment requires organization approval. [The registry guide](https://docs.chain.link/cre/guides/operations/deploying-workflows) distinguishes the private registry, which needs a CRE login and no registry gas, from the Ethereum Mainnet on-chain registry, which needs a linked wallet and gas. The current workflow target uses the **private registry**, has an empty receiver address, and is a read-only Registry audit. It cannot publish a root. CRE execution quotas and any account-specific costs must be reviewed in the owner dashboard before activation; no price or free execution allowance is assumed.

## Evidence classes

| Evidence | Result | Scope |
|---|---|---|
| `evidence/cre-public-audit-settings.txt` | Official CLI simulation exited 0; structured `listproof-cre-audit-v1` receipt; finalized Sepolia Registry matched epoch 1 | Public HTTPS synthetic fixture and read-only chain observation, **not live DON** |
| `evidence/cre-*-v4.txt` | Eight existing targets rerun: two expected successes, six expected rejections | Local official CLI simulation; original logs preserved |
| `evidence/cre-v4-bad-hash.txt` | Bad hash rejected with a structured reason code | Additional negative simulation |
| `evidence/cre-public-audit-preflight-failure.txt` | New target initially lacked an RPC mapping; corrected before successful simulation | Honest preflight failure, not positive evidence |

The public fixture at `https://listproof-e5sp.onrender.com/dataset/1` returned HTTP 200 and SHA-256 `0x847808cb140145db952ee309dc5229106e1923a0499ecd91e07dbe175fb42b57`, matching the pinned `config.public-audit.json`. The successful official CLI run checked its schema, address normalization, dataset ID, epoch, count, provenance, Merkle root and finalized Registry state. The receipt format identifies each check and the observed block. Negative runs log a reason code before failing. Prior logs under `evidence/` remain available unchanged.

## Owner-approved path to live DON

1. Review [CRE deploy access](https://docs.chain.link/cre/guides/operations/deploy-access), [private registry deployment](https://docs.chain.link/cre/guides/operations/deploying-workflows), [service quotas](https://docs.chain.link/cre/service-quotas) and current account billing/limits. The owner may request deploy access with `cre account access` using the **Hackathon** purpose. Approval is external and is not currently granted.
2. Keep `public-audit-settings` read-only. Re-run `bun run typecheck` in `cre/listproof` and, from `cre/`, `cre workflow simulate .\listproof --target public-audit-settings --non-interactive --trigger-index 0`. Confirm the public fixture hash and Registry result again immediately before deployment.
3. After access is enabled and the owner explicitly authorizes deployment, from `cre/` run `cre workflow deploy .\listproof --target public-audit-settings` and inspect the CLI confirmation. Do not use `--yes` or `--non-interactive` to bypass review.
4. If deployment succeeds, use `cre workflow get .\listproof --target public-audit-settings` to inspect health. Activate only with separate owner authorization using `cre workflow activate .\listproof --target public-audit-settings`; then wait for a real cron execution and verify it in CRE execution history/logs. A deployed but inactive workflow is not live execution evidence.
5. Save the real execution ID, timestamp, workflow hash and logs only after independent verification. Do not claim on-chain publication: this audit target has no receiver and sends no transaction.

Private registry management does not require Ethereum gas, but the owner must verify account-specific CRE execution charges and quotas. Public/on-chain registry deployment is a different path and is outside this release candidate.
