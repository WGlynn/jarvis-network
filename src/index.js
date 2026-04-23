// ============ JARVIS Network — Bot Entry Point ============
//
// v0.3: wired handler chain.
//   - Onboarding + payment commands (always accessible)
//   - Admin commands (owner-only enforced in handlers)
//   - Payment gate (silent-skips unpaid groups, passes DMs)
//   - Main handler (Claude call with rolling context)
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
import { startHealthServer } from './health.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('[jarvis-network] FATAL: TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const bot = new Telegraf(token);

// ============ Onboarding + payment commands ============
// Always accessible so unpaid groups can discover /subscribe.
bot.command('subscribe', handleSubscribe);
bot.command('status', handleStatus);
bot.command('paid', handlePaid);

// ============ Admin commands (owner-only enforced in handlers) ============
bot.command('admin_credit', handleAdminCredit);
bot.command('admin_revoke', handleAdminRevoke);
bot.command('admin_list', handleAdminList);

// ============ Payment gate ============
// Silent-skips non-DM groups without active subscription.
// Must run AFTER the commands above (so /subscribe works in unpaid groups).
bot.use(gateMiddleware());

// ============ Main message handler ============
// Only authorized chats reach here. Text messages get Claude-powered replies
// with rolling per-chat context.
bot.on('text', handleMessage);

// ============ Boot ============

startHealthServer();

bot.launch().then(() => {
  console.log('[jarvis-network] bot launched');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
