import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAuthorizationToken, shouldRefreshAuthorizationToken } from './token-utils.js';

function tokenWithExpiration(exp: number): string {
  const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ exp })}.signature`;
}

test('normalizes bearer tokens exactly once', () => {
  assert.equal(normalizeAuthorizationToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(normalizeAuthorizationToken('abc.def.ghi'), 'abc.def.ghi');
});

test('refreshes only inside the configured JWT lead window', () => {
  const now = 1_000_000;
  assert.equal(shouldRefreshAuthorizationToken(tokenWithExpiration(now + 86_401), now), false);
  assert.equal(shouldRefreshAuthorizationToken(tokenWithExpiration(now + 86_400), now), true);
  assert.equal(shouldRefreshAuthorizationToken('invalid-token', now), true);
});
