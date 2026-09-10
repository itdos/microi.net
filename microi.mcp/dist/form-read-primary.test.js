import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildPlan, buildDefaultFormBanner, registerAdvancedTools } from './advanced-tools.js';
import { MicroiClient } from './microi-client.js';
test('ReadPrimary planning accepts null/0/1, preserves omission and rejects loose coercion', () => {
    for (const value of [undefined, null, 0, 1]) {
        const table = { name: 'Biz_Safe', fields: [], ...(value !== undefined ? { readPrimary: value } : {}) };
        assert.deepEqual(buildPlan({ tables: [table] }).errors, []);
    }
    for (const value of [true, false, '1', '', 2, -1, 1.1, [], {}])
        assert.ok(buildPlan({ tables: [{ name: 'Biz_Safe', fields: [], readPrimary: value }] }).errors.some(x => x.includes('readPrimary')));
    assert.ok(buildPlan({ tables: [{ name: 'Biz_Safe', fields: [], readPrimary: 0, ReadPrimary: 1 }] }).errors.some(x => x.includes('不一致')));
});
test('actual createTable uses standard metadata update only when requested and preserves failure', async () => {
    for (const value of [undefined, null, 0, 1]) {
        const calls = [];
        const fake = { config: { osClient: 'bound-tenant' },
            async post(endpoint, data) { calls.push({ endpoint, data }); return { Code: 1, Data: { TableId: 'server-table' } }; },
            updateTable: MicroiClient.prototype.updateTable, };
        const result = await MicroiClient.prototype.createTable.call(fake, 'Biz_Safe', '', { ReadPrimary: value });
        assert.equal(result.Code, 1);
        assert.equal(calls.length, value === undefined ? 1 : 2);
        assert.equal(Object.hasOwn(calls[0].data, 'ReadPrimary'), false);
        if (value !== undefined)
            assert.deepEqual(calls[1].data, { OsClient: 'bound-tenant', Id: 'server-table', ReadPrimary: value });
    }
    const fake = { config: { osClient: 'bound-tenant' }, post: async () => ({ Code: 1, Data: { TableId: 't' } }),
        updateTable: async () => ({ Code: 0, Msg: 'ReadPrimary 主库回读不一致' }) };
    assert.equal((await MicroiClient.prototype.createTable.call(fake, 'Biz_Safe', '', { ReadPrimary: 1 })).Code, 0);
});
test('registered validate tool rejects missing/mismatched ReadPrimary, including null vs zero', async () => {
    for (const expected of [null, 0, 1])
        for (const actual of [undefined, null, 0, 1]) {
            const table = { name: 'Biz_Safe', fields: [], readPrimary: expected };
            const handlers = new Map();
            const queries = [];
            registerAdvancedTools({ tool(name, ...args) { handlers.set(name, args.at(-1)); } }, {
                validateLowCodeSystem: async () => ({ Code: 1, Data: { Passed: true, Errors: [] } }),
                getTableData: async (_name, query) => {
                    queries.push(query);
                    return { Code: 1, Data: [{ Id: 't', Name: table.name,
                                ...buildDefaultFormBanner(table), ...(actual === undefined ? {} : { ReadPrimary: actual }) }] };
                },
            }, { osClient: 'test' });
            const result = await handlers.get('microi_validate_system')({ manifest: { tables: [table] } });
            assert.equal(result.isError, actual !== expected, `${expected}/${actual}`);
            assert.ok(queries[0]._SelectFields.includes('ReadPrimary'));
        }
});
test('standard tool schema accepts only explicit numeric 0/1/null, and carries update key', () => {
    const source = fs.readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    assert.equal((source.match(/readPrimary: z\.union\(\[z\.literal\(0\), z\.literal\(1\)\]\)\.nullable\(\)\.optional\(\)/g) || []).length, 2);
    assert.match(source, /if \(args\.readPrimary !== undefined\) patch\.ReadPrimary = args\.readPrimary/);
});
//# sourceMappingURL=form-read-primary.test.js.map