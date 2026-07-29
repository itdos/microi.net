import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isAuthenticationFailureResponse, isTenantConfigurationFailureResponse, MicroiClient, } from './microi-client.js';
function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
function createClient() {
    return new MicroiClient({
        apiBaseUrl: 'https://microi.test',
        username: '',
        password: '',
        osClient: 'demo',
        token: 'test-token',
        requestTimeoutMs: 1_000,
        writeRequestTimeoutMs: 1_000,
    });
}
test('authentication failure detection covers signature/version errors but not invalid tenant configuration', () => {
    assert.equal(isAuthenticationFailureResponse({
        Code: 1001,
        Msg: 'Token签名验证失败，请重新登录',
        DataAppend: { ReasonCode: 'AuthVersionChanged' },
    }), true);
    assert.equal(isAuthenticationFailureResponse({
        Code: 1002,
        Msg: '身份验证失败',
    }), true);
    assert.equal(isAuthenticationFailureResponse({
        Code: 0,
        Msg: 'Token签名验证失败，请重新登录',
    }), true);
    assert.equal(isTenantConfigurationFailureResponse({
        Code: 1001,
        Msg: '无效的租户标识：demo',
    }), true);
    assert.equal(isAuthenticationFailureResponse({
        Code: 1001,
        Msg: '无效的租户标识：demo',
    }), false);
});
test('MCP requests credential-free VS Code recovery and reloads the rotated token file', async () => {
    const originalFetch = globalThis.fetch;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-mcp-auth-recovery-'));
    const tokenFilePath = path.join(tempDir, 'tokens.json');
    const recoveryDir = path.join(tempDir, 'recovery');
    const apiBaseUrl = 'https://microi.test';
    const osClient = 'demo';
    const tokenKey = `${apiBaseUrl}|${osClient}`;
    fs.writeFileSync(tokenFilePath, JSON.stringify({ [tokenKey]: 'old-token' }));
    let statusCalls = 0;
    let refreshCalls = 0;
    let brokerTimer;
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/SysUser/RefreshToken')) {
                refreshCalls += 1;
                return jsonResponse({
                    Code: 1001,
                    Data: null,
                    Msg: 'Token签名验证失败，请重新登录',
                    DataAppend: { ReasonCode: 'AuthVersionChanged' },
                });
            }
            if (url.endsWith('/api/V8Engine/GetStatus')) {
                statusCalls += 1;
                const headers = new Headers(init?.headers);
                if (headers.get('Authorization') === 'Bearer new-token') {
                    return jsonResponse({ Code: 1, Data: { ok: true }, Msg: '' });
                }
                return jsonResponse({
                    Code: 1001,
                    Data: null,
                    Msg: 'Token签名验证失败，请重新登录',
                    DataAppend: { ReasonCode: 'AuthVersionChanged' },
                });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        brokerTimer = setInterval(() => {
            if (!fs.existsSync(recoveryDir)) {
                return;
            }
            const requests = fs.readdirSync(recoveryDir).filter(name => name.endsWith('.json'));
            if (requests.length === 0) {
                return;
            }
            fs.writeFileSync(tokenFilePath, JSON.stringify({ [tokenKey]: 'new-token' }));
            for (const request of requests)
                fs.rmSync(path.join(recoveryDir, request), { force: true });
        }, 25);
        const client = new MicroiClient({
            apiBaseUrl,
            username: '',
            password: '',
            osClient,
            token: 'old-token',
            tokenFilePath,
            authRecoveryRequestDir: recoveryDir,
            requestTimeoutMs: 1_000,
        });
        const result = await client.getStatus();
        assert.equal(result.Code, 1);
        assert.equal(statusCalls, 2);
        assert.equal(refreshCalls, 1);
    }
    finally {
        if (brokerTimer)
            clearInterval(brokerTimer);
        globalThis.fetch = originalFetch;
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
test('saveEngineCode confirms an uncertain write by readback', async () => {
    const originalFetch = globalThis.fetch;
    let storedCode = '';
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/GetApiEngineCode')) {
                return jsonResponse({
                    Code: 1,
                    Data: {
                        ApiEngineKey: 'transport-probe',
                        ApiV8Code: storedCode || 'return { Code: 1 };',
                        Version: 'v1.0.0',
                    },
                    Msg: '',
                });
            }
            if (url.endsWith('/api/V8Engine/UpdateApiEngineCode')) {
                const payload = JSON.parse(String(init?.body || '{}'));
                storedCode = Buffer.from(payload.ApiV8CodeBase64 || '', 'base64').toString('utf8');
                throw new TypeError('socket closed after request body was sent');
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const result = await createClient().saveEngineCode('transport-probe', 'return { Code: 1, Data: "ok" };', { functionDescription: '传输恢复测试' });
        assert.equal(result.Code, 1);
        assert.equal(result.Data.RecoveredAfterTransportError, true);
        assert.match(storedCode, /return \{ Code: 1, Data: "ok" \};/);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('saveEngineCode blocks suspicious large source reduction unless explicitly confirmed', async () => {
    const originalFetch = globalThis.fetch;
    let updateCalls = 0;
    try {
        globalThis.fetch = async (input) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/GetApiEngineCode')) {
                return jsonResponse({
                    Code: 1,
                    Data: {
                        ApiEngineKey: 'large-engine',
                        ApiV8Code: `// full source\n${'var value = 1;\n'.repeat(700)}`,
                        Version: 'v1.0.0',
                    },
                    Msg: '',
                });
            }
            if (url.endsWith('/api/V8Engine/UpdateApiEngineCode')) {
                updateCalls += 1;
                return jsonResponse({ Code: 1, Data: {}, Msg: '' });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        await assert.rejects(createClient().saveEngineCode('large-engine', 'return { Code: 1 };'), /减少超过 15%/);
        assert.equal(updateCalls, 0);
        const confirmed = await createClient().saveEngineCode('large-engine', 'return { Code: 1 };', { confirmLargeReduction: true });
        assert.equal(confirmed.Code, 1);
        assert.equal(updateCalls, 1);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('saveEventCode confirms an uncertain write by readback', async () => {
    const originalFetch = globalThis.fetch;
    let storedCode = '';
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/GetV8EventCode')) {
                return jsonResponse({
                    Code: 1,
                    Data: {
                        FormEngineKey: 'diy_test',
                        EventType: 'SubmitAfterServerV8',
                        V8Code: storedCode || '// old',
                    },
                    Msg: '',
                });
            }
            if (url.endsWith('/api/V8Engine/UpdateV8EventCode')) {
                const payload = JSON.parse(String(init?.body || '{}'));
                storedCode = payload.V8Code || '';
                throw new TypeError('connection reset after write');
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const result = await createClient().saveEventCode('diy_test', 'SubmitAfterServerV8', 'return { Code: 1 };', { functionDescription: '事件传输恢复测试' });
        assert.equal(result.Code, 1);
        assert.equal(result.Data.RecoveredAfterTransportError, true);
        assert.match(storedCode, /return \{ Code: 1 \};/);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('createEngine confirms an uncertain write by readback', async () => {
    const originalFetch = globalThis.fetch;
    let storedEngine;
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/CreateApiEngine')) {
                const payload = JSON.parse(String(init?.body || '{}'));
                storedEngine = {
                    ApiEngineKey: payload.ApiEngineKey,
                    ApiName: payload.ApiName,
                    ApiAddress: payload.ApiAddress,
                    ApiV8Code: Buffer.from(String(payload.ApiV8CodeBase64 || ''), 'base64').toString('utf8'),
                    Version: payload.Version,
                };
                throw new TypeError('connection reset after engine creation');
            }
            if (url.endsWith('/api/V8Engine/GetApiEngineCode')) {
                return jsonResponse(storedEngine
                    ? { Code: 1, Data: storedEngine, Msg: '' }
                    : { Code: 0, Data: null, Msg: 'not found' });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const result = await createClient().createEngine({
            ApiEngineKey: 'create-transport-probe',
            ApiName: 'Create transport probe',
            Code: 'return { Code: 1, Data: "ok" };',
            functionDescription: '创建接口引擎传输恢复测试',
        });
        assert.equal(result.Code, 1);
        assert.equal(result.Data.RecoveredAfterTransportError, true);
        assert.equal(result.Data.Verified, true);
        assert.match(String(storedEngine?.ApiV8Code || ''), /return \{ Code: 1, Data: "ok" \};/);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('createEngine bounds each recovery readback with the short timeout', async () => {
    const originalFetch = globalThis.fetch;
    let readbackCount = 0;
    let storedEngine;
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/CreateApiEngine')) {
                const payload = JSON.parse(String(init?.body || '{}'));
                storedEngine = {
                    ApiEngineKey: payload.ApiEngineKey,
                    ApiV8Code: Buffer.from(String(payload.ApiV8CodeBase64 || ''), 'base64').toString('utf8'),
                };
                throw new TypeError('write response lost');
            }
            if (url.endsWith('/api/V8Engine/GetApiEngineCode')) {
                readbackCount++;
                if (readbackCount === 1) {
                    return await new Promise((_resolve, reject) => {
                        const signal = init?.signal;
                        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
                        if (signal?.aborted) {
                            abort();
                            return;
                        }
                        signal?.addEventListener('abort', abort, { once: true });
                    });
                }
                return jsonResponse({ Code: 1, Data: storedEngine, Msg: '' });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const client = new MicroiClient({
            apiBaseUrl: 'https://microi.test',
            username: '',
            password: '',
            osClient: 'demo',
            token: 'test-token',
            requestTimeoutMs: 120_000,
            writeRequestTimeoutMs: 1_000,
            readbackRequestTimeoutMs: 1_000,
        });
        const startedAt = Date.now();
        const result = await client.createEngine({
            ApiEngineKey: 'bounded-readback-probe',
            ApiName: 'Bounded readback probe',
            Code: 'return { Code: 1 };',
        });
        const elapsedMs = Date.now() - startedAt;
        assert.equal(result.Code, 1);
        assert.equal(readbackCount, 2);
        assert.ok(elapsedMs >= 900, `expected first readback to time out, elapsed=${elapsedMs}ms`);
        assert.ok(elapsedMs < 4_000, `recovery readback was not bounded, elapsed=${elapsedMs}ms`);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('updateModule verifies menu JSON after an uncertain write', async () => {
    const originalFetch = globalThis.fetch;
    let storedModule = {
        Id: 'menu-1',
        MoreBtns: '[]',
    };
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/UpdateModule')) {
                const payload = JSON.parse(String(init?.body || '{}'));
                storedModule = {
                    ...storedModule,
                    ...payload,
                    Id: String(payload.ModuleId || payload.Id || storedModule.Id),
                };
                throw new TypeError('response stream closed');
            }
            if (url.endsWith('/api/V8Engine/GetModule')) {
                return jsonResponse({ Code: 1, Data: storedModule, Msg: '' });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const result = await createClient().updateModule({
            ModuleId: 'menu-1',
            MoreBtns: JSON.stringify([{
                    Id: 'button-1',
                    Name: '测试',
                    V8Code: 'V8.Result = true;',
                    _RawName: '测试',
                }]),
        });
        assert.equal(result.Code, 1);
        assert.equal(result.Data.RecoveredAfterTransportError, true);
        assert.equal(result.Data.Verified, true);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('updateModule rejects a false success when EditCodeShowV8 is not persisted', async () => {
    const originalFetch = globalThis.fetch;
    let receivedEditCodeShowV8 = '';
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/UpdateModule')) {
                const payload = JSON.parse(String(init?.body || '{}'));
                receivedEditCodeShowV8 = String(payload.EditCodeShowV8 || '');
                return jsonResponse({ Code: 1, Data: { Id: 'menu-visibility' }, Msg: '' });
            }
            if (url.endsWith('/api/V8Engine/GetModule')) {
                return jsonResponse({
                    Code: 1,
                    Data: {
                        Id: 'menu-visibility',
                        EditCodeShowV8: '',
                    },
                    Msg: '',
                });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const result = await createClient().updateModule({
            ModuleId: 'menu-visibility',
            EditCodeShowV8: 'return V8.Form.Status === "Draft";',
        });
        assert.equal(receivedEditCodeShowV8, 'return V8.Form.Status === "Draft";');
        assert.equal(result.Code, 0);
        assert.match(result.Msg || '', /EditCodeShowV8/);
        assert.deepEqual(result.Data.Mismatches, ['EditCodeShowV8']);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('createTableIndex confirms an uncertain DDL write by normalized index readback', async () => {
    const originalFetch = globalThis.fetch;
    let indexes = [];
    try {
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/CreateTableIndex')) {
                const payload = JSON.parse(String(init?.body || '{}'));
                indexes = [{
                        Key_name: payload.IndexName,
                        Column_name: (payload.Columns || []).join(', '),
                        Columns: payload.Columns,
                        Non_unique: payload.Unique ? 0 : 1,
                        IsUnique: Boolean(payload.Unique),
                        Is_primary: 0,
                        IsPrimary: false,
                    }];
                throw new TypeError('connection reset after CREATE INDEX');
            }
            if (url.endsWith('/api/V8Engine/GetTableIndexes')) {
                return jsonResponse({ Code: 1, Data: indexes, Msg: '' });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const result = await createClient().createTableIndex({
            TableName: 'biz_order',
            IndexName: 'uk_biz_order_osclient_orderno',
            Columns: ['OsClient', 'OrderNo'],
            Unique: true,
        });
        assert.equal(result.Code, 1);
        assert.equal(result.Data.RecoveredAfterTransportError, true);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test('dropTableIndex confirms an uncertain DDL write by absence readback', async () => {
    const originalFetch = globalThis.fetch;
    let indexes = [{
            Key_name: 'idx_biz_order_status',
            Column_name: 'Status',
            Columns: ['Status'],
            Non_unique: 1,
        }];
    try {
        globalThis.fetch = async (input) => {
            const url = String(input);
            if (url.endsWith('/api/V8Engine/DropTableIndex')) {
                indexes = [];
                throw new TypeError('connection reset after DROP INDEX');
            }
            if (url.endsWith('/api/V8Engine/GetTableIndexes')) {
                return jsonResponse({ Code: 1, Data: indexes, Msg: '' });
            }
            throw new Error(`Unexpected URL: ${url}`);
        };
        const result = await createClient().dropTableIndex('biz_order', 'idx_biz_order_status');
        assert.equal(result.Code, 1);
        assert.equal(result.Data.RecoveredAfterTransportError, true);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
//# sourceMappingURL=microi-client-recovery.test.js.map