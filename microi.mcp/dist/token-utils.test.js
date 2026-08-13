import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAuthorizationToken, selectPreferredAuthorizationTokenFromCandidates, shouldRefreshAuthorizationToken, } from './token-utils.js';
function tokenWithExpiration(exp) {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'none' })}.${encode({ exp })}.signature`;
}
function tokenWithIssuedAt(issuedAt, suffix) {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'none' })}.${encode({ MicroiTokenIssuedAt: issuedAt, suffix })}.signature`;
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
test('selects a newer tenant token while retaining exact-key order for opaque ties', () => {
    const staleExact = tokenWithIssuedAt(100, 'exact');
    const refreshedUntyped = tokenWithIssuedAt(200, 'untyped');
    assert.equal(selectPreferredAuthorizationTokenFromCandidates([staleExact, refreshedUntyped]), refreshedUntyped);
    assert.equal(selectPreferredAuthorizationTokenFromCandidates(['opaque-exact', 'opaque-fallback']), 'opaque-exact');
});
//# sourceMappingURL=token-utils.test.js.map