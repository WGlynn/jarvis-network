# Changelog

All version-by-version deltas for JARVIS Network.

Format: subject line from git commit + one-sentence summary + concrete change list.

---

## v0.9.3 — Bump maxTokens for substantive answers (2026-04-29)

Observed 2026-04-29 in production: bot truncating mid-sentence on Tadija's hormonal-loops question ("That's a solid observation, tadija. You're describing a system" — stopped at the token ceiling). Earlier reply also clipped ("more opportunity for real" — fragment ending). Both at 512-token cap.

- `src/handler.js` — `maxTokens` bumped 512 → 1500. Per-call cost rises proportionally only when the full reply needs the room; short replies still cost the same. Substantive technical engagement requires the headroom.

## v0.9.2 — Open access by default (2026-04-29)

The bot was previously gated by subscription (USDC on Base, /admin_credit). After successful scale validation, dropping the paywall to make access permissive — anyone in any group chat the bot is in can now interact, regardless of subscription state. Subscription commands (/subscribe, /status, /admin_credit, /admin_revoke, /admin_list) still work for those who want to support; the gate just doesn't block message processing anymore.

- `src/payment-gate.js` — added `OPEN_ACCESS` env var (defaults to `true`); `gateMiddleware()` short-circuits to `next()` when open-access is on. All other subscription / admin / expiry logic untouched. Set `OPEN_ACCESS=false` to re-enable the paywall.

Note: triage-layer rate limits (cooldown / hourly cap / engage threshold) are UNTOUCHED. Those are the cost-control mechanism that makes scaling work — removing them would explode API spend. Open access raises the user-count ceiling; triage keeps per-message cost bounded. Two distinct knobs.

## v0.9.1 — Standard persona hardening (2026-04-29)

Strengthened the `standard` persona system prompt with explicit anti-patterns observed in the wild — the bot was producing third-person narration ("it sounds like you're exploring..."), generic-AI sycophancy ("thank you for your kindness", "beautiful sentiment"), context bleeds (a "cattooo" hallucination from elsewhere), and zero-substance acknowledgments of named technical concepts (Muon, mHC, V4 dropped without engagement).

- `src/personas.js` — `standard` persona now includes: (1) anti-narration rule — no third-person, no "it sounds like"; (2) expanded sycophancy ban covering "thank you for your X" patterns; (3) no generic affirmations ("beautiful sentiment", "I appreciate the thought"); (4) context-isolation rule — no inserting names/emojis/words from outside the current chat; (5) first-person grounding; (6) technical-engagement-required — when a named technical reference appears, engage with it specifically or admit not knowing; (7) ban on meaningless-filler responses like "I'm excited to learn more"
- No interface changes; persona swap is in-place

Trigger: 2026-04-29 Tadija Telegram exchange where the bot produced all the above failure modes simultaneously while running on OpenRouter free-tier (Llama 3.2 3B per default). Substrate floor matters too — recommend deployment env: `LLM_PROVIDER=anthropic` + `CLAUDE_MODEL=claude-haiku-4-5-20251001` (or `claude-sonnet-4-6` for technical-heavy chats).

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
