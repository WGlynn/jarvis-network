// ============ Expiry Watcher — Subscription Retention ============
//
// v0.8 background loop: checks all active customers every hour and sends
// renewal warnings at 7 / 3 / 1 / 0 day thresholds. Persists last-warning-
// threshold in the customer record to avoid re-sending on restart.
//
// Silent cutoff = bad customer experience and avoidable churn. A subscriber
// paying 29 USDC/month shouldn't be surprised by the bot going quiet; they
// should be told exactly when renewal is due and what to do about it.
// ============

import { listCustomers, setCustomerMeta } from './payment-gate.js';

const CHECK_INTERVAL_MS = parseInt(process.env.EXPIRY_CHECK_INTERVAL_MS || String(60 * 60 * 1000), 10);
const WARNING_THRESHOLDS = [7, 3, 1, 0]; // days remaining

function daysRemaining(expiresAt) {
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

function warningMessage(thresholdDays) {
  if (thresholdDays === 0) {
    return (
      `⚠️ Your JARVIS Network subscription has expired.\n\n` +
      `The bot will stop responding in this chat until you renew.\n` +
      `Run /subscribe in this chat for renewal instructions.`
    );
  }
  if (thresholdDays === 1) {
    return (
      `⚠️ Your JARVIS Network subscription expires in ~1 day.\n\n` +
      `Run /subscribe to see renewal instructions — send USDC and use /paid to extend.`
    );
  }
  return (
    `Heads up: your JARVIS Network subscription expires in ~${thresholdDays} days.\n\n` +
    `Run /subscribe when you're ready to renew.`
  );
}

/**
 * Single pass: check all customers, send warnings where needed.
 */
export async function runExpiryCheck(bot) {
  const customers = await listCustomers();
  for (const c of customers) {
    if (c.plan === 'grandfathered') continue;
    if (!c.expires_at) continue;

    const days = daysRemaining(c.expires_at);
    const lastSent = c.last_warning_threshold ?? null; // null means none yet

    // Find the highest threshold we've crossed that we haven't warned about
    for (const threshold of WARNING_THRESHOLDS) {
      if (days <= threshold && (lastSent === null || lastSent > threshold)) {
        try {
          await bot.telegram.sendMessage(c.chatId, warningMessage(threshold));
          await setCustomerMeta(c.chatId, { last_warning_threshold: threshold });
          console.log(`[expiry-watch] sent ${threshold}-day warning to chat ${c.chatId}`);
        } catch (err) {
          console.error(
            `[expiry-watch] failed to warn chat ${c.chatId}: ${err.message}`
          );
        }
        break; // one warning per check per customer
      }
    }
  }
}

/**
 * Start the interval loop. Call once from index.js after bot.launch().
 * Returns the interval handle so callers can clearInterval on shutdown.
 */
export function startExpiryWatcher(bot) {
  // Kick off a check shortly after boot, then interval.
  setTimeout(() => runExpiryCheck(bot).catch(e => console.error('[expiry-watch]', e)), 30_000);
  const handle = setInterval(() => {
    runExpiryCheck(bot).catch(e => console.error('[expiry-watch]', e));
  }, CHECK_INTERVAL_MS);
  console.log(`[expiry-watch] started (interval ${CHECK_INTERVAL_MS / 1000}s)`);
  return handle;
}
