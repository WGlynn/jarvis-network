# Core Pitch

The canonical explanation of why JARVIS Network is ~100x cheaper than paid-API wrappers. Use verbatim or adapted per audience.

---

## Full version

Good instinct on sharding — we run two kinds. **Chat-level**: a minimal router dispatches TG updates to N workers by chat ID, each one holds only its assigned chats' state. **Function-level**: separate tool bundles per domain (trading, social, security, memehunter, portfolio), and a workflow router picks the smallest relevant bundle per intent. Both keep individual LLM calls lean — no giant monolithic bot loading everything at once.

But the bigger cost-savers are the ones nobody sees. Every incoming message hits a Haiku classifier deciding "engage or observe" — only about 15% merit the full model, so we pay big-model prices only when a reply actually earns the spend. Structured outputs like digests and stats are template-filled from aggregated data instead of generated prose, which means **zero inference tokens** for anything deterministic. And the provider layer routes between Claude, free-tier alternatives, and self-hosted options so we pick the cheapest adequate model per task instead of locking into one expensive API.

The retroactive archive helps too, but it was really built to stop hallucination — saves tokens as a side effect, not the primary reason.

**The meta-principle**: every premium-API wrapper pays for one giant model call, every time, with all context loaded. We shard by function, triage by cost, ground in files instead of tokens, and template anything deterministic. **Same output quality, about 100x cheaper.** That's the pitch.

---

## Condensed (one paragraph)

Every premium-API wrapper pays for one giant model call with all context loaded, every message. JARVIS shards by function (scoped prompts), triages by cost (Haiku classifier, only 15% hit the full model), grounds in files (LLM queries archive instead of re-ingesting), and templates deterministic output (zero generated tokens for digests/stats). Same output quality, ~100x cheaper.

---

## One-liner

> ~100x cheaper than paid-API wrappers because we don't pay for a giant model call every message with all context loaded.

---

## Five architectural moves (bullet form)

Used in README.md, landing page, Twitter threads.

- **Shard by function** — each call's prompt scoped to current intent, not the whole bot state
- **Triage by cost** — Haiku classifier on every message; only ~15% merit the full model
- **Ground in files** — LLM doesn't re-ingest chat history each turn; queries ground truth via tool calls
- **Template deterministic output** — digests, stats, structured output cost zero generated tokens
- **Route across providers** — cheapest adequate model per task; no lock-in to one expensive API

---

## When to use which version

| Context | Version |
|---|---|
| Customer DM asks "how are you cheaper?" | Full version |
| Investor pitch / deck slide | One-liner + specific numbers (15%, zero, 100x) |
| Community / Rodney-class architecture question | Full version verbatim |
| Telegram group answer | Condensed |
| Onboarding one-pager | Five moves + condensed |
| LinkedIn post | Five moves wrapped in concrete-first opener (see [internal primitive](../../memory/primitive_concrete-first-post-register.md)) |

---

## Don'ts

- **Don't lead with the archive.** It's a side-benefit. Leading with it buries the real cost-saver story.
- **Don't drop "one giant model call, every time, with all context loaded."** That line is the structural argument that makes every bullet non-contradictable.
- **Don't hedge the 100x claim below ~10x.** The math supports it; v1 Verifiable Claims Roadmap (see [`../README.md`](../README.md)) proves it cryptographically.
- **Don't over-technicalize.** "Haiku classifier," "tool bundles," "provider layer" are the right level. No "LLM triage orchestrator" or "specialized micro-agents."
- **Don't abandon the exact numbers** (15%, zero, 100x). Load-bearing specifics.

---

## Verifiability hook

The 100x claim becomes a provable claim in v1 per the [Verifiable Claims Roadmap](../README.md#verifiable-claims-roadmap). ZK proof from signed LLM-provider receipts + message counter will publish monthly cost-per-message ratio on-chain — "~100x cheaper than [competitor]" turns from pitch line to audit-verifiable property.

---

## Related

- [`../README.md`](../README.md) — five moves + tiers + Verifiable Claims Roadmap
- [`../landing/index.html`](../landing/index.html) — public-facing landing page
- [`onboarding.md`](./onboarding.md) — customer activation flow
- [`pricing.md`](./pricing.md) — $3–5 per 10K-message target vs ChatGPT Team's $30/user/month
- [`crypto-primitive-selection.md`](./crypto-primitive-selection.md) — which primitives prove which claim
