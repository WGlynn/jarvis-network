# Changelog

All version-by-version deltas for JARVIS Network.

Format: subject line from git commit + one-sentence summary + concrete change list.

---

## v0.9 — Personas (2026-04-23)

Four persona modes: standard / degen / analyst / sensei. Operator picks via `JARVIS_PERSONA` env.

- `src/personas.js` — tailored system prompts per mode; each carries load-bearing depth (MEV/cancer-cell in degen, no-prediction in analyst, explain-don't-oversimplify in sensei)
- `src/handler.js` — uses `getSystemPrompt()` instead of hard-coded standard voice
- Bot reply archive records now tag the persona used

## v0.8 — Expiry warnings + admin metrics (2026-04-23)

Customer retention + operator visibility.

- `src/expiry-watch.js` — hourly background loop; sends renewal warnings at 7/3/1/0-day thresholds; persists last-warning-threshold per customer to avoid restart re-sends
- `src/payment-gate.js` — `setCustomerMeta(chatId, patch)` for warning bookkeeping; `addCustomer` resets warning threshold on renewal
- `src/commands.js` — `/admin_metrics` (owner-only) shows active subs, expiring-≤7d, per-provider LLM usage
- `src/index.js` — wires `/admin_metrics` + starts expiry watcher after bot.launch()

## v0.7 — Multi-provider routing (2026-04-23)

Route between Anthropic / OpenRouter / Ollama. Makes the core-pitch "route across providers" claim real.

- `src/claude-client.js` — refactored to dispatch by `LLM_PROVIDER` env. Anthropic via `@anthropic-ai/sdk`; OpenRouter and Ollama via fetch-based OpenAI-compatible calls; per-provider token accounting
- `deploy/.env.template` — explicit config per backend (Anthropic / OpenRouter / Ollama)

## v0.6 — Command layer (2026-04-23)

Subscriber-facing tools through the chat.

- `src/commands.js` — `/help` (pre-gate, discoverable), `/ask` (direct Q&A, bypasses triage), `/summary` (deterministic digest, zero LLM tokens), `/search` (archive search), `/recent` (last N messages)
- `src/index.js` — commands wired pre-gate and post-gate per access requirement

## v0.5 — Haiku triage (2026-04-23)

Cost-controlled engagement filter. Only messages that earn the spend reach the default model.

- `src/triage.js` — `shouldEngage(text, {chatId})` → engage/observe; direct-mention bypass (`\b(jarvis|diablo)\b/i`), per-chat cooldown (10s default), global hourly cap (200/hr), Haiku-classifier fallback
- `src/handler.js` — triage before every full-model call; archive every message regardless

## v0.4 — Archive persistence (2026-04-23)

Append-only jsonl ground truth substrate. Filesystem IS the substrate (OSCH).

- `src/archive.js` — `appendToArchive` / `readArchiveDay` / `readRecent` / `searchArchive` / `aggregateDay`
- `src/handler.js` — archives every incoming message + bot reply with `model_used` + `bot_reply` flags
- `test/archive.test.js` — 6 unit tests (round-trip, multi-day, readRecent, search, aggregateDay, empty-chat)

## v0.3 — Claude handler + health endpoint (2026-04-23)

Real bot value behind the gate.

- `src/claude-client.js` — thin @anthropic-ai/sdk wrapper; retry on 429/503/529; token accounting
- `src/context.js` — rolling in-memory context per chat (MAX_CONTEXT_TURNS default 20)
- `src/handler.js` — message → context append → Claude call → reply
- `src/health.js` — HTTP /health + /metrics for fly.io probes

## v0.2 — On-chain payment verification (2026-04-23)

Customer flow end-to-end self-serve.

- `src/payment-listener.js` — verifies USDC Transfer events to `PAYMENT_USDC_ADDRESS` on Base; replay-protected via `claimed-txs.json`; `/paid <tx_hash> <chat_id>` command
- `src/index.js` — bot entry with payment commands wired pre-gate, handler stub post-gate
- `docs/onboarding.md` — customer activation guide

## v0.1 — Payment gate + deploy infrastructure (2026-04-23)

Subscription gate + deployment readiness.

- `src/payment-gate.js` — JSON-backed allowlist, `/subscribe`/`/status`/`/admin_credit`/`/admin_revoke`/`/admin_list`, silent-skip middleware
- `Dockerfile` — node:20-slim, computes binary hash at build time for v0 verifiability
- `docker-compose.yml` — env wiring across v0–v3
- `package.json` + `entrypoint.sh` — matching jarvis-bot patterns for later migration
- `.github/workflows/ci.yml` — syntax check + hash commitment per commit
- `deploy/fly.toml` + `.github/workflows/deploy.yml` — fly.io auto-deploy on master push
- `test/payment-gate.test.js` — 9 unit tests for gate logic

## v0 — Scaffold (2026-04-23)

Initial repo. Thesis, tier structure, verifiable claims roadmap.

- `README.md` — five architectural moves, tier table, Verifiable Claims Roadmap
- `ARCHITECTURE.md` — pointer to JARVIS 2.0 + density principle summary
- `LICENSE` — proprietary during bootstrap + binding milestone commitment (2× infra margin for 3mo OR 12mo)
- `docs/tier-structure.md` — four tiers + circular economy flow diagram
- `docs/crypto-primitive-selection.md` — decision tool for hash/ZK/Merkle/TEE/MPC/FHE/commit-reveal
- `docs/pitch.md` — canonical core pitch (full / condensed / one-liner / five-moves)
