// ============ User Commands ============
//
// v0.6 command set. Post-gate commands (/ask, /summary, /search, /recent)
// require an active subscription. /help runs everywhere so unauthorized
// groups see what they're subscribing to.
//
// Design notes:
//   - /summary uses archive.aggregateDay — ZERO LLM generation (the pitch's
//     "template deterministic" claim made concrete).
//   - /ask bypasses triage — user explicitly asked, always answer.
//   - /search runs through archive.searchArchive — grounded query, not
//     trained-knowledge guessing.
// ============

import { chat, MODELS, getUsage } from './claude-client.js';
import { aggregateDay, searchArchive, readRecent } from './archive.js';
import { listCustomers } from './payment-gate.js';

const OWNER_USER_ID = parseInt(process.env.TELEGRAM_OWNER_ID || '0', 10);
function isOwner(ctx) {
  return ctx.from && ctx.from.id === OWNER_USER_ID;
}

function stripCommand(text, cmd) {
  return text.replace(new RegExp(`^\\/${cmd}(@\\w+)?\\s*`, 'i'), '').trim();
}

// ============ /help ============

export async function handleHelp(ctx) {
  return ctx.reply(
    `JARVIS Network — commands\n\n` +
      `Onboarding (works everywhere):\n` +
      `  /subscribe       payment instructions + chat_id\n` +
      `  /status          subscription status\n` +
      `  /paid <tx> <chat_id>   activate after paying\n` +
      `  /help            this message\n\n` +
      `Query (paid chats only):\n` +
      `  /ask <question>  direct Q&A, bypasses triage\n` +
      `  /summary         today's activity digest (zero LLM tokens)\n` +
      `  /search <query>  search this chat's archive\n` +
      `  /recent [n]      last N messages (default 10)\n\n` +
      `Chat normally and JARVIS will engage on messages that merit a reply.`
  );
}

// ============ /ask ============

export async function handleAsk(ctx) {
  const question = stripCommand(ctx.message.text, 'ask');
  if (!question) return ctx.reply('Usage: /ask <question>');

  try {
    const response = await chat({
      system:
        "You are JARVIS. Answer the user's question directly. Technical, concise, 1–5 sentences. Admit when you don't know.",
      messages: [{ role: 'user', content: question }],
      model: MODELS.default,
      maxTokens: 512,
      temperature: 0.7,
    });
    return ctx.reply(response.text || '(no response)');
  } catch (err) {
    console.error('[commands] /ask failed:', err.message);
    return ctx.reply('Failed to answer. Try again in a moment.');
  }
}

// ============ /summary (deterministic, zero LLM tokens) ============

export async function handleSummary(ctx) {
  const agg = await aggregateDay(ctx.chat.id);
  if (agg.message_count === 0) {
    return ctx.reply('No activity in this chat today.');
  }
  const topUsers = agg.users
    .slice(0, 5)
    .map(u => `${u.user}: ${u.count}`)
    .join(', ');
  const typeBreakdown = Object.entries(agg.by_type)
    .map(([t, n]) => `${t}:${n}`)
    .join(' ');
  return ctx.reply(
    `Today (${agg.date} UTC):\n` +
      `Messages: ${agg.message_count}\n` +
      `Users: ${agg.user_count}\n` +
      `Top: ${topUsers}\n` +
      `Types: ${typeBreakdown}`
  );
}

// ============ /search ============

export async function handleSearch(ctx) {
  const query = stripCommand(ctx.message.text, 'search');
  if (!query) return ctx.reply('Usage: /search <query>');
  if (query.length < 2) return ctx.reply('Query too short (min 2 chars).');

  const hits = await searchArchive(ctx.chat.id, query, 10);
  if (hits.length === 0) {
    return ctx.reply(`No matches for "${query}".`);
  }
  const lines = hits.map(m => {
    const who = m.username || m.first_name || `user:${m.user_id}`;
    const ts = m.ts || (m.date ? m.date * 1000 : Date.now());
    const date = new Date(ts).toISOString().slice(0, 10);
    const text = (m.text || '').slice(0, 80);
    return `[${date}] ${who}: ${text}`;
  });
  return ctx.reply(`Matches for "${query}" (${hits.length}):\n${lines.join('\n')}`);
}

// ============ /recent ============

export async function handleRecent(ctx) {
  const parts = ctx.message.text.split(/\s+/);
  const n = Math.min(Math.max(parseInt(parts[1], 10) || 10, 1), 30);
  const recent = await readRecent(ctx.chat.id, n);
  if (recent.length === 0) return ctx.reply('No messages archived yet.');
  const lines = recent.map(m => {
    const who = m.username || m.first_name || `user:${m.user_id}`;
    const text = (m.text || `(${m.type})`).slice(0, 80);
    return `${who}: ${text}`;
  });
  return ctx.reply(`Last ${recent.length}:\n${lines.join('\n')}`);
}

// ============ /admin_metrics (owner only) ============

export async function handleAdminMetrics(ctx) {
  if (!isOwner(ctx)) return;

  const customers = await listCustomers();
  const now = Date.now();
  const active = customers.filter(c => c.plan === 'grandfathered' || c.expires_at > now);
  const paid = active.filter(c => c.plan !== 'grandfathered');
  const expiring7 = paid.filter(c => {
    const days = Math.floor((c.expires_at - now) / (24 * 60 * 60 * 1000));
    return days >= 0 && days <= 7;
  });

  const usage = getUsage();
  const totalIn = Object.values(usage).reduce((s, u) => s + u.in, 0);
  const totalOut = Object.values(usage).reduce((s, u) => s + u.out, 0);
  const totalCalls = Object.values(usage).reduce((s, u) => s + u.calls, 0);

  const perProvider = Object.entries(usage)
    .filter(([, u]) => u.calls > 0)
    .map(([p, u]) => `  ${p}: ${u.calls} calls, ${u.in}in/${u.out}out`)
    .join('\n') || '  (no calls yet this process)';

  return ctx.reply(
    `JARVIS Network — admin metrics\n\n` +
      `Active subscriptions: ${active.length}\n` +
      `  Paid: ${paid.length}\n` +
      `  Grandfathered: ${active.length - paid.length}\n` +
      `Expiring ≤7d: ${expiring7.length}\n\n` +
      `Total customers ever: ${customers.length}\n\n` +
      `LLM usage (this process):\n` +
      `  Total: ${totalCalls} calls, ${totalIn}in / ${totalOut}out tokens\n` +
      perProvider
  );
}
