import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultLayoutFieldFormWidth, isLegacyJValueValFailure, normalizeLayoutFieldConfig, } from './server.js';
test('CollapseGroup defaults to full width and visible field count', () => {
    assert.equal(defaultLayoutFieldFormWidth('CollapseGroup'), 24);
    assert.deepEqual(JSON.parse(normalizeLayoutFieldConfig('CollapseGroup') || '{}'), {
        CollapseGroup: { ShowFieldCount: true },
    });
});
test('CollapseGroup keeps explicit width and ShowFieldCount override', () => {
    assert.equal(defaultLayoutFieldFormWidth('CollapseGroup', 12), 12);
    const normalized = normalizeLayoutFieldConfig('CollapseGroup', {
        CollapseGroup: { DefaultCollapsed: false, ShowFieldCount: false },
    });
    assert.deepEqual(JSON.parse(normalized || '{}'), {
        CollapseGroup: { DefaultCollapsed: false, ShowFieldCount: false },
    });
});
test('non-CollapseGroup layout defaults remain unchanged', () => {
    assert.equal(defaultLayoutFieldFormWidth('Divider'), undefined);
    assert.equal(normalizeLayoutFieldConfig('Divider'), undefined);
    assert.equal(normalizeLayoutFieldConfig('Divider', '[{"color":"blue"}]'), '[{"color":"blue"}]');
});
test('legacy JValue.Val detector is narrow', () => {
    assert.equal(isLegacyJValueValFailure({
        Code: 0,
        Msg: "'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
    }), true);
    assert.equal(isLegacyJValueValFailure({ Code: 0, Msg: '普通校验失败' }), false);
    assert.equal(isLegacyJValueValFailure({ Code: 1, Msg: '' }), false);
});
//# sourceMappingURL=form-layout-defaults.test.js.map