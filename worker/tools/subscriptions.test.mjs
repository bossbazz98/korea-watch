import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeSubscription } from '../../public/subscriptions.js';
function fixture(existing = {}) {
  const now = { toMillis: () => Date.now() }, values = new Map(Object.entries(existing)), writes = [];
  const fs = { doc: (db, ...parts) => parts.join('/'), serverTimestamp: () => now,
    runTransaction: async (db, fn) => fn({ get: async ref => ({ exists: () => values.has(ref), data: () => values.get(ref) }), set: (ref, value) => { values.set(ref, value); writes.push(value); } })
  };
  const options = { fs, db: {}, uid: 'owner', token: 't'.repeat(120), language: 'th', preferences: { cats: ['korwar'], enabled: true, level: 'high' } };
  return { values, writes, options };
}
test('editing after a test preserves lastTestAt and the pending server request', async () => {
  const previous = { toMillis: () => Date.now() - 10000 };
  const f = fixture({ 'subscribers/owner': { lastTestAt: previous, testRequested: true } });
  await writeSubscription(f.options);
  assert.equal(f.writes[0].lastTestAt, previous);
  assert.equal(f.writes[0].testRequested, true);
  assert.equal(f.writes[0].subscriptionVersion, 2);
});
test('automatic test queues on enable, then preserves the request during cooldown', async () => {
  const f = fixture();
  const first = await writeSubscription({ ...f.options, requestTest: true });
  assert.equal(first.testQueued, true);
  const second = await writeSubscription({ ...f.options, requestTest: true });
  assert.equal(second.testQueued, false);
  assert.equal(second.testPending, true);
  assert.equal(f.writes[1].lastTestAt, f.writes[0].lastTestAt);
});
test('disabling preserves test history but cancels a pending test', async () => {
  const previous = { toMillis: () => Date.now() - 10000 };
  const f = fixture({ 'subscribers/owner': { lastTestAt: previous, testRequested: true } });
  await writeSubscription({ ...f.options, preferences: { ...f.options.preferences, enabled: false } });
  assert.equal(f.writes[0].testRequested, false);
  assert.equal(f.writes[0].lastTestAt, previous);
});
test('first real server registration queues a test even if local preferences already said enabled',async()=>{
  const f=fixture();
  const result=await writeSubscription(f.options);
  assert.equal(result.enabledNow,true);assert.equal(result.testQueued,true);assert.equal(f.writes[0].testRequested,true);
});
