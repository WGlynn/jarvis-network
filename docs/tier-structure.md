# Tier Structure

JARVIS Network operates on four tiers. Lower tiers subsidized by upper-tier revenue. Excess surplus returns to contributors via Shapley-weighted distribution. **No equity-holder extraction layer — surplus is a substrate property, not a margin.**

---

## Tier 1 — OSS Self-Host (post-milestone)

**Currently unavailable.** Activates at source-available milestone (see [`LICENSE`](../LICENSE)).

When it ships:
- Full architecture released under source-available license
- Run on your own infrastructure, bring your own API keys
- Own your archive (jsonl on your filesystem)
- Zero service revenue to the Network — propagation vector only

---

## Tier 2 — Community Free Tier (hosted baseline)

**Target**: small communities (<100 members, ~1K messages/day).

- Standard engagement cooldowns (10s) and hourly caps (200)
- Free-tier LLM routing (Haiku triage, Haiku or free-provider generation where adequate)
- Archive hosted on Network infrastructure
- No crypto required, no contribution required

Funded entirely by cross-subsidy from Tier 4. The cost floor per community is low (most messages never hit the full model due to triage), so this tier can sustain a large footprint without dedicated revenue.

---

## Tier 3 — Credit-Earning Tier (hybrid)

**For**: active contributors to the Network.

Opt-in contribution modes, each earning credits:

| Contribution | Credit Basis |
|---|---|
| **Archive contribution** (opt-in public archive) | Per-message credit, weighted by uniqueness and engagement signal. Sybil-resistant via community-vouching. |
| **Federated shard hosting** (run a shard for other communities) | Per-served-message, weighted by uptime and SLA compliance. TEE attestation required. |
| **Community metrics** (moderation votes, quality signals) | Per-validated-signal, weighted against post-hoc accuracy. |
| **Module contribution** (new tools, personas, workflows) | Per-usage by other communities. Shapley-weighted by marginal contribution. |

Credits offset bandwidth beyond Tier 2 free baseline. Heavy contributors need zero cash outlay.

---

## Tier 4 — Crypto-Paid Bandwidth (premium)

**For**: power users, large communities, private deployments.

Pay in:
- **USDC** (primary): Ethereum, Base, Arbitrum
- **Native token** (optional, v4+): JARVIS Network token for staking, priority routing, governance

Premium features:
- Higher throughput (100K+ messages / month)
- Bigger-model routing (Opus / Sonnet on hot path instead of Haiku baseline)
- Priority processing queue
- Larger archive retention (default 90 days; premium up to 2+ years)
- Private deployments / isolated shards (no shared infrastructure)

---

## Circular economy flow

```
       CRYPTO PAYMENT LAYER
       Tier 4 power users → USDC/native → covers:
         • LLM API costs
         • Hosting / compute
         • Archive storage
         • Surplus → contributor pool
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
   INFRASTRUCTURE        CONTRIBUTOR POOL
   (LLM, compute,        (Tier 3 credits,
    storage)              Shapley-weighted)
         │                    │
         └─────────┬──────────┘
                   ▼
       COMMUNITIES (Tiers 2 + 3)
        ↑ ↑ ↑
       contribute: archive data,
       metrics, shards, modules
```

---

## Pricing anchors (preliminary, subject to v1 data)

- **Tier 2 Free baseline**: ~1K messages/day, zero cost
- **Tier 3 credits**: cost TBD — derived from actual per-message infrastructure cost + contribution marginal value
- **Tier 4 target**: ~$3–5 per 10K messages equivalent to ChatGPT Team tier (~$30/user/month)
- **Pricing shape**: linear in v2, may transition to tiered/power-law if heavy users over-subsidize light users (flagged in Correspondence Triad check — substrate is power-law distributed)

---

## Related

- [`../LICENSE`](../LICENSE) — closed-source terms + source-available milestone
- [`../README.md`](../README.md) — thesis, tier table, Verifiable Claims Roadmap
- [`credit-earning.md`](./credit-earning.md) — v3 specification (placeholder)
- [`federation.md`](./federation.md) — federated shard protocol (v3 placeholder)
- [`pricing.md`](./pricing.md) — v2 pricing specification (placeholder)
