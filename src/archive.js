// ============ Canonical Chat Archive ============
//
// v0.4 append-only ground truth substrate for JARVIS Network.
// Every incoming message (and future: bot replies, edits, joins) gets
// appended as a JSON line to DATA_DIR/archive/<chatId>/<YYYY-MM-DD>.jsonl
// on receipt.
//
// The archive is the substrate for:
//   - Grounded queries (v0.5: LLM tool calls hit archive instead of re-
//     ingesting chat context)
//   - Deterministic digests (v0.6: aggregate + template instead of LLM
//     generation for /summary-class output)
//   - Verifiable claims (v2: Merkle proofs of archive state for grounding
//     verifiability per the Verifiable Claims Roadmap)
//   - Community-auditable ground truth (v0.8: git-mirrored to a public
//     repo every N minutes)
//
// Design: jsonl (not binary, not DB) because it's grep-able, human-readable,
// rsync-efficient, Merkle-tree-natural (append-only), and the filesystem
// IS the substrate per OSCH.
// ============

import { appendFile, mkdir, readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const ARCHIVE_ROOT = join(DATA_DIR, 'archive');

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}

function chatDir(chatId) {
  return join(ARCHIVE_ROOT, String(chatId));
}

function dayFile(chatId, dateStr = todayUTC()) {
  return join(chatDir(chatId), `${dateStr}.jsonl`);
}

// ============ Write ============

/**
 * Append a message to the archive. Idempotent within a day by (chatId, messageId).
 * Returns the written record.
 */
export async function appendToArchive(chatId, record) {
  await mkdir(chatDir(chatId), { recursive: true });
  const enriched = {
    ts: record.ts || Date.now(),
    ...record,
  };
  await appendFile(dayFile(chatId), JSON.stringify(enriched) + '\n');
  return enriched;
}

/**
 * Convenience: append a normalized Telegram message from a Telegraf ctx.
 */
export async function archiveFromContext(ctx) {
  if (!ctx.chat?.id) return null;
  const msg = ctx.message;
  if (!msg) return null;
  const record = {
    message_id: msg.message_id,
    chat_id: ctx.chat.id,
    user_id: ctx.from?.id,
    username: ctx.from?.username || null,
    first_name: ctx.from?.first_name || null,
    type: msg.sticker
      ? 'sticker'
      : msg.photo
      ? 'photo'
      : msg.voice
      ? 'voice'
      : msg.video
      ? 'video'
      : msg.text
      ? 'text'
      : 'other',
    text: msg.text || msg.caption || null,
    date: msg.date,
  };
  return appendToArchive(ctx.chat.id, record);
}

// ============ Read ============

/**
 * Read all messages for a chat on a specific UTC day.
 * Returns empty array if the file doesn't exist.
 */
export async function readArchiveDay(chatId, dateStr = todayUTC()) {
  const file = dayFile(chatId, dateStr);
  if (!existsSync(file)) return [];
  const text = await readFile(file, 'utf8');
  return text
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Read the last N messages for a chat across the most recent days.
 * Used by the handler to ground Claude calls in recent history.
 */
export async function readRecent(chatId, limit = 20) {
  const dir = chatDir(chatId);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir))
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse(); // newest first
  const collected = [];
  for (const f of files) {
    const dateStr = f.replace('.jsonl', '');
    const day = await readArchiveDay(chatId, dateStr);
    collected.unshift(...day); // prepend older-within-day to keep chronology
    if (collected.length >= limit) break;
  }
  return collected.slice(-limit);
}

/**
 * Case-insensitive substring search across a chat's archive.
 * Used by /search command (v0.7) and future LLM tool calls.
 */
export async function searchArchive(chatId, query, limit = 20) {
  const dir = chatDir(chatId);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter(f => f.endsWith('.jsonl')).sort();
  const q = query.toLowerCase();
  const hits = [];
  for (const f of files) {
    const dateStr = f.replace('.jsonl', '');
    const day = await readArchiveDay(chatId, dateStr);
    for (const msg of day) {
      if ((msg.text || '').toLowerCase().includes(q)) {
        hits.push(msg);
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

/**
 * Deterministic aggregation for digest/stats. Zero LLM generation.
 */
export async function aggregateDay(chatId, dateStr = todayUTC()) {
  const day = await readArchiveDay(chatId, dateStr);
  const byUser = new Map();
  const byType = {};
  let firstTs = null;
  let lastTs = null;
  for (const msg of day) {
    const u = msg.username || msg.first_name || `user:${msg.user_id}`;
    byUser.set(u, (byUser.get(u) || 0) + 1);
    byType[msg.type] = (byType[msg.type] || 0) + 1;
    if (!firstTs || msg.ts < firstTs) firstTs = msg.ts;
    if (!lastTs || msg.ts > lastTs) lastTs = msg.ts;
  }
  const users = [...byUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([user, count]) => ({ user, count }));
  return {
    date: dateStr,
    chat_id: chatId,
    message_count: day.length,
    user_count: users.length,
    users,
    by_type: byType,
    first_ts: firstTs,
    last_ts: lastTs,
  };
}
