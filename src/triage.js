// ============ Haiku Triage — Cost-Controlled Engagement Filter ============
//
// v0.5 implementation of the core pitch's biggest cost-saver: "every
// incoming message hits a Haiku classifier deciding engage or observe —
// only about 15% merit the full model."
//
// Haiku is ~50x cheaper than Opus, ~10x cheaper than Sonnet. Running it
// as a gate on every message means we pay big-model prices only when a
// reply actually earns the spend.
//
// Plus a per-chat cooldown (default 10s) so the bot doesn't reply to
// every single message in a burst. Direct mentions bypass both triage
// and cooldown — ignoring someone calling the bot by name is the worst
// feel-failure in a group chat.
// ============

import { chat, MODELS } from './claude-client.js';

const COOLDOWN_MS = parseInt(process.env.TRIAGE_COOLDOWN_MS || '10000', 10);
const MAX_ENGAGEMENTS_PER_HOUR = parseInt(process.env.MAX_ENGAGEMENTS_PER_HOUR || '200', 10);
const BOT_NAMES = (process.env.BOT_NAMES || 'jarvis,diablo')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const ENGAGE_THRESHOLD = parseFloat(process.env.ENGAGE_CONFIDENCE_THRESHOLD || '0.5');

const lastEngageByChat = new Map();
let engagementsThisHour = 0;
let hourResetTs = Date.now();

function mentionsBot(text) {
  const lower = text.toLowerCase();
  return BOT_NAMES.some(name => new RegExp(`\\b${name}\\b`, 'i').test(lower));
}

function onCooldown(chatId) {
  const last = lastEngageByChat.get(chatId);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

function canEngageGlobal() {
  const now = Date.now();
  if (now - hourResetTs > 60 * 60 * 1000) {
    engagementsThisHour = 0;
    hourResetTs = now;
  }
  return engagementsThisHour < MAX_ENGAGEMENTS_PER_HOUR;
}

export function recordEngage(chatId) {
  lastEngageByChat.set(chatId, Date.now());
  engagementsThisHour += 1;
}

/**
 * Decide whether JARVIS should engage with a given message.
 * Returns { engage, reason, confidence, bypass }.
 *
 * Flow:
 *   - Text too short → observe
 *   - Global hourly cap hit → observe (hard safety)
 *   - Direct mention → engage (bypasses cooldown)
 *   - On cooldown → observe
 *   - Else: Haiku classifier decides
 */
export async function shouldEngage(text, { chatId } = {}) {
  if (!text || text.length < 3) {
    return { engage: false, reason: 'too_short', bypass: false };
  }

  if (!canEngageGlobal()) {
    return { engage: false, reason: 'hourly_cap', bypass: false };
  }

  if (mentionsBot(text)) {
    // Direct mention bypasses both cooldown and triage confidence.
    return { engage: true, reason: 'direct_mention', confidence: 0.99, bypass: true };
  }

  if (chatId !== undefined && onCooldown(chatId)) {
    return { engage: false, reason: 'cooldown', bypass: false };
  }

  // Haiku-powered classifier
  try {
    const response = await chat({
      system: `You are JARVIS's engagement classifier. Decide whether JARVIS (a helpful AI in a Telegram community) should reply to a given message.

Return ONE JSON object: {"action":"engage"|"observe","confidence":0.0-1.0,"reason":"short reason"}

ENGAGE when:
- The message asks a question someone could reasonably answer
- It addresses the bot or the community
- It shares technical content worth commenting on
- It's a market take or debate that benefits from a take
- Personal disclosure or vulnerability (community glue matters)

OBSERVE when:
- One-word reactions (lol, k, ok, fr, W)
- Pure emoji / sticker-only text
- Direct back-and-forth between two humans not needing input
- Noise or off-topic chatter
- Already-answered questions in the immediate prior context`,
      messages: [{ role: 'user', content: text }],
      model: MODELS.haiku,
      maxTokens: 100,
      temperature: 0.1,
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { engage: false, reason: 'parse_error', bypass: false };

    const result = JSON.parse(jsonMatch[0]);
    const engage = result.action === 'engage' && (result.confidence || 0) >= ENGAGE_THRESHOLD;
    return {
      engage,
      reason: result.reason || 'classifier',
      confidence: result.confidence,
      bypass: false,
    };
  } catch (err) {
    // On triage failure, default to observe to avoid spamming noise.
    return { engage: false, reason: `triage_error: ${err.message}`, bypass: false };
  }
}
