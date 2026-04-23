// ============ Tests — Payment Gate ============
//
// Unit tests for payment-gate.js core logic.
// Run: node --test test/payment-gate.test.js
//
// Uses a temp DATA_DIR per test so nothing touches real customer data.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir;
let gate;

describe('payment-gate', () => {
  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jarvis-test-'));
    process.env.DATA_DIR = tempDir;
    process.env.TELEGRAM_OWNER_ID = '12345';
    process.env.GRANDFATHERED_CHAT_IDS = '-1000000000000';
    process.env.PAYMENT_USDC_ADDRESS = '0xabc';
    process.env.PRICE_USDC_PER_MONTH = '29';
    // Import AFTER env is set — module captures env at import time.
    gate = await import('../src/payment-gate.js');
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('unknown chat is not authorized', async () => {
    const chatId = -9999;
    assert.equal(await gate.isAuthorized(chatId), false);
    const status = await gate.getStatus(chatId);
    assert.equal(status.authorized, false);
    assert.equal(status.plan, null);
    assert.equal(status.days_remaining, 0);
  });

  test('grandfathered chat is authorized without payment', async () => {
    const chatId = -1000000000000;
    assert.equal(await gate.isAuthorized(chatId), true);
    const status = await gate.getStatus(chatId);
    assert.equal(status.authorized, true);
    assert.equal(status.plan, 'grandfathered');
  });

  test('addCustomer credits chat and isAuthorized returns true', async () => {
    const chatId = -2000;
    await gate.addCustomer(chatId, 30, 'monthly', 'test');
    assert.equal(await gate.isAuthorized(chatId), true);
    const status = await gate.getStatus(chatId);
    assert.equal(status.authorized, true);
    assert.equal(status.plan, 'monthly');
    // Days remaining should be close to 30 (within 1 day tolerance)
    assert.ok(status.days_remaining >= 29 && status.days_remaining <= 30);
  });

  test('addCustomer extends existing active subscription from expiry', async () => {
    const chatId = -3000;
    await gate.addCustomer(chatId, 30);
    const first = await gate.getStatus(chatId);
    await gate.addCustomer(chatId, 30);
    const second = await gate.getStatus(chatId);
    // Second expiry should be ~30 days later than the first
    const diff = second.expires_at - first.expires_at;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(diff - thirtyDays) < 1000, `expected ~30d diff, got ${diff}ms`);
  });

  test('removeCustomer revokes authorization immediately', async () => {
    const chatId = -4000;
    await gate.addCustomer(chatId, 30);
    assert.equal(await gate.isAuthorized(chatId), true);
    await gate.removeCustomer(chatId);
    assert.equal(await gate.isAuthorized(chatId), false);
  });

  test('listCustomers returns all customer records', async () => {
    // Fresh chat IDs to avoid test coupling
    await gate.addCustomer(-5001, 30, 'monthly', 'alice');
    await gate.addCustomer(-5002, 60, 'custom', 'bob');
    const list = await gate.listCustomers();
    const ids = list.map(c => c.chatId);
    assert.ok(ids.includes('-5001'));
    assert.ok(ids.includes('-5002'));
  });

  test('gateMiddleware: DM always passes', async () => {
    const middleware = gate.gateMiddleware();
    let nextCalled = false;
    const ctx = { chat: { type: 'private', id: 999 } };
    await middleware(ctx, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  test('gateMiddleware: authorized group passes', async () => {
    const chatId = -6000;
    await gate.addCustomer(chatId, 30);
    const middleware = gate.gateMiddleware();
    let nextCalled = false;
    const ctx = { chat: { type: 'supergroup', id: chatId } };
    await middleware(ctx, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  test('gateMiddleware: unauthorized group silent-skips', async () => {
    const middleware = gate.gateMiddleware();
    let nextCalled = false;
    const ctx = { chat: { type: 'supergroup', id: -7777 } };
    await middleware(ctx, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
  });
});
