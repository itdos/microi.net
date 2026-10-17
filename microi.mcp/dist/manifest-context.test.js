import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDefaultFormBanner, buildPlan } from './advanced-tools.js';
import { canonicalManifestJson, ManifestContextStore, manifestSha256, summarizeManifestResult } from './manifest-context.js';
import { engineManifest, toolJson, harness, completeManifest } from './manifest-context-fixtures.js';
test('Manifest 规范哈希忽略对象键排列，保留数组、代码和真实内容差异', () => {
    assert.equal(manifestSha256({ b: { z: 1, a: '中文' }, a: [1, 2] }), manifestSha256({ a: [1, 2], b: { a: '中文', z: 1 } }));
    assert.notEqual(manifestSha256({ a: [1, 2] }), manifestSha256({ a: [2, 1] }));
    assert.notEqual(manifestSha256(engineManifest), manifestSha256({ ...engineManifest, name: '其它系统' }));
    for (const invalid of [NaN, Infinity, undefined, 1n, () => 1, new Date()])
        assert.throws(() => canonicalManifestJson({ value: invalid }));
    const cyclic = {};
    cyclic.self = cyclic;
    assert.throws(() => canonicalManifestJson(cyclic), /循环/);
});
test('会话引用为不可变副本，正文/hash 冲突不得覆盖原计划', () => {
    const store = new ManifestContextStore(() => 'identity');
    const manifest = structuredClone(engineManifest);
    const first = store.resolve({ manifest });
    assert.ok(first.manifestRef);
    manifest.engines[0].code = '错误代码';
    first.manifest.engines = [];
    assert.deepEqual(store.resolve({ manifestRef: first.manifestRef }).manifest, engineManifest);
    assert.throws(() => store.resolve({ manifestRef: first.manifestRef, manifest }), /不一致/);
    assert.throws(() => store.resolve({ manifestRef: first.manifestRef, manifestHash: '0'.repeat(64) }), /不一致/);
    assert.throws(() => store.resolve({ manifest: engineManifest, manifestHash: '0'.repeat(64) }), /不一致/);
    assert.deepEqual(store.resolve({ manifestRef: first.manifestRef, manifest: engineManifest, manifestHash: first.manifestHash }).manifest, engineManifest);
});
test('TTL、容量、重启、跨连接及身份变化均失败关闭，重传正文可恢复', () => {
    let identity = 'tenant:user:token';
    let now = 100;
    const store = new ManifestContextStore(() => identity, { now: () => now, ttlMs: 10, maxEntries: 2 });
    const first = store.resolve({ manifest: engineManifest });
    assert.throws(() => new ManifestContextStore(() => identity).resolve({ manifestRef: first.manifestRef }), /其它连接/);
    now = 110;
    assert.throws(() => store.resolve({ manifestRef: first.manifestRef }), /过期/);
    const second = store.resolve({ manifest: engineManifest });
    identity = 'otherTenant:user:token';
    assert.throws(() => store.resolve({ manifestRef: second.manifestRef }), /身份/);
    const third = store.resolve({ manifest: engineManifest });
    identity = 'otherTenant:user:newToken';
    assert.throws(() => store.resolve({ manifestRef: third.manifestRef }), /身份/);
    const fourth = store.resolve({ manifest: engineManifest });
    identity = '';
    assert.throws(() => store.resolve({ manifestRef: fourth.manifestRef }), /身份不可用/);
    identity = 'recovered';
    const recovered = store.resolve({ manifest: engineManifest });
    store.resolve({ manifest: { ...engineManifest, name: 'two' } });
    store.resolve({ manifest: { ...engineManifest, name: 'three' } });
    assert.throws(() => store.resolve({ manifestRef: recovered.manifestRef }), /淘汰/);
    assert.ok(store.resolve({ manifest: engineManifest }).manifestRef);
});
test('缓存容量不足不丢完整回执，不建立无法安全读取的引用', () => {
    const store = new ManifestContextStore(() => 'identity', { maxEntryBytes: 200 });
    const oversized = store.resolve({ manifest: { ...engineManifest, notes: 'x'.repeat(1000) } });
    assert.equal(oversized.manifestRef, undefined);
    const raw = { content: [{ type: 'text', text: JSON.stringify({ ok: true, results: [{ step: 'save', response: { Code: 1, Data: { ApiV8Code: 'x'.repeat(500) } } }] }) }] };
    const output = toolJson(store.finish(raw, oversized, { detail: 'summary' }, false));
    assert.equal(output.results[0].response.Data.ApiV8Code.length, 500);
    assert.equal(output.resultRef, undefined);
});
test('异步执行中换身份不把旧数据存为新身份回执，原始结果仍保留', () => {
    let identity = 'before';
    const store = new ManifestContextStore(() => identity);
    const resolved = store.resolve({ manifest: engineManifest });
    identity = 'after';
    const raw = { content: [{ type: 'text', text: '{"ok":true,"results":[]}' }] };
    const finished = toolJson(store.finish(raw, resolved, { detail: 'summary' }, true));
    assert.equal(finished.ok, true);
    assert.equal(finished.manifestRef, undefined);
    assert.equal(finished.resultRef, undefined);
    assert.match(finished.contextNotice, /身份变化/);
});
test('小改通过一次 Manifest 完成 plan/dry-run/apply/validate，每次仍执行确认与真实验收', async () => {
    const { call, calls } = harness();
    const first = toolJson(await call('microi_plan_system', { manifest: engineManifest, detail: 'summary' }));
    assert.ok(first.manifestRef);
    const ref = { manifestRef: first.manifestRef, manifestHash: first.manifestHash };
    const dry = toolJson(await call('microi_generate_system', ref));
    assert.equal(dry.dryRun, true);
    assert.deepEqual(dry.plan, first.plan);
    assert.equal(calls.length, 0);
    const blocked = await call('microi_generate_system', { ...ref, dryRun: false });
    assert.equal(blocked.isError, true);
    assert.match(blocked.content[0].text, /写入已拦截/);
    assert.equal(calls.length, 0);
    const generated = toolJson(await call('microi_generate_system', { ...ref, dryRun: false, confirmExecution: 'tenant' }));
    assert.equal(generated.ok, true);
    assert.equal(generated.executionState, 'completedAndValidated');
    assert.equal(generated.results.find((step) => step.step === 'upsertEngine').response.Data.ApiV8Code, undefined);
    assert.equal(generated.results.find((step) => step.step === 'upsertEngine').response.Data.OtherBusinessState, 'retained');
    assert.equal(calls.filter(call => call.method === 'saveEngineCode').length, 1);
    assert.equal(calls.filter(call => call.method === 'validateLowCodeSystem').length, 1);
    const full = toolJson(await call('microi_plan_system', { action: 'read_result', resultRef: generated.resultRef, manifestHash: first.manifestHash }));
    assert.equal(full.results.find((step) => step.step === 'upsertEngine').response.Data.ApiV8Code, engineManifest.engines[0].code);
    const validation = toolJson(await call('microi_validate_system', ref));
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.validation.Data.Warnings, ['验收警告须保留']);
    assert.equal(calls.filter(call => call.method === 'validateLowCodeSystem').length, 2);
});
test('注册会话隔离且跨身份/冲突参数的引用在任何业务写入前拒绝', async () => {
    const one = harness();
    const other = harness();
    const plan = toolJson(await one.call('microi_plan_system', { manifest: engineManifest, detail: 'summary' }));
    const input = { manifestRef: plan.manifestRef, dryRun: false, confirmExecution: 'tenant' };
    assert.equal((await other.call('microi_generate_system', input)).isError, true);
    assert.equal(other.calls.length, 0);
    assert.equal((await one.call('microi_generate_system', { ...input, manifest: { engines: [] } })).isError, true);
    assert.equal(one.calls.length, 0);
    one.state.identity = 'different-user';
    assert.equal((await one.call('microi_generate_system', input)).isError, true);
    assert.equal(one.calls.length, 0);
});
test('A 计划执行期间写入后切为 B 立即停止，保留已返回回执，不能继续写引擎或验收', async () => {
    const run = harness({ identity: 'A', switchIdentityAt: 'saveRole' });
    const manifest = { roles: [{ name: '业务角色' }], ...engineManifest };
    const plan = toolJson(await run.call('microi_plan_system', { manifest, detail: 'summary' }));
    const output = await run.call('microi_generate_system', { manifestRef: plan.manifestRef, dryRun: false, confirmExecution: 'tenant' });
    const result = toolJson(output);
    assert.equal(output.isError, true);
    assert.equal(result.ok, false);
    assert.equal(result.failedAt, 'executionIdentity');
    assert.equal(result.executionState, 'notCompletedDoNotReplay');
    assert.equal(result.identityFailure.method, 'saveRole');
    assert.equal(result.identityFailure.phase, 'after');
    assert.equal(result.identityFailure.response.Code, 1);
    assert.equal(result.identityFailure.response.Data.Id, 'role:业务角色');
    assert.match(result.identityFailure.message, /身份已变化/);
    assert.equal(result.manifestRef, undefined);
    assert.equal(result.resultRef, undefined);
    assert.equal(run.calls.filter(call => call.method === 'saveEngineCode').length, 0);
    assert.equal(run.calls.filter(call => call.method === 'validateLowCodeSystem').length, 0);
    assert.equal(run.calls.filter(call => call.method === 'saveRole').length, 1);
    assert.equal((await run.call('microi_generate_system', { manifestRef: plan.manifestRef, dryRun: false, confirmExecution: 'tenant' })).isError, true);
    assert.equal(run.calls.filter(call => call.method === 'saveRole').length, 1);
});
test('只读验收中切换身份不得把 Passed=true 当成功，也不得继续跨身份读 Banner', async () => {
    const run = harness({ identity: 'A', switchIdentityAt: 'validateLowCodeSystem' });
    const plan = toolJson(await run.call('microi_plan_system', { manifest: completeManifest, detail: 'summary' }));
    const output = await run.call('microi_validate_system', { manifestRef: plan.manifestRef });
    const result = toolJson(output);
    assert.equal(output.isError, true);
    assert.equal(result.ok, false);
    assert.equal(result.executionState, 'validationNotCompleted');
    assert.equal(result.identityFailure.method, 'validateLowCodeSystem');
    assert.equal(result.identityFailure.response.Data.Passed, true);
    assert.equal(run.calls.filter(call => call.method === 'getTableData').length, 0);
});
test('真实客户端无有效身份时全文路径也不能开始远端写入', async () => {
    const run = harness({ identity: '' });
    const output = await run.call('microi_generate_system', { manifest: engineManifest, dryRun: false, confirmExecution: 'tenant' });
    assert.equal(output.isError, true);
    assert.equal(toolJson(output).failedAt, 'executionIdentity');
    assert.equal(run.calls.length, 0);
});
test('引用不跳过无效关系与其他结构检查，旧全文契约仍输出原始字段', async () => {
    const invalid = { tables: [
            { name: 'Biz_Order', fields: [{ name: 'Items', label: '明细', component: 'JoinForm', relation: { cardinality: '1:N', targetTable: 'Biz_Item' } }] },
            { name: 'Biz_Item', fields: [{ name: 'Name', label: '名称', component: 'Text' }] },
        ] };
    const current = harness();
    const plan = toolJson(await current.call('microi_plan_system', { manifest: invalid, detail: 'summary' }));
    assert.equal(plan.ok, false);
    const generated = await current.call('microi_generate_system', { manifestRef: plan.manifestRef, dryRun: false, confirmExecution: 'tenant' });
    assert.equal(generated.isError, true);
    assert.match(generated.content[0].text, /1:N/);
    assert.equal(current.calls.length, 0);
    const legacy = harness({ legacy: true });
    const legacyPlan = toolJson(await legacy.call('microi_plan_system', { manifest: engineManifest }));
    assert.deepEqual(legacyPlan, { ok: true, dryRun: true, ...buildPlan(engineManifest) });
    const result = toolJson(await legacy.call('microi_generate_system', { manifest: engineManifest, dryRun: false, confirmExecution: 'tenant' }));
    assert.equal(result.results.find((step) => step.step === 'upsertEngine').response.Data.ApiV8Code, engineManifest.engines[0].code);
    assert.equal(result.manifestRef, undefined);
});
test('失败响应、Passed=false、警告及未知写入均完整保留，回执不可冒充成功或被自动重放', async () => {
    for (const options of [{ failedValidation: true }, { failWrite: true }, { unknownWrite: true }]) {
        const run = harness(options);
        const plan = toolJson(await run.call('microi_plan_system', { manifest: engineManifest, detail: 'summary' }));
        const output = await run.call('microi_generate_system', { manifestRef: plan.manifestRef, dryRun: false, confirmExecution: 'tenant' });
        assert.equal(output.isError, true);
        assert.match(output.content.map((entry) => entry.text).join('\n'), /notCompletedDoNotReplay/);
        assert.equal(run.calls.filter(call => call.method === 'saveEngineCode').length, 1);
        if (!options.unknownWrite) {
            const summary = toolJson(output);
            if (options.failedValidation)
                assert.deepEqual(summary.validation.Data.Errors, ['真实验收不通过']);
            else
                assert.deepEqual(summary.response.Data.Errors, ['deny']);
            const full = await run.call('microi_plan_system', { action: 'read_result', resultRef: summary.resultRef });
            assert.equal(full.isError, true);
        }
        else
            assert.match(output.content[0].text, /write may have completed/);
    }
    const diagnostic = { ok: false, validation: { Code: 1, Data: { Passed: false } }, results: [
            { step: 'failed', response: { Code: 0, Data: { ApiV8Code: 'failure evidence' } } },
            { step: 'warning', response: { Code: 1, Data: { Warnings: ['keep'], ApiV8Code: 'warning evidence' } } },
            { step: 'errorMessage', response: { Code: 1, Data: { ErrorMessage: 'keep', ApiV8Code: 'error evidence' } } },
        ] };
    assert.deepEqual(summarizeManifestResult(diagnostic).results, diagnostic.results);
});
test('新用户完整系统引用链路保留所有资源生成、关系晚绑定、默认 Banner 和真实验收门禁', async () => {
    for (const missingBanner of [false, true]) {
        const run = harness({ missingBanner });
        const planResult = await run.call('microi_plan_system', { manifest: completeManifest, detail: 'summary' });
        const plan = toolJson(planResult);
        assert.equal(planResult.isError, false, JSON.stringify(plan.errors));
        const dry = toolJson(await run.call('microi_generate_system', { manifestRef: plan.manifestRef }));
        assert.deepEqual(dry.plan, plan.plan);
        assert.equal(run.calls.length, 0);
        const output = await run.call('microi_generate_system', { manifestRef: plan.manifestRef, dryRun: false, confirmExecution: 'tenant' });
        const result = toolJson(output);
        assert.equal(result.ok, !missingBanner, output.content[0].text);
        assert.equal(output.isError, missingBanner);
        for (const method of ['saveRole', 'createTable', 'addField', 'createTableIndex', 'saveDataSource', 'saveEngineCode', 'saveEventCode', 'createModule', 'setRolePermission', 'savePageEngine', 'savePrintTemplate', 'saveWorkflowPackage', 'saveJob', 'validateLowCodeSystem']) {
            assert.ok(run.calls.some(call => call.method === method), method);
        }
        const child = run.fields.find(field => field.Component === 'TableChild');
        assert.equal(JSON.parse(child.Config).TableChildTableId, 'table:Biz_Item');
        assert.equal(JSON.parse(child.Config).TableChildSysMenuId, 'module:明细载体');
        for (const table of completeManifest.tables)
            assert.deepEqual(Object.fromEntries(Object.keys(buildDefaultFormBanner(table)).map(key => [key, run.tables.find(row => row.Name === table.name)[key]])), buildDefaultFormBanner(table));
        if (missingBanner)
            assert.match(output.content[0].text, /Banner/);
    }
});
//# sourceMappingURL=manifest-context.test.js.map