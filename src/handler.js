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
import { getSystemPrompt, getPersonaName } from './personas.js';

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
      system: getSystemPrompt(),
      messages: getContext(chatId),
      model: MODELS.default,
      // v0.9.3: 512 was truncating substantive answers mid-sentence (observed
      // 2026-04-29 with Tadija's hormonal-loops question). 1500 covers
      // technical replies without runaway. Per-call cost up ~3x but only when
      // the full answer needs the room; short responses still cost the same.
      maxTokens: 1500,
      temperature: 0.7,
    });

    if (!response.text) return;

    appendMessage(chatId, 'assistant', response.text);
    recordEngage(chatId);

    // Archive the bot reply as its own record (model_used + bot_reply flag
    // feeds future v1 metering attribution).
    try {
      const personaName = getPersonaName();
      await appendToArchive(chatId, {
        message_id: null,
        chat_id: chatId,
        user_id: null,
        username: personaName.toLowerCase().replace(/\s.+/, ''),
        first_name: personaName,
        type: 'text',
        text: response.text,
        date: Math.floor(Date.now() / 1000),
        bot_reply: true,
        model_used: response.model,
        persona: process.env.JARVIS_PERSONA || 'standard',
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
