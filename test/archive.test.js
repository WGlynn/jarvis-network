// ============ Tests — Archive ============

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir;
let archive;

describe('archive', () => {
  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jarvis-archive-'));
    process.env.DATA_DIR = tempDir;
    archive = await import('../src/archive.js');
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('append + readArchiveDay round-trips a record', async () => {
    const chatId = -1000;
    const written = await archive.appendToArchive(chatId, {
      message_id: 1,
      chat_id: chatId,
      username: 'alice',
      type: 'text',
      text: 'hello world',
      date: 1234567890,
    });
    assert.ok(written.ts > 0);
    const day = await archive.readArchiveDay(chatId);
    assert.equal(day.length, 1);
    assert.equal(day[0].text, 'hello world');
    assert.equal(day[0].username, 'alice');
  });

  test('multiple messages accumulate on same day file', async () => {
    const chatId = -2000;
    for (let i = 1; i <= 5; i++) {
      await archive.appendToArchive(chatId, {
        message_id: i,
        chat_id: chatId,
        username: 'bob',
        type: 'text',
        text: `msg ${i}`,
        date: 1234567890 + i,
      });
    }
    const day = await archive.readArchiveDay(chatId);
    assert.equal(day.length, 5);
    assert.equal(day[4].text, 'msg 5');
  });

  test('readRecent returns last N messages', async () => {
    const chatId = -3000;
    for (let i = 1; i <= 30; i++) {
      await archive.appendToArchive(chatId, {
        chat_id: chatId,
        username: 'carol',
        type: 'text',
        text: `msg ${i}`,
      });
    }
    const recent = await archive.readRecent(chatId, 10);
    assert.equal(recent.length, 10);
    assert.equal(recent[9].text, 'msg 30');
    assert.equal(recent[0].text, 'msg 21');
  });

  test('searchArchive finds case-insensitive substring matches', async () => {
    const chatId = -4000;
    await archive.appendToArchive(chatId, { chat_id: chatId, type: 'text', text: 'The Shapley Value is elegant' });
    await archive.appendToArchive(chatId, { chat_id: chatId, type: 'text', text: 'random noise' });
    await archive.appendToArchive(chatId, { chat_id: chatId, type: 'text', text: 'shapley distribution primitive' });
    const hits = await archive.searchArchive(chatId, 'SHAPLEY');
    assert.equal(hits.length, 2);
  });

  test('aggregateDay produces grounded stats', async () => {
    const chatId = -5000;
    await archive.appendToArchive(chatId, { chat_id: chatId, username: 'alice', type: 'text', text: 'a' });
    await archive.appendToArchive(chatId, { chat_id: chatId, username: 'alice', type: 'text', text: 'b' });
    await archive.appendToArchive(chatId, { chat_id: chatId, username: 'bob', type: 'sticker', text: null });
    const agg = await archive.aggregateDay(chatId);
    assert.equal(agg.message_count, 3);
    assert.equal(agg.user_count, 2);
    assert.equal(agg.users[0].user, 'alice');
    assert.equal(agg.users[0].count, 2);
    assert.equal(agg.by_type.text, 2);
    assert.equal(agg.by_type.sticker, 1);
  });

  test('readArchiveDay returns empty for missing chat', async () => {
    const day = await archive.readArchiveDay(-9999);
    assert.deepEqual(day, []);
  });
});
