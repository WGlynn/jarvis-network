# Architecture

**Status**: pointer document. Full architecture spec lives at `vibeswap/jarvis-bot/docs/JARVIS_2.0.md` in the private VibeSwap repo. Copy the content here before first customer onboarding.

---

## Summary

JARVIS 2.0 is the grounded substrate upgrade from the stateless v1.x generator. The v1.x bot confabulated chat history (invented nicknames, fabricated milestones, miscounted stats) because it had no ground-truth source about the chat it was in — the LLM filled the slot. 2.0 closes that class of failure.

Key shifts:

| Axis | 1.x | 2.0 |
|---|---|---|
| Source of truth | LLM inference over in-memory state | Canonical on-disk archive (auditable jsonl) |
| Message coverage | Text only (stickers / media dropped) | All types: text, sticker, photo, video, voice, commands, joins, edits |
| Identity authority | Whatever the LLM generates | `users.json` + archive lookup; LLM instructed not to invent |
| Retroactive history | None | Full archive query API exposed as LLM tools |
| Digest fabrication slot | Free-form LLM closer | Deterministic template; no slot to fill |
| Long-reply UX | Silent pause → feels stalled | Pacer sends placeholder at mean+2σ, edits to real reply |

---

## Density principle

Every change in 2.0 shares the same theme: make bytes carry more.

- A 200-word LLM digest invents content. A 50-word deterministic template grounded in the archive reports reality.
- A 4096-token context that tries to remember everyone wastes weight on stale state. A 200-token archive query gets the exact fact needed.
- A 30-second silent generation reads as a stall. A 1-line placeholder at second 8 plus the real reply at second 20 reads as thought.

None of these changes add compute. They add information per byte. That's the axis that makes 2.0 different from 1.x — not more calls, not more tokens, not more parameters. Less, but load-bearing.

---

## Verifiability anchor

Every claim in this document is a candidate for cryptographic verification per the Verifiable Claims Roadmap in `README.md`. The architecture is closed-source, but the claims the architecture makes are not.

---

## TODO before first customer

- [ ] Copy full content from `vibeswap/jarvis-bot/docs/JARVIS_2.0.md` into this file
- [ ] Sanitize any VibeSwap-internal references that don't belong in a standalone JARVIS repo
- [ ] Commit binary hash (v0 verifiability milestone — see README)
- [ ] Set up signed-receipt pipeline for cost-claim proofs (v1 milestone)
