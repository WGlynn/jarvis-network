# Customer Onboarding

How a new customer activates a JARVIS Network subscription.

---

## Quick flow (v0.1)

1. **Add bot to group** — invite `@jarvis_network_bot` (TBD) to your Telegram group. Grant admin permissions so it can read + respond.
2. **Get chat ID** — in the group, run `/subscribe`. The bot replies with payment instructions and the group's `chat_id` (negative number like `-1001234567890`).
3. **Send USDC** — send 29 USDC on Base to the address shown in `/subscribe`.
4. **Activate** — DM the bot (not the group):
   ```
   /paid <tx_hash> <chat_id>
   ```
   Example:
   ```
   /paid 0xabc123def456... -1001234567890
   ```
5. **Confirmation** — bot verifies on-chain, credits your chat. Confirmation message in the DM.
6. **Check status anytime** — `/status` in the group shows days remaining.
7. **Renew** — send another 29 USDC, run `/paid` again with the new tx hash. Time extends from current expiry.

---

## Pricing

| Item | Cost |
|---|---|
| Monthly subscription | 29 USDC |
| Renewal | 29 USDC per additional month |
| Multiple months | Send N × 29 USDC in one tx; bot credits N months |

---

## Payment method

- **Chain**: Base mainnet (low fees, fast confirmations)
- **Token**: USDC — contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Other chains in v0.3**: Ethereum L1, Arbitrum
- **Native token / credit-earning tier**: v3+

---

## Troubleshooting

- **"Transaction not found — may not be confirmed yet"** — wait ~30s and retry. RPC lag is normal.
- **"No USDC transfers to [address] found"** — the transaction didn't transfer USDC to our payment address. Double-check recipient.
- **"Transaction already claimed"** — this tx hash has been used. Send a new payment.
- **"Transfer amount X USDC below required 29"** — you sent less than the monthly price. Short amount is not auto-refunded; contact admin.
- **`/admin_credit` by admin as fallback** — if something fails, the admin can manually credit via `/admin_credit <chat_id> <days>`. Useful for promos, comps, or recovery from listener edge cases.

---

## What gets stored

Per customer record:
- `chat_id` — the group ID being gated
- `expires_at` — subscription expiry timestamp
- `plan` — `monthly` | `custom` | `grandfathered`
- `notes` — including the tx hash + sender wallet for audit

Admins can see all records via `/admin_list`. No other PII stored.

---

## Owner commands

| Command | What it does |
|---|---|
| `/admin_credit <chat_id> <days> [notes]` | Add days to a chat's subscription (or create fresh) |
| `/admin_revoke <chat_id>` | Remove a chat from the allowlist immediately |
| `/admin_list` | List all customer records with status |

Owner is the Telegram user ID in `TELEGRAM_OWNER_ID` env. Non-owners silently get no response.

---

## Grandfathered chats

Chat IDs listed in `GRANDFATHERED_CHAT_IDS` env (comma-separated) never require a subscription. Use this for:
- Internal dev/test chats
- Existing communities that predate the paid tier (VibeSwap TG, Ark group, etc.)
- Compensated access

---

## v0.2 roadmap

- Background poller watches `PAYMENT_USDC_ADDRESS` for incoming transfers. Customers who pre-register their sender wallet get auto-credited without the `/paid` step.
- Multi-chain support: Ethereum L1 + Arbitrum USDC.
- Expiry warnings: bot notifies group 7/3/1 days before subscription lapses.

---

## Related

- [`tier-structure.md`](./tier-structure.md) — full tier map (Community Free / Credit-Earning / Crypto-Paid / OSS)
- [`pricing.md`](./pricing.md) — v2 pricing spec
- [`crypto-primitive-selection.md`](./crypto-primitive-selection.md) — why on-chain verification fits this layer
