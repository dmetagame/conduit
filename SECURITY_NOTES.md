# Security notes

## Signer key handling

- The agent signer key lives only in `agent/.env.local` (gitignored) or as a GitHub
  Actions secret (`SUI_AGENT_SECRET_KEY`) — never committed.
- The public package/treasury ids are the only on-chain config baked into the workflow.
- **Testnet only.** Do not reuse the demo burner key/mnemonic for any mainnet funds.
- Settlement is permissionless by design: anyone can run the operator, so the treasury
  never depends on our infrastructure or our key.

## Dependency advisory: `valibot` ReDoS (transitive, via Mysten SDKs)

`npm audit` reports a high-severity advisory for `valibot`
([GHSA-vqpr-j7v3-hqw9](https://github.com/advisories/GHSA-vqpr-j7v3-hqw9) — ReDoS in
`EMOJI_REGEX`) in **both** workspaces:

| Workspace | `npm audit` result | Source |
| --- | --- | --- |
| `agent/` | 3 high | `valibot` via `@mysten/sui`, `@mysten/walrus` |
| `ui/` | 8 (1 moderate, 7 high) | `valibot` via `@mysten/dapp-kit`, `@mysten/sui`, wallet packages |

### Assessment

- The advisory is a **transitive dependency of the official Mysten Labs SDKs**, not a
  direct Conduit dependency. There is no fixed version we can select without the upstream
  SDKs bumping their `valibot` range.
- `npm audit fix --force` is **not** applied during the submission window because it would
  downgrade/replace the Mysten SDKs to versions that break the wallet-connect and Walrus
  flows. Correctness of the live demo takes priority over a clean audit number.
- **Conduit's own code does not call `valibot`** and exposes no server-side, attacker-
  controlled regex path: the agent parses only its own on-chain event data and uploads
  receipts; the UI is a static client-side bundle. The ReDoS surface (untrusted input fed
  to the vulnerable emoji regex) is not reachable through any Conduit-authored code path.

### Resolution path

Upgrade the Mysten SDKs once they publish releases pinning a patched `valibot` (≥ the fixed
line), then re-run `npm audit` to confirm the advisory clears. Tracked as post-submission
maintenance.
