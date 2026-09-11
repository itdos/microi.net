import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDefaultFormBanner, buildGenerateSystemValidationPayload, registerAdvancedTools } from './advanced-tools.js';
test('generate_system preserves validator Code, Msg and Data for deterministic recovery', () => {
    const payload = buildGenerateSystemValidationPayload([{ step: 'upsertEngine', response: { Code: 1 } }], {
        Code: 0,
        Msg: "验收低代码系统失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
        Data: null,
    });
    assert.deepEqual(payload, {
        ok: false,
        results: [{ step: 'upsertEngine', response: { Code: 1 } }],
        validation: {
            Code: 0,
            Msg: "验收低代码系统失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
            Data: null,
        },
    });
});
test('generate_system rejects a completed validator whose Data.Passed is false', () => {
    assert.equal(buildGenerateSystemValidationPayload([], { Code: 1, Msg: '', Data: { Passed: false, Errors: ['field mismatch'] } }).ok, false);
});
const bannerTable = { name: 'Biz_Content', fields: [{ name: 'Name', label: '名称', component: 'Text', type: 'varchar(100)' }] };
const bannerManifest = { name: '内容系统', tables: [bannerTable] };
// 直接调用已注册工具处理器，验证正式 validate 路径，避免只测未接线的辅助函数。
async function validateBanner(rows, validation = { Code: 1, Data: { Passed: true, Errors: [], Warnings: [] } }, table = bannerTable, readError = false) {
    const handlers = new Map();
    const queries = [];
    registerAdvancedTools({ tool(name, ...args) { handlers.set(name, args.at(-1)); } }, {
        validateLowCodeSystem: async () => validation,
        getTableData: async (name, query) => { queries.push({ name, query }); if (readError)
            throw new Error('internal database details'); return { Code: 1, Data: rows }; },
    }, { osClient: 'test' });
    return { result: await handlers.get('microi_validate_system')({ manifest: { ...bannerManifest, tables: [table] } }), queries };
}
test('validate_system fails when old tenant drops all Banner metadata despite server Passed=true', async () => {
    const { result, queries } = await validateBanner([{ Id: 't1', Name: bannerTable.name }]);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /FormBannerEnabled/);
    assert.match(result.content[0].text, /升级/);
    assert.equal(queries[0].name, 'diy_table');
    assert.deepEqual(queries[0].query._Where, [['Name', 'In', ['Biz_Content']]]);
});
test('validate_system detects persisted Banner value mismatch', async () => {
    const { result } = await validateBanner([{ Name: bannerTable.name, ...buildDefaultFormBanner(bannerTable), FormBannerTitleField: 'Other' }]);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /FormBannerTitleField/);
});
test('validate_system accepts fully read-back Banner configuration', async () => {
    const { result, queries } = await validateBanner([{ Name: bannerTable.name, ...buildDefaultFormBanner(bannerTable) }]);
    assert.equal(result.isError, false);
    assert.equal(queries.length, 1);
});
test('validate_system preserves original server failure without attempting readback', async () => {
    const { result, queries } = await validateBanner([], { Code: 0, Msg: 'existing failure', Data: { Passed: false, Errors: ['original'] } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /original/);
    assert.equal(queries.length, 0);
});
test('validate_system rejects missing or ambiguous metadata row', async () => {
    for (const rows of [[], [{ Name: bannerTable.name }, { Name: bannerTable.name }]]) {
        const { result } = await validateBanner(rows);
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /Biz_Content/);
    }
});
test('validate_system respects explicit disabled Banner and empty descriptors', async () => {
    const table = { ...bannerTable, formBanner: { enabled: false, tagFields: [], metrics: [] } };
    const { result } = await validateBanner([{ Name: table.name, ...buildDefaultFormBanner(table) }], undefined, table);
    assert.equal(result.isError, false);
});
test('validate_system rejects failed readback without exposing internal database errors', async () => {
    const { result } = await validateBanner([], undefined, bannerTable, true);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /回读失败/);
    assert.doesNotMatch(result.content[0].text, /internal database details/);
});
test('validate_system never masks existing Passed=false and validator errors', async () => {
    const { result } = await validateBanner([{ Name: bannerTable.name, ...buildDefaultFormBanner(bannerTable) }], { Code: 1, Data: { Passed: false, Errors: ['original mismatch'], Warnings: ['old warning'] } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /original mismatch/);
    assert.match(result.content[0].text, /old warning/);
});
test('generate_system uses the same persisted Banner gate after successful metadata writes', async () => {
    for (const persisted of [false, true]) {
        const handlers = new Map();
        const writes = [];
        registerAdvancedTools({ tool(name, ...args) { handlers.set(name, args.at(-1)); } }, {
            writeAuditLog: async () => ({ Code: 1 }),
            createTable: async () => ({ Code: 1, Data: { Id: 't1' } }),
            addField: async () => ({ Code: 1, Data: { Id: 'f1' } }),
            updateTable: async (row) => { writes.push(row); return { Code: 1 }; },
            getDbSchema: async () => ({ Code: 1, Data: {} }),
            validateLowCodeSystem: async () => ({ Code: 1, Data: { Passed: true, Errors: [] } }),
            getTableData: async () => ({ Code: 1, Data: [{ Id: 't1', Name: bannerTable.name, ...(persisted ? buildDefaultFormBanner(bannerTable) : {}) }] }),
        }, { osClient: 'test' });
        const result = await handlers.get('microi_generate_system')({ manifest: bannerManifest, dryRun: false, confirmExecution: 'test' });
        assert.equal(writes.length, 1);
        assert.equal(result.isError, !persisted);
        const payload = JSON.parse(result.content[0].text);
        assert.equal(payload.ok, persisted);
        assert.equal(payload.validation.Data.Passed, persisted);
        assert.equal(payload.results.some((step) => step.step === 'configureFormBanner' && step.response.Code === 1), true);
    }
});
//# sourceMappingURL=advanced-tools-validation-envelope.test.js.map