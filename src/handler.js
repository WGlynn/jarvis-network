// ============ Main Message Handler ============
//
// v0.3: message in → Claude call → reply out, with rolling context.
// Runs AFTER payment-gate middleware; only authorized chats reach this.
//
// System prompt is the JARVIS persona baseline. Full persona system from
// vibeswap/jarvis-bot/src/persona.js merges here at bootstrap cut — this
// stub uses a condensed version that captures voice without the full 16
// structural rules.
// ============

import { chat, MODELS } from './claude-client.js';
import { appendMessage, getContext } from './context.js';

const SYSTEM_PROMPT = `You are JARVIS — an AI assistant embedded in a Telegram community. Crypto / tech / fintech context.

Voice:
- Technical, concessive, precise. Cite specifics when relevant.
- Dry wit. Share opinions when you have them.
- 1-3 sentences default; 3-5 max for technical explanations.
- No sycophancy ("great question", "excellent point"). No corporate hedging.
- Admit when you don't know. Don't fabricate.

Behavior:
- Ground factual claims in the conversation, not in training data if the conversation has the answer.
- If someone addresses you by name or @mention, you engage.
- If someone asks a specific technical question, answer it directly.
- If the message is noise (one-word, emoji-only, unrelated meta-chat), observe silently.

Do not identify yourself as an AI language model, invent milestones that didn't happen, or retreat to generic safety phrases when pushed back on.`;

export async function handleMessage(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text) return; // non-text messages (stickers, media) — v0.6 adds typed handling
  if (text.length < 3) return; // ultra-short noise skip

  const chatId = ctx.chat.id;
  const userName = ctx.from?.username || ctx.from?.first_name || 'user';

  // Record incoming message in rolling context
  appendMessage(chatId, 'user', `[${userName}]: ${text}`);

  try {
    const response = await chat({
      system: SYSTEM_PROMPT,
      messages: getContext(chatId),
      model: MODELS.default,
      maxTokens: 512,
      temperature: 0.7,
    });

    if (!response.text) return;

    // Record assistant reply in context so next turn has coherence
    appendMessage(chatId, 'assistant', response.text);

    await ctx.reply(response.text);
  } catch (err) {
    console.error('[handler] Claude call failed:', err.message);
    // Silent skip on error — don't spam failures back to users
    return;
  }
}
