# Pricing (v2 Specification)

**Status**: preliminary. Activates with v2 (crypto-paid bandwidth tier). Subject to v1 usage data.

---

## Anchor points

| Product | Price | Notes |
|---|---|---|
| ChatGPT Team | $30/user/month | Reference incumbent for AI-assisted work |
| Notion AI | $10/user/month | Single-feature AI add-on |
| Replit Ghostwriter | $20/user/month | Coding-focused |
| Enterprise copilots | $50–$200/user/month | Salesforce Einstein, Microsoft Copilot, etc. |

**JARVIS target**: **$3–5 per 10K messages** equivalent to ChatGPT Team capacity — with superior grounding and no hallucination.

---

## Structure (v2)

Usage-based, paid in USDC.

| Component | Rate | Notes |
|---|---|---|
| Base hosted shard | $29/month | Replaces "Community Free" for dedicated-shard customers |
| Message volume | $0.0003 per message | Covers LLM routing + infrastructure |
| Big-model override | $0.003 per message | Force Sonnet/Opus instead of Haiku triage |
| Archive retention > 90 days | $0.50/GB/month | Default 90 days free |
| Private deployment | $299/month setup + base | Isolated shard, separate archive, separate credentials |

---

## Pricing shape

**v2 default**: linear ($X per N messages).

**Flag** (from Correspondence Triad check): AI service usage is power-law distributed. If heavy users over-subsidize light users at linear pricing, transition to tiered/power-law structure:

| Monthly volume | Rate per 1K messages |
|---|---|
| 0 – 10K | $0.30 |
| 10K – 100K | $0.25 |
| 100K – 1M | $0.20 |
| 1M+ | $0.15 |

Monitor in v2; adjust if cost-per-message math drifts.

---

## Contribution discounts (v3 interaction)

Credit-earning tier contributions (archive data, federated shards, module contributions) offset Tier 4 bandwidth. Credit-to-USDC equivalent rate set by Shapley-weighted marginal value — see [`credit-earning.md`](./credit-earning.md).

**Example**: operator running a federated shard serving 50K msg/month earns credits worth ~$15 off their own Tier 4 bill. Heavy contributors approach zero cash outlay.

---

## Billing cadence

- **Monthly**: USDC balance drawn down at month-end from on-chain wallet.
- **Top-up model**: customer deposits USDC; usage debits ledger; auto-top-up threshold alert at 20% balance.
- **Hard cutoff**: service suspends at zero balance with 48h grace; no overdraft.

---

## What's not in v2 pricing

Deferred to v3+ or governance decisions:

- **Native token discounts** — activates only if JARVIS Network token ships (v4 optional).
- **Volume commitment discounts** — available in v3 with formal contracts.
- **SLA upgrades** — custom pricing for enterprise private deployments (v3).
- **Multi-chain payment beyond USDC** — v4 if market demand justifies.

---

## Related

- [`tier-structure.md`](./tier-structure.md) — four-tier overview
- [`credit-earning.md`](./credit-earning.md) — v3 credit mechanics
- [`../LICENSE`](../LICENSE) — source-available milestone
- [`../README.md`](../README.md) — Verifiable Claims Roadmap (cost claims proved via ZK at v1)
