import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedQuery, invalidateQueryCache } from './queryCache';

test('cachedQuery reuses the value until invalidated', async () => {
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return `value-${calls}`;
  };

  assert.equal(await cachedQuery('test:one', 60_000, loader), 'value-1');
  assert.equal(await cachedQuery('test:one', 60_000, loader), 'value-1');
  assert.equal(calls, 1);

  invalidateQueryCache('test:');
  assert.equal(await cachedQuery('test:one', 60_000, loader), 'value-2');
  assert.equal(calls, 2);
});

test('cachedQuery keeps keys independent', async () => {
  let calls = 0;
  const loader = async () => ++calls;

  assert.equal(await cachedQuery('test:a', 60_000, loader), 1);
  assert.equal(await cachedQuery('test:b', 60_000, loader), 2);
  assert.equal(await cachedQuery('test:a', 60_000, loader), 1);
});

test('a failed loader is not cached', async () => {
  let calls = 0;
  const loader = async () => {
    calls += 1;
    if (calls === 1) throw new Error('transient');
    return 'ok';
  };

  await assert.rejects(() => cachedQuery('test:error', 60_000, loader), /transient/);
  assert.equal(await cachedQuery('test:error', 60_000, loader), 'ok');
  assert.equal(calls, 2);
});
