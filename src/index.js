// ============ JARVIS Network — Bot Entry Point ============
//
// v0.1 wiring stub. Payment-gate middleware + command handlers are live here.
// Full bot handler chain (persona, intelligence, archive, tools, etc.) will
// be copied from vibeswap/jarvis-bot/src/index.js at bootstrap cut.
// When that happens, merge those handlers below the `gateMiddleware()` line
// — the gate enforces subscription access before they run.
// ============

import 'dotenv/config';
import { Telegraf } from 'telegraf';
import {
  gateMiddleware,
  handleSubscribe,
  handleStatus,
  handleAdminCredit,
  handleAdminRevoke,
  handleAdminList,
} from './payment-gate.js';
import { handlePaid } from './payment-listener.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('[jarvis-network] FATAL: TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const bot = new Telegraf(token);

// ============ Onboarding + payment commands ============
// Always accessible — required so unpaid groups can discover /subscribe.
bot.command('subscribe', handleSubscribe);
bot.command('status', handleStatus);
bot.command('paid', handlePaid);

// ============ Admin commands (owner-only enforced in handlers) ============
bot.command('admin_credit', handleAdminCredit);
bot.command('admin_revoke', handleAdminRevoke);
bot.command('admin_list', handleAdminList);

// ============ Payment gate ============
// Silent-skips non-DM groups without an active subscription.
// Must run AFTER the commands above (so /subscribe works in unpaid groups)
// and BEFORE the main handler chain.
bot.use(gateMiddleware());

// ============ Main bot handlers ============
// TODO at bootstrap cut: copy and merge from vibeswap/jarvis-bot/src/index.js.
// Current stub echoes a placeholder so gated chats know the gate works.

bot.on('message', ctx => {
  return ctx.reply(
    'JARVIS Network — gate active, handler chain pending.\n' +
      'Full bot pipeline loads at bootstrap cut.'
  );
});

// ============ Boot ============

bot.launch().then(() => {
  console.log('[jarvis-network] bot launched');
  const hashPath = '/app/.verifiability/binary-hash.txt';
  try {
    const hash = require('fs').readFileSync(hashPath, 'utf8').trim();
    console.log(`[jarvis-network] binary hash: ${hash}`);
  } catch {
    /* not in container; skip */
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
