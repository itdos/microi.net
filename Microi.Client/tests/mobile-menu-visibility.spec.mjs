import assert from 'node:assert/strict';
import test from 'node:test';
import { isExplicitlyHiddenOnMobile } from '../src/views/mobile/mobile-menu-visibility.js';

test('mobile menu hides only explicit false values', () => {
    for (const value of [0, '0', false]) {
        assert.equal(isExplicitlyHiddenOnMobile(value), true, `${JSON.stringify(value)} should be hidden`);
    }

    for (const value of [undefined, null, '', 1, '1', true]) {
        assert.equal(isExplicitlyHiddenOnMobile(value), false, `${JSON.stringify(value)} should remain compatible-visible`);
    }
});
