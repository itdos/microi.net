import assert from 'node:assert/strict';
import test from 'node:test';
import { dataSourcePayload } from './advanced-tools.js';
test('data-source tools persist one ApiV8Code field for each type', () => {
    const sql = dataSourcePayload({
        dataSourceKey: 'typed-sql',
        dataSourceType: 'SQL',
        sqlDataSource: 'select 1',
    });
    assert.equal(sql.DataSourceKey, 'typed-sql');
    assert.equal(sql.DataSourceType, 'SQL');
    assert.equal(sql.ApiV8Code, 'select 1');
    assert.equal('SqlDataSource' in sql, false);
    assert.equal('sqlDataSource' in sql, false);
    const json = dataSourcePayload({
        DataSourceKey: 'typed-json',
        DataSourceType: 'JSON',
        JsonDataSource: [{ Key: 'A', Value: 1 }],
    });
    assert.equal(json.ApiV8Code, '[{"Key":"A","Value":1}]');
    assert.equal('JsonDataSource' in json, false);
    const v8 = dataSourcePayload({
        DataSourceKey: 'typed-v8',
        DataSourceType: 'V8',
        V8DataSource: 'return { Code: 1 };',
    });
    assert.equal(v8.ApiV8Code, 'return { Code: 1 };');
    assert.equal('V8DataSource' in v8, false);
});
test('canonical ApiV8Code wins over every legacy compatibility alias', () => {
    const payload = dataSourcePayload({
        DataSourceKey: 'canonical-code',
        DataSourceType: 'SQL',
        ApiV8Code: 'select 2',
        SqlDataSource: 'select 1',
    });
    assert.equal(payload.ApiV8Code, 'select 2');
    assert.equal('SqlDataSource' in payload, false);
});
//# sourceMappingURL=data-source-migration.test.js.map