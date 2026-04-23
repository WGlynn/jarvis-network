// ============ Payment Listener — On-Chain Verification (v0.2) ============
//
// Replaces the manual /admin_credit workflow for most cases. Customer pays
// USDC on Base, submits tx hash via /paid command, bot verifies on-chain
// and credits automatically.
//
// Flow:
//   1. Customer runs /subscribe in group → gets PAYMENT_USDC_ADDRESS + chat_id
//   2. Customer sends USDC to PAYMENT_USDC_ADDRESS on Base
//   3. Customer DMs bot: /paid <tx_hash> <chat_id>
//   4. Bot verifies tx on-chain:
//        - transaction exists and succeeded
//        - USDC Transfer event from USDC contract
//        - destination == PAYMENT_USDC_ADDRESS
//        - amount >= PRICE_USDC_PER_MONTH
//   5. If valid: credits chat via payment-gate.addCustomer()
//   6. Marks tx hash as claimed to prevent reuse
//
// Env:
//   BASE_RPC_URL              default: https://mainnet.base.org (public)
//   PAYMENT_USDC_ADDRESS      (from payment-gate.js)
//   PRICE_USDC_PER_MONTH      (from payment-gate.js)
//   USDC_CONTRACT_BASE        default: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
//
// v1 roadmap: background poller watches PAYMENT_USDC_ADDRESS for incoming
// transfers and auto-matches against customers who have self-identified
// their sender wallets. Skips the manual /paid step entirely.
// ============

import { ethers } from 'ethers';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { addCustomer } from './payment-gate.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const CLAIMED_TXS_FILE = join(DATA_DIR, 'claimed-txs.json');
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const PAYMENT_ADDRESS = (process.env.PAYMENT_USDC_ADDRESS || '').toLowerCase();
const PRICE_PER_MONTH = parseFloat(process.env.PRICE_USDC_PER_MONTH || '29');
const USDC_CONTRACT_BASE = (
  process.env.USDC_CONTRACT_BASE || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
).toLowerCase();
const USDC_DECIMALS = 6;

// USDC Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_EVENT_SIG = ethers.id('Transfer(address,address,uint256)');

let claimedTxs = new Set();
let loaded = false;
let provider = null;

async function ensureLoaded() {
  if (loaded) return;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const data = await readFile(CLAIMED_TXS_FILE, 'utf8');
    claimedTxs = new Set(JSON.parse(data).claimed || []);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    claimedTxs = new Set();
    await persist();
  }
  loaded = true;
}

async function persist() {
  await writeFile(CLAIMED_TXS_FILE, JSON.stringify({ claimed: [...claimedTxs] }, null, 2));
}

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }
  return provider;
}

// ============ Core verification ============

/**
 * Verify a USDC payment transaction on Base.
 * Returns { valid, amount, sender, hash, error? }
 */
export async function verifyPayment(txHash, minAmountUsdc = PRICE_PER_MONTH) {
  await ensureLoaded();

  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { valid: false, error: 'Invalid tx hash format (expected 0x + 64 hex chars)' };
  }
  const normalizedHash = txHash.toLowerCase();

  if (claimedTxs.has(normalizedHash)) {
    return { valid: false, error: 'Transaction already claimed' };
  }

  if (!PAYMENT_ADDRESS) {
    return { valid: false, error: 'PAYMENT_USDC_ADDRESS not configured on bot side' };
  }

  let receipt;
  try {
    receipt = await getProvider().getTransactionReceipt(txHash);
  } catch (err) {
    return { valid: false, error: `RPC error: ${err.message}` };
  }
  if (!receipt) {
    return {
      valid: false,
      error: 'Transaction not found — may not be confirmed yet, retry in ~30s',
    };
  }
  if (receipt.status !== 1) {
    return { valid: false, error: 'Transaction failed on-chain' };
  }

  // Find USDC Transfer logs to PAYMENT_ADDRESS
  const paddedPayment = ethers.zeroPadValue(PAYMENT_ADDRESS, 32).toLowerCase();
  const matches = receipt.logs.filter(log => {
    if (log.address.toLowerCase() !== USDC_CONTRACT_BASE) return false;
    if (log.topics[0] !== TRANSFER_EVENT_SIG) return false;
    if (log.topics[2]?.toLowerCase() !== paddedPayment) return false;
    return true;
  });

  if (matches.length === 0) {
    return {
      valid: false,
      error: `No USDC transfers to ${PAYMENT_ADDRESS} found in this transaction`,
    };
  }

  let totalWei = 0n;
  let sender = null;
  for (const log of matches) {
    totalWei += BigInt(log.data);
    if (!sender) {
      sender = '0x' + log.topics[1].slice(26); // topics[1] = from, 32-byte padded
    }
  }

  const amountUsdc = Number(totalWei) / 10 ** USDC_DECIMALS;

  if (amountUsdc < minAmountUsdc) {
    return {
      valid: false,
      error: `Transfer amount ${amountUsdc} USDC below required ${minAmountUsdc}`,
      amount: amountUsdc.toString(),
      sender,
    };
  }

  return {
    valid: true,
    amount: amountUsdc.toString(),
    sender,
    hash: normalizedHash,
  };
}

export async function markClaimed(txHash) {
  await ensureLoaded();
  claimedTxs.add(txHash.toLowerCase());
  await persist();
}

// ============ Telegram command handler ============

export async function handlePaid(ctx) {
  const parts = ctx.message.text.split(/\s+/);
  const txHash = parts[1];
  const chatIdArg = parts[2];

  if (!txHash || !chatIdArg) {
    return ctx.reply(
      'Usage: /paid <tx_hash> <chat_id>\n\n' +
        'Example:\n' +
        '  /paid 0xabc...def -1001234567890\n\n' +
        'The chat_id comes from running /subscribe in the group you want to activate.'
    );
  }

  const chatId = parseInt(chatIdArg, 10);
  if (!chatId) {
    return ctx.reply('Invalid chat_id — should be an integer (e.g. -1001234567890).');
  }

  await ctx.reply('Verifying payment on Base...');

  const result = await verifyPayment(txHash);
  if (!result.valid) {
    return ctx.reply(`Payment verification failed: ${result.error}`);
  }

  const monthsPaid = Math.floor(parseFloat(result.amount) / PRICE_PER_MONTH);
  const days = monthsPaid * 30;
  await addCustomer(chatId, days, 'monthly', `tx:${txHash} from:${result.sender}`);
  await markClaimed(txHash);

  return ctx.reply(
    `Payment verified.\n` +
      `Amount: ${result.amount} USDC\n` +
      `Sender: ${result.sender}\n` +
      `Chat ${chatId} credited with ${days} days (${monthsPaid} month${monthsPaid === 1 ? '' : 's'}).`
  );
}
