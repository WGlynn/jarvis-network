# Launch Checklist

Step-by-step from zero to live payment-gated bot on Telegram.

---

## 1. Create the Telegram bot

1. DM [@BotFather](https://t.me/BotFather) on Telegram.
2. `/newbot` → pick a display name (e.g. `JARVIS Network`) and a handle (e.g. `@jarvis_network_bot`).
3. BotFather returns a token like `1234567890:AA...`. Save it — this is `TELEGRAM_BOT_TOKEN`.
4. Recommended: `/setprivacy` → disabled (the bot needs to see all group messages, not just @mentions).
5. Recommended: `/setcommands` — paste:

   ```
   help - command reference
   subscribe - payment instructions + chat_id
   status - subscription status
   paid - activate after paying (/paid <tx> <chat_id>)
   ask - direct Q&A, paid chats only
   summary - today's activity digest, paid chats only
   search - archive search, paid chats only
   recent - last N messages, paid chats only
   ```

## 2. Get your Telegram user ID

DM [@userinfobot](https://t.me/userinfobot) — it replies with your numeric user ID. Save it — this is `TELEGRAM_OWNER_ID`. Required for admin commands.

## 3. Set up the USDC payment wallet

Any wallet you control on Base mainnet:
- MetaMask with Base network added
- Coinbase Wallet
- Rabby
- Hardware wallet (recommended for holding customer funds)

Save the address — this is `PAYMENT_USDC_ADDRESS`.

## 4. Provision fly.io

```bash
flyctl auth login
flyctl apps create jarvis-network
flyctl volumes create jarvis_data -a jarvis-network -r ord --size 10
```

Replace `ord` with your preferred region (see `flyctl platform regions`).

## 5. Set fly.io secrets

```bash
flyctl secrets set -a jarvis-network \
  TELEGRAM_BOT_TOKEN=<from step 1> \
  ANTHROPIC_API_KEY=<your Anthropic key> \
  TELEGRAM_OWNER_ID=<from step 2> \
  PAYMENT_USDC_ADDRESS=<from step 3>
```

Optional secrets (have sensible defaults):
- `CLAUDE_MODEL` (default `claude-haiku-4-5-20251001`)
- `PRICE_USDC_PER_MONTH` (default 29)
- `JARVIS_PERSONA` (default `standard`; or `degen`/`analyst`/`sensei`)
- `GRANDFATHERED_CHAT_IDS` (comma-separated; chats that never need subscription)
- `BASE_RPC_URL` (default `https://mainnet.base.org`; override with Alchemy for throughput)
- `BOT_NAMES` (default `jarvis,diablo`; regex-matched for mention-bypass)

## 6. Set up CI deploy secret

In GitHub repo settings → Secrets and variables → Actions:
- Add `FLY_API_TOKEN` — get via `flyctl auth token`

This lets `.github/workflows/deploy.yml` push to fly on every master push.

## 7. First deploy

Either manual:
```bash
flyctl deploy --config deploy/fly.toml --remote-only -a jarvis-network
```

Or push anything to master — CI triggers the deploy workflow automatically.

## 8. Verify boot

```bash
curl https://jarvis-network.fly.dev/health
```

Should return JSON with `{"status":"ok", "uptime_s": N, "binary_hash": "...", "usage": {...}}`.

Also: `flyctl logs -a jarvis-network` should show `[jarvis-network] bot launched` + `[health] Listening on :8080` + `[expiry-watch] started`.

## 9. Smoke test in Telegram

1. DM the bot `/help` — should reply with command list.
2. In a test group, add the bot + make it admin.
3. Run `/status` — should say "not subscribed, chat_id: -100XXXXX".
4. Run `/subscribe` — should print payment address.
5. Send 29 USDC from a test wallet.
6. DM bot `/paid <tx_hash> <chat_id>` — should verify and credit.
7. Run `/status` again — "active, 30 days remaining".
8. Send a test message in the group — bot should triage + respond if merited.

## 10. Grandfather internal chats (optional)

For chats you never want to pay (VibeSwap TG, team Ark group, test chats):

```bash
flyctl secrets set -a jarvis-network \
  GRANDFATHERED_CHAT_IDS="-1001234567890,-1009876543210"
```

Bot will skip the payment gate for those chat IDs.

## 11. First external customer

- Share the bot handle (from step 1).
- Point them at `docs/onboarding.md` or walk them through manually.
- Monitor via `/admin_metrics` in your DM with the bot.

---

## Ongoing ops

- **Check subscriptions**: DM bot `/admin_list` to see all customers + days remaining.
- **Manual credit**: DM bot `/admin_credit <chat_id> <days> [notes]` for promos/comps/recovery.
- **Usage metrics**: DM bot `/admin_metrics` for LLM call counts + token usage.
- **Revoke**: DM bot `/admin_revoke <chat_id>` to remove access immediately.
- **Logs**: `flyctl logs -a jarvis-network --tail` during incidents.
- **Scale up**: `flyctl scale count 2 -a jarvis-network` if a single worker gets overloaded (archive is per-chat so workers don't need state sync for v0).

---

## Troubleshooting

- **Bot doesn't respond in a paid chat**: check `/admin_list` for actual expiry; check `flyctl logs` for triage decisions.
- **"Transaction not found"**: Base RPC lag — retry in 30s.
- **High cost per message**: check `/admin_metrics`. If `anthropic` calls dominate despite `LLM_PROVIDER=openrouter`, env isn't loaded correctly.
- **Expiry warnings not sending**: check `[expiry-watch]` log lines; watcher runs hourly after a 30s initial delay.

---

## Related

- [`README.md`](./README.md) — thesis + tiers + Verifiable Claims Roadmap
- [`docs/onboarding.md`](./docs/onboarding.md) — customer-facing activation flow
- [`docs/pitch.md`](./docs/pitch.md) — canonical pitch language for marketing
- [`docs/pricing.md`](./docs/pricing.md) — v2 pricing spec
- [`deploy/.env.template`](./deploy/.env.template) — full env var reference
- [`CHANGELOG.md`](./CHANGELOG.md) — version history
