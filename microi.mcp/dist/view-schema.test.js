import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeViewSchemaJson } from './advanced-tools.js';
test('normalizes a declarative cross-client view schema', () => {
    const result = normalizeViewSchemaJson({
        Views: [{
                Scene: 'Detail',
                Device: 'All',
                Layout: {
                    Actions: [{
                            ActionType: 'ApiEngine',
                            ApiEngineKey: 'customer_archive',
                            ParamMap: { Id: '$form.Id' },
                        }],
                },
            }],
    });
    assert.equal(result.ok, true);
    assert.match(result.value || '', /customer_archive/);
});
test('rejects executable frontend code in ViewSchema', () => {
    const result = normalizeViewSchemaJson({
        Views: [{
                Scene: 'Detail',
                Layout: {
                    Actions: [{
                            ActionType: 'ApiEngine',
                            ApiEngineKey: 'customer_archive',
                            V8Code: 'V8.ApiEngine.Run("customer_archive")',
                        }],
                },
            }],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /不允许包含可执行前端脚本字段/);
});
test('rejects unregistered actions and missing ApiEngineKey', () => {
    const invalidAction = normalizeViewSchemaJson({
        Views: [{
                Scene: 'List',
                Layout: { Actions: [{ ActionType: 'RunJavaScript' }] },
            }],
    });
    const missingKey = normalizeViewSchemaJson({
        Views: [{
                Scene: 'Detail',
                Layout: { Actions: [{ ActionType: 'ApiEngine' }] },
            }],
    });
    assert.equal(invalidAction.ok, false);
    assert.match(invalidAction.errors.join('\n'), /ActionType 不受支持/);
    assert.equal(missingKey.ok, false);
    assert.match(missingKey.errors.join('\n'), /必须配置 ApiEngineKey/);
});
//# sourceMappingURL=view-schema.test.js.map