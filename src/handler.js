// ============ Main Message Handler ============
//
// v0.3: message in → Claude call → reply out, rolling in-memory context.
// v0.4: archive every incoming message + bot reply. Context still in-memory
//       for hot-path coherence; archive is ground truth for queries and
//       future grounded tool calls.
// ============

import { chat, MODELS } from './claude-client.js';
import { appendMessage, getContext } from './context.js';
import { archiveFromContext, appendToArchive } from './archive.js';

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
  // Archive every incoming message (text + non-text). Ground-truth substrate.
  try {
    await archiveFromContext(ctx);
  } catch (err) {
    console.error('[handler] archive append failed:', err.message);
    // Don't abort the reply path on archive errors.
  }

  const text = ctx.message?.text?.trim();
  if (!text) return; // non-text: archived, no reply
  if (text.length < 3) return; // ultra-short noise skip

  const chatId = ctx.chat.id;
  const userName = ctx.from?.username || ctx.from?.first_name || 'user';

  // Record incoming message in rolling in-memory context (hot path).
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

    // Record assistant reply in context + archive.
    appendMessage(chatId, 'assistant', response.text);

    // Archive the bot reply as its own record.
    try {
      await appendToArchive(chatId, {
        message_id: null,
        chat_id: chatId,
        user_id: null,
        username: 'jarvis',
        first_name: 'JARVIS',
        type: 'text',
        text: response.text,
        date: Math.floor(Date.now() / 1000),
        bot_reply: true,
        model_used: response.model,
      });
    } catch (err) {
      console.error('[handler] reply archive failed:', err.message);
    }

    await ctx.reply(response.text);
  } catch (err) {
    console.error('[handler] Claude call failed:', err.message);
    return;
  }
}
