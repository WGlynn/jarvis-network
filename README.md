# JARVIS

AI-native community infrastructure. ~100x cheaper than paid-API wrappers. Grounded in files, not tokens.

---

## The thesis

Every AI wrapper product pays for one giant model call, every time, with all context loaded. That's the economic model of the entire current AI tooling industry, from ChatGPT Team to enterprise copilots. It's what makes those products cost $20–$200 per user per month.

JARVIS doesn't.

- **Shard by function** so each call's prompt is scoped to the current intent
- **Triage by cost** — every incoming message hits a Haiku classifier first; only ~15% merit the full model
- **Ground in files** so the LLM doesn't re-ingest chat history each turn
- **Template anything deterministic** so structured output costs zero generated tokens
- **Route across providers** so we pick the cheapest adequate model per task instead of locking in to one expensive API

Same output quality. Architectural cost reduction, not feature reduction.

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the JARVIS 2.0 design in full — canonical archive substrate, retroactive query layer, reply pacer, anti-fabrication persona rules, and the density principle that ties them together.

Key mechanisms:

- **Canonical on-disk archive** — every message appended to `jsonl` on receipt; the substrate for grounded reporting, identity authority, and retroactive query.
- **Archive query tools** — six LLM-callable tools (`archive_search`, `archive_user_messages`, `archive_user_profile`, `archive_day`, `archive_recent`, `archive_roster`) that let the model query ground truth instead of hallucinating it.
- **Deterministic templates** — digests, stats, and structured output render from aggregated archive data with zero LLM generation.
- **Reply pacer** — rolling-window latency tracker sends a visible placeholder past mean+2σ, then edits to the real reply. Fixes the stalled-feel UX at zero cost.
- **Sharded architecture** — horizontal (by chat ID) + functional (by tool bundle), keeping individual LLM calls lean.
- **Anti-fabrication persona rules** — hard-coded identity authority, no invented milestones, no training confabulation, ground-before-answering. The rules are load-bearing, not decorative.

---

## Tier structure

| Tier | Access | Payment | For |
|---|---|---|---|
| **Community Free** | Hosted baseline | None | Small communities (<100 members, ~1K msg/day) |
| **Credit-Earning** | Hosted, contributions earn bandwidth | Archive data / federated shards / metrics / modules | Active contributors |
| **Crypto-Paid** | Higher throughput, bigger-model routing, priority queue, private deployments | USDC on Ethereum / Base / Arbitrum; native token optional | Power users, large communities |

OSS self-host is **not** currently a tier. See License below for the forward commitment.

---

## Access

Beta is invitation-only during bootstrap phase. Reach out via Telegram for access: [t.me/+3uHbNxyZH-tiOGY8](https://t.me/+3uHbNxyZH-tiOGY8)

---

## License

**Closed-source, all rights reserved.** Proprietary during bootstrap phase.

**Forward commitment**: JARVIS becomes source-available under a non-compete license once the hosted tier sustains infrastructure margin — defined as monthly revenue ≥ 2× monthly infrastructure costs for 3 consecutive months, OR 12 months from first paying customer, whichever first. This commitment is load-bearing. The propagation thesis requires eventual openness, and we're naming the milestone publicly so the promise is verifiable.

See [`LICENSE`](./LICENSE) for full terms.

---

## Why closed-source during bootstrap

Shipping the architecture OSS-first without VC or treasury backing means well-funded clones can launch the same service within a week, drain our infrastructure runway before the circular economy reaches escape velocity, and capture the market before the hosted tier has paying customers. The closed-source beta is the bootstrap mechanism — not the end state. The milestone commitment above is how we keep the propagation thesis intact while funding ourselves into position to deliver it.

---

## Contact

Telegram: [t.me/+3uHbNxyZH-tiOGY8](https://t.me/+3uHbNxyZH-tiOGY8)
