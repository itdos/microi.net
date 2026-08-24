import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBackgroundWorkload, analyzeClientChunking, normalizeAllMenuJson } from './advanced-tools.js';
import { MicroiClient } from './microi-client.js';
function createClient() {
    return new MicroiClient({
        apiBaseUrl: 'https://microi.test',
        username: '',
        password: '',
        osClient: 'iTdos',
        token: 'test-token',
        requestTimeoutMs: 1_000,
        writeRequestTimeoutMs: 1_000,
    });
}
test('classifies estimated long-running work as a background task', () => {
    const result = analyzeBackgroundWorkload({
        Name: '生成测试任务',
        ApiEngineKey: 'seed_test_tasks',
        Workload: { ExpectedItems: 2000, FanOutOperations: 10000, ExpectedSeconds: 3000 },
    });
    assert.equal(result.required, true);
    assert.match(result.reasons.join('\n'), /2000/);
    assert.match(result.reasons.join('\n'), /3000s/);
});
test('does not force a small synchronous row action into the queue', () => {
    const result = analyzeBackgroundWorkload({
        Name: '审核',
        ApiEngineKey: 'order_approve',
        Workload: { ExpectedItems: 1, ExpectedSeconds: 2 },
    });
    assert.deepEqual(result, { required: false, reasons: [] });
});
test('does not misclassify a long-task management dialog as the task itself', () => {
    const result = analyzeBackgroundWorkload({
        Name: '数据库定时备份',
        V8Code: `V8.OpenAppDialog({
      AppKey: 'microi-platform-service',
      RoutePath: '/database-backup',
      Title: '数据库定时备份',
      Width: '80%'
    });`,
    });
    assert.deepEqual(result, { required: false, reasons: [] });
});
test('still classifies install action buttons from their action semantics', () => {
    const result = analyzeBackgroundWorkload({
        Name: '安装应用',
        V8Code: "V8.ApiEngine.Run('install_application', {});",
    });
    assert.equal(result.required, true);
    assert.match(result.reasons.join('\n'), /动作语义/);
});
test('does not infer background work from PageTab filter literals', () => {
    const result = normalizeAllMenuJson({
        PageTabs: [{
                Id: 'running',
                Name: '运行中',
                V8Code: `V8.SearchSet([
        { Name: 'ShebeiZT', Type: 'In', Value: ['待安装', '使用中', '库存中'] }
      ]);`,
            }],
    });
    assert.deepEqual(result.errors, []);
    const [tab] = JSON.parse(String(result.data.PageTabs));
    assert.match(tab.V8Code, /待安装/);
    assert.equal(tab.RunBackground, undefined);
});
test('still enforces explicit long-running Workload thresholds on PageTabs', () => {
    const result = normalizeAllMenuJson({
        PageTabs: [{
                Id: 'long-running-tab',
                Name: '运行中',
                V8Code: "V8.SearchSet({ Status: 'Running' });",
                Workload: { ExpectedSeconds: 120 },
            }],
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /缺少 ApiEngineKey/);
});
test('accepts an explicit resumable client chunking contract', () => {
    const result = analyzeClientChunking({
        Name: '批量生成主构件码',
        Workload: {
            ExecutionMode: 'ClientChunked',
            MaxItemsPerChunk: 40,
            Resumable: true,
        },
    });
    assert.deepEqual(result, {
        declared: true,
        valid: true,
        maxItemsPerChunk: 40,
        resumable: true,
    });
});
test('rejects incomplete client chunking declarations', () => {
    const result = analyzeClientChunking({
        Name: '批量处理',
        Workload: {
            ExecutionMode: 'ClientChunked',
            MaxItemsPerChunk: 0,
        },
    });
    assert.equal(result.declared, true);
    assert.equal(result.valid, false);
});
test('queues a durable API-engine task with explicit idempotency and retry options', async () => {
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = (async (input, init) => {
            assert.equal(String(input), 'https://microi.test/api/BackgroundTask/RunApiEngine');
            const body = JSON.parse(String(init?.body || '{}'));
            assert.equal(body.OsClient, 'iTdos');
            assert.equal(body.ApiEngineKey, 'bulk-import-microi-store-packages');
            assert.equal(body.Title, '安装/更新全部平台应用');
            assert.deepEqual(body.Param, { ResumeInstall: true });
            assert.deepEqual(body.Options, {
                IdempotencyKey: 'mcp:bulk-store:20260822-0300',
                ConcurrencyKey: 'bulk-import-microi-store-packages',
                MaxAttempts: 5,
                RetryOnFailure: true,
            });
            return new Response(JSON.stringify({ Code: 1, Data: { Id: 'task-1' }, Msg: 'queued' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        const result = await createClient().runBackgroundApiEngine({
            apiEngineKey: 'bulk-import-microi-store-packages',
            title: '安装/更新全部平台应用',
            param: { ResumeInstall: true },
            options: {
                IdempotencyKey: 'mcp:bulk-store:20260822-0300',
                ConcurrencyKey: 'bulk-import-microi-store-packages',
                MaxAttempts: 5,
                RetryOnFailure: true,
            },
        });
        assert.equal(result.Code, 1);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('reads the authenticated users notification-center background tasks', async () => {
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = (async (input, init) => {
            assert.equal(String(input), 'https://microi.test/api/BackgroundTask/List');
            const body = JSON.parse(String(init?.body || '{}'));
            assert.equal(body.OsClient, 'iTdos');
            return new Response(JSON.stringify({ Code: 1, Data: [{ Id: 'task-1', Status: 'Succeeded' }] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        const result = await createClient().listBackgroundTasks();
        assert.equal(result.Code, 1);
        assert.equal(result.Data[0].Status, 'Succeeded');
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('requests authenticated cooperative cancellation for an exact background task', async () => {
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = (async (input, init) => {
            assert.equal(String(input), 'https://microi.test/api/BackgroundTask/Cancel');
            const body = JSON.parse(String(init?.body || '{}'));
            assert.equal(body.OsClient, 'iTdos');
            assert.equal(body.Id, 'task-old-1');
            return new Response(JSON.stringify({ Code: 1, Msg: '已请求停止后台任务' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        const result = await createClient().cancelBackgroundTask('task-old-1');
        assert.equal(result.Code, 1);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
//# sourceMappingURL=background-task.test.js.map