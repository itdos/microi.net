import assert from 'node:assert/strict';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';
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
//# sourceMappingURL=microi-client-recovery.test.js.map