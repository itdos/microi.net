import test from 'node:test';
import assert from 'node:assert/strict';
import { redisDatabaseOptions, redisKeyPrefix } from '../src/utils/redis-management-scope.js';

test('child and older backend connections only offer their configured database', () => {
    assert.deepEqual(redisDatabaseOptions({ Database: 4, CanSelectDatabase: false }), [4]);
    assert.deepEqual(redisDatabaseOptions({ Database: 4, Level: 9999, Account: 'admin' }), [4]);
    assert.deepEqual(redisDatabaseOptions(null), []);
});
test('only explicit backend capability enables database selection and preserves large configured index', () => {
    assert.deepEqual(redisDatabaseOptions({ Database: 70, CanSelectDatabase: true }, 2), [0, 1, 70]);
    assert.deepEqual(redisDatabaseOptions({ Database: 4, CanSelectDatabase: 'true' }, 2), [4]);
});
test('key creation uses the trusted backend prefix without inventing main tenant access', () => {
    assert.equal(redisKeyPrefix({ AllowedKeyPrefix: 'Microi:child:' }), 'Microi:child:');
    assert.equal(redisKeyPrefix({ AllowedKeyPrefix: '', CanSelectDatabase: true }), '');
    assert.equal(redisKeyPrefix(undefined), '');
});
