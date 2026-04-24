// ============ Main Message Handler ============
//
// v0.3: message in → Claude call → reply out, rolling in-memory context.
// v0.4: archive every message + bot reply; archive is ground truth.
// v0.5: Haiku triage gates the full-model call — only engages when the
//       reply earns the spend. Per-chat cooldown + hourly cap + mention
//       bypass. Implements the core-pitch "15% merit the full model" claim.
// ============

import { chat, MODELS } from './claude-client.js';
import { appendMessage, getContext } from './context.js';
import { archiveFromContext, appendToArchive } from './archive.js';
import { shouldEngage, recordEngage } from './triage.js';

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
  // v0.4: archive every incoming message regardless of engagement decision.
  try {
    await archiveFromContext(ctx);
  } catch (err) {
    console.error('[handler] archive append failed:', err.message);
  }

  const text = ctx.message?.text?.trim();
  if (!text) return;

  const chatId = ctx.chat.id;
  const userName = ctx.from?.username || ctx.from?.first_name || 'user';

  // v0.5: Haiku-powered triage. Most messages observe; only ~15% engage.
  const triage = await shouldEngage(text, { chatId });
  if (!triage.engage) {
    console.log(
      `[handler] observe chat=${chatId}: ${triage.reason}` +
        (triage.confidence != null ? ` (conf=${triage.confidence})` : '')
    );
    return;
  }

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

    appendMessage(chatId, 'assistant', response.text);
    recordEngage(chatId);

    // Archive the bot reply as its own record (model_used + bot_reply flag
    // feeds future v1 metering attribution).
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
