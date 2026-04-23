// ============ Payment Gate — Access Control + Subscription Tracking ============
//
// v0.1: manual subscription management via admin commands.
// Customer sends USDC off-band → admin credits their chat via /admin_credit.
// Groups without active subscription get silent skip (no bot replies).
//
// v0.2 (next): automated on-chain payment listener replaces manual /admin_credit.
// v2+: integrated with credit-earning tier (Shapley-weighted credits offset fees).
//
// Storage: JSON file (customers.json) in DATA_DIR. Simple, durable, greppable.
// Schema:
//   {
//     "customers": {
//       "<chatId>": {
//         "expires_at": <unix_ms>,
//         "plan": "monthly" | "custom",
//         "notes": "...",
//         "updated_at": <unix_ms>
//       }
//     }
//   }
//
// Env vars required:
//   TELEGRAM_OWNER_ID          numeric Telegram user ID of the admin
//   PAYMENT_USDC_ADDRESS       Base-chain USDC address customers pay to
//   PRICE_USDC_PER_MONTH       default 29
//   GRANDFATHERED_CHAT_IDS     comma-separated; existing chats that never need a subscription
// ============

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const CUSTOMERS_FILE = join(DATA_DIR, 'customers.json');
const OWNER_USER_ID = parseInt(process.env.TELEGRAM_OWNER_ID || '0', 10);
const GRANDFATHERED_CHAT_IDS = (process.env.GRANDFATHERED_CHAT_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(s => parseInt(s, 10));
const PAYMENT_ADDRESS = process.env.PAYMENT_USDC_ADDRESS || '<set PAYMENT_USDC_ADDRESS>';
const PRICE_PER_MONTH = process.env.PRICE_USDC_PER_MONTH || '29';

let customers = {};
let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const data = await readFile(CUSTOMERS_FILE, 'utf8');
    customers = JSON.parse(data).customers || {};
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    customers = {};
    await persist();
  }
  loaded = true;
}

async function persist() {
  await writeFile(CUSTOMERS_FILE, JSON.stringify({ customers }, null, 2));
}

// ============ Core gate logic ============

export async function isAuthorized(chatId) {
  await ensureLoaded();
  if (GRANDFATHERED_CHAT_IDS.includes(chatId)) return true;
  const c = customers[String(chatId)];
  if (c && c.expires_at > Date.now()) return true;
  return false;
}

export async function getStatus(chatId) {
  await ensureLoaded();
  if (GRANDFATHERED_CHAT_IDS.includes(chatId)) {
    return { authorized: true, plan: 'grandfathered', expires_at: null, days_remaining: null };
  }
  const c = customers[String(chatId)];
  if (!c) return { authorized: false, plan: null, expires_at: null, days_remaining: 0 };
  const days_remaining = Math.max(
    0,
    Math.floor((c.expires_at - Date.now()) / (24 * 60 * 60 * 1000))
  );
  return {
    authorized: c.expires_at > Date.now(),
    plan: c.plan,
    expires_at: c.expires_at,
    days_remaining,
  };
}

// ============ Admin operations ============

export async function addCustomer(chatId, days, plan = 'monthly', notes = '') {
  await ensureLoaded();
  const key = String(chatId);
  const existing = customers[key];
  const now = Date.now();
  const base = existing && existing.expires_at > now ? existing.expires_at : now;
  const expires_at = base + days * 24 * 60 * 60 * 1000;
  customers[key] = { expires_at, plan, notes, updated_at: now };
  await persist();
  return customers[key];
}

export async function removeCustomer(chatId) {
  await ensureLoaded();
  delete customers[String(chatId)];
  await persist();
}

export async function listCustomers() {
  await ensureLoaded();
  return Object.entries(customers).map(([chatId, c]) => ({ chatId, ...c }));
}

function isOwner(ctx) {
  return ctx.from && ctx.from.id === OWNER_USER_ID;
}

// ============ Telegram command handlers ============

export async function handleSubscribe(ctx) {
  const chatId = ctx.chat.id;
  const status = await getStatus(chatId);
  if (status.authorized) {
    return ctx.reply(
      status.plan === 'grandfathered'
        ? 'This chat has grandfathered access.'
        : `Active subscription: ${status.days_remaining} days remaining.`
    );
  }
  return ctx.reply(
    `JARVIS Network — Subscription\n\n` +
      `Price: ${PRICE_PER_MONTH} USDC / month\n` +
      `Payment: USDC on Base\n` +
      `Address: ${PAYMENT_ADDRESS}\n\n` +
      `Steps:\n` +
      `1. Send ${PRICE_PER_MONTH} USDC to the address above.\n` +
      `2. Reply here with your transaction hash.\n` +
      `3. Within ~24h you'll be activated.\n\n` +
      `Chat ID: ${chatId}\n` +
      `(include this in your payment message so we credit the right chat)`
  );
}

export async function handleStatus(ctx) {
  const chatId = ctx.chat.id;
  const status = await getStatus(chatId);
  if (!status.authorized) {
    return ctx.reply(
      `Status: not subscribed.\n` + `Chat ID: ${chatId}\n` + `Send /subscribe for payment details.`
    );
  }
  if (status.plan === 'grandfathered') {
    return ctx.reply('Status: grandfathered (internal chat).');
  }
  return ctx.reply(
    `Status: active\n` +
      `Plan: ${status.plan}\n` +
      `Days remaining: ${status.days_remaining}\n` +
      `Expires: ${new Date(status.expires_at).toISOString()}`
  );
}

export async function handleAdminCredit(ctx) {
  if (!isOwner(ctx)) return;
  const parts = ctx.message.text.split(/\s+/);
  const chatId = parseInt(parts[1], 10);
  const days = parseInt(parts[2], 10);
  const notes = parts.slice(3).join(' ');
  if (!chatId || !days) {
    return ctx.reply('Usage: /admin_credit <chat_id> <days> [notes]');
  }
  const record = await addCustomer(chatId, days, 'monthly', notes);
  return ctx.reply(
    `Credited chat ${chatId} with ${days} days.\n` +
      `New expiry: ${new Date(record.expires_at).toISOString()}`
  );
}

export async function handleAdminRevoke(ctx) {
  if (!isOwner(ctx)) return;
  const parts = ctx.message.text.split(/\s+/);
  const chatId = parseInt(parts[1], 10);
  if (!chatId) return ctx.reply('Usage: /admin_revoke <chat_id>');
  await removeCustomer(chatId);
  return ctx.reply(`Revoked chat ${chatId}.`);
}

export async function handleAdminList(ctx) {
  if (!isOwner(ctx)) return;
  const list = await listCustomers();
  if (list.length === 0) return ctx.reply('No customers.');
  const lines = list.map(c => {
    const days = Math.max(0, Math.floor((c.expires_at - Date.now()) / (24 * 60 * 60 * 1000)));
    const active = c.expires_at > Date.now() ? '✓' : '✗';
    return `${active} ${c.chatId} — ${days}d — ${c.plan}${c.notes ? ' — ' + c.notes : ''}`;
  });
  return ctx.reply(`Customers:\n${lines.join('\n')}`);
}

// ============ Middleware ============
//
// Drop-in Telegraf middleware. Gates group-chat message processing.
// DMs to the bot are always allowed (for /subscribe onboarding + admin commands).
//
// Wire in src/index.js BEFORE main message handlers but AFTER /subscribe and /status:
//
//   import { gateMiddleware, handleSubscribe, handleStatus,
//            handleAdminCredit, handleAdminRevoke, handleAdminList } from './payment-gate.js';
//
//   bot.command('subscribe', handleSubscribe);
//   bot.command('status', handleStatus);
//   bot.command('admin_credit', handleAdminCredit);
//   bot.command('admin_revoke', handleAdminRevoke);
//   bot.command('admin_list', handleAdminList);
//   bot.use(gateMiddleware());
//   // main handlers below

export function gateMiddleware() {
  return async (ctx, next) => {
    const chatType = ctx.chat?.type;
    if (chatType === 'private') return next();
    if (!ctx.chat?.id) return next();
    const authorized = await isAuthorized(ctx.chat.id);
    if (authorized) return next();
    return; // silent skip — no next() call
  };
}
