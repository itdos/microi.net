import assert from 'node:assert/strict';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createClient(): MicroiClient {
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
        const payload = JSON.parse(String(init?.body || '{}')) as { ApiV8CodeBase64?: string };
        storedCode = Buffer.from(payload.ApiV8CodeBase64 || '', 'base64').toString('utf8');
        throw new TypeError('socket closed after request body was sent');
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await createClient().saveEngineCode(
      'transport-probe',
      'return { Code: 1, Data: "ok" };',
      { functionDescription: '传输恢复测试' },
    );

    assert.equal(result.Code, 1);
    assert.equal((result.Data as Record<string, unknown>).RecoveredAfterTransportError, true);
    assert.match(storedCode, /return \{ Code: 1, Data: "ok" \};/);
  } finally {
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

    await assert.rejects(
      createClient().saveEngineCode('large-engine', 'return { Code: 1 };'),
      /减少超过 15%/,
    );
    assert.equal(updateCalls, 0);

    const confirmed = await createClient().saveEngineCode(
      'large-engine',
      'return { Code: 1 };',
      { confirmLargeReduction: true },
    );
    assert.equal(confirmed.Code, 1);
    assert.equal(updateCalls, 1);
  } finally {
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
        const payload = JSON.parse(String(init?.body || '{}')) as { V8Code?: string };
        storedCode = payload.V8Code || '';
        throw new TypeError('connection reset after write');
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await createClient().saveEventCode(
      'diy_test',
      'SubmitAfterServerV8',
      'return { Code: 1 };',
      { functionDescription: '事件传输恢复测试' },
    );

    assert.equal(result.Code, 1);
    assert.equal((result.Data as Record<string, unknown>).RecoveredAfterTransportError, true);
    assert.match(storedCode, /return \{ Code: 1 \};/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createEngine confirms an uncertain write by readback', async () => {
  const originalFetch = globalThis.fetch;
  let storedEngine: Record<string, unknown> | undefined;
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/V8Engine/CreateApiEngine')) {
        const payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
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
    assert.equal((result.Data as Record<string, unknown>).RecoveredAfterTransportError, true);
    assert.equal((result.Data as Record<string, unknown>).Verified, true);
    assert.match(String(storedEngine?.ApiV8Code || ''), /return \{ Code: 1, Data: "ok" \};/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createEngine bounds each recovery readback with the short timeout', async () => {
  const originalFetch = globalThis.fetch;
  let readbackCount = 0;
  let storedEngine: Record<string, unknown> | undefined;
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/V8Engine/CreateApiEngine')) {
        const payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        storedEngine = {
          ApiEngineKey: payload.ApiEngineKey,
          ApiV8Code: Buffer.from(String(payload.ApiV8CodeBase64 || ''), 'base64').toString('utf8'),
        };
        throw new TypeError('write response lost');
      }
      if (url.endsWith('/api/V8Engine/GetApiEngineCode')) {
        readbackCount++;
        if (readbackCount === 1) {
          return await new Promise<Response>((_resolve, reject) => {
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('updateModule verifies menu JSON after an uncertain write', async () => {
  const originalFetch = globalThis.fetch;
  let storedModule: Record<string, unknown> = {
    Id: 'menu-1',
    MoreBtns: '[]',
  };
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/V8Engine/UpdateModule')) {
        const payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
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
    assert.equal((result.Data as Record<string, unknown>).RecoveredAfterTransportError, true);
    assert.equal((result.Data as Record<string, unknown>).Verified, true);
  } finally {
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
        const payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
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
    assert.deepEqual(
      (result.Data as { Mismatches?: string[] }).Mismatches,
      ['EditCodeShowV8'],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
