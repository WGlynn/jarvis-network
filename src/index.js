// ============ JARVIS Network — Bot Entry Point ============
//
// v0.6 wired handler chain:
//   - Onboarding + payment commands + /help (always accessible)
//   - Admin commands (owner-only enforced in handlers)
//   - Payment gate (silent-skips unpaid groups, passes DMs)
//   - Paid-only query commands (/ask /summary /search /recent)
//   - Main handler (archive + triage + Claude with rolling context)
//   - Health server for fly.io
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
import { handleMessage } from './handler.js';
import {
  handleHelp,
  handleAsk,
  handleSummary,
  handleSearch,
  handleRecent,
} from './commands.js';
import { startHealthServer } from './health.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('[jarvis-network] FATAL: TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const bot = new Telegraf(token);

// ============ Pre-gate commands ============
// Always accessible so unpaid groups can discover the product.
bot.command('help', handleHelp);
bot.command('subscribe', handleSubscribe);
bot.command('status', handleStatus);
bot.command('paid', handlePaid);
bot.command('admin_credit', handleAdminCredit);
bot.command('admin_revoke', handleAdminRevoke);
bot.command('admin_list', handleAdminList);

// ============ Payment gate ============
// Silent-skips non-DM groups without active subscription.
bot.use(gateMiddleware());

// ============ Post-gate commands (paid chats only) ============
bot.command('ask', handleAsk);
bot.command('summary', handleSummary);
bot.command('search', handleSearch);
bot.command('recent', handleRecent);

// ============ Main message handler ============
bot.on('text', handleMessage);

// Non-text messages (stickers, photos, voice, etc.) — archive-only for now.
bot.on(['sticker', 'photo', 'video', 'voice', 'document'], async ctx => {
  const { archiveFromContext } = await import('./archive.js');
  try {
    await archiveFromContext(ctx);
  } catch (err) {
    console.error('[index] non-text archive failed:', err.message);
  }
});

// ============ Boot ============

startHealthServer();

bot.launch().then(() => {
  console.log('[jarvis-network] bot launched');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
