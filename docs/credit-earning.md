# Credit-Earning Tier (v3 Specification)

**Status**: placeholder. Full spec ships with v3 — target month 3 after first paying customer.

The credit-earning tier lets contributors offset bandwidth usage by contributing value back to the Network, rather than paying USDC. Runs on Shapley-weighted fair credit attribution.

---

## Contribution modes (planned)

| Mode | Value Contributed | Credit Basis |
|---|---|---|
| **Archive contribution** | Opt-in public archive data (anonymized where required) | Per-message, weighted by uniqueness and engagement signal. Sybil-resistant via community-vouching. |
| **Federated shard hosting** | Compute + uptime serving other communities | Per-served-message, weighted by uptime and SLA. TEE attestation required. |
| **Community metrics** | Moderation votes, quality signals | Per-validated signal, weighted by post-hoc accuracy. |
| **Module contribution** | New tools, personas, workflows merged upstream | Per-usage by other communities. Shapley-weighted by marginal contribution. |

---

## Shapley mechanics

Contribution-to-credit conversion uses Shapley-value accounting over monthly contribution sets.

Shape:

- **Total surplus pool** = (Tier 4 revenue) − (infrastructure costs)
- **Surplus distributed** proportional to each contributor's Shapley value across contribution modes
- **Credits spendable** 1:1 against Tier 4 bandwidth billing

Mirrors the VibeSwap Shapley distribution mechanism applied to the service layer.

---

## Sybil resistance

Credit-earning creates a natural incentive to fake contributions. Mitigations planned:

- **Archive contribution** — community-vouching required (bot owners attest to authenticity of traffic); engagement-weighted (dead chats don't earn).
- **Federated shard** — TEE attestation required to prove canonical binary runs; uptime probed externally.
- **Community metrics** — signals validated post-hoc (votes that predict future moderation outcomes earn; votes that don't degrade toward zero weight).
- **Module contribution** — pull-request gating + adoption metrics; invented modules nobody uses earn nothing.

---

## Open questions (resolve before v3 ships)

- Sybil resistance threshold for archive contributions (minimum community size? minimum engagement rate?)
- Shapley compute cadence (monthly? per-contribution-batch?)
- Credit expiration policy (do credits expire? Carry forward indefinitely?)
- Minimum contribution threshold for eligibility
- Handling of contributions that retroactively lose value (e.g. module was hot for a month then unused)

---

## Related

- [`tier-structure.md`](./tier-structure.md) — four-tier overview
- [`federation.md`](./federation.md) — federated shard specification
- [`pricing.md`](./pricing.md) — Tier 4 USDC pricing for credit-to-cash equivalence
- [`../README.md`](../README.md) — Verifiable Claims Roadmap (Shapley distribution verifiable via ZK + Merkle)
