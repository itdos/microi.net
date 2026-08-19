import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildMicroAppEntryUrl,
  buildTokenFileLookupKeys,
  isAuthenticationFailureResponse,
  isTenantConfigurationFailureResponse,
  MicroiClient,
} from './microi-client.js';

test('micro-app entry URL preserves tenant binding and escapes path segments', () => {
  assert.equal(
    buildMicroAppEntryUrl('https://microi.test/', 'junchi tenant', 'mcp/vue-test'),
    'https://microi.test/micro-app/junchi%20tenant/mcp%2Fvue-test/index.html',
  );
});

test('micro-app runtime probe distinguishes readable HTML from gateway failure', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const completeHtml = '<!doctype html><html><head></head><body><div id="app"></div></body></html>';
    globalThis.fetch = async () => new Response(completeHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    const success = await createClient().probeMicroAppEntry('mcp-ai-vue-test');
    assert.equal(success.ok, true);
    assert.equal(success.status, 200);
    assert.equal(success.bodyBytes, Buffer.byteLength(completeHtml));
    assert.equal(success.hasHead, true);
    assert.equal(success.hasBody, true);

    globalThis.fetch = async () => new Response('<div id="app"></div>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    const fragment = await createClient().probeMicroAppEntry('mcp-ai-vue-test');
    assert.equal(fragment.ok, false);
    assert.match(fragment.error || '', /complete HTML/u);

    globalThis.fetch = async () => new Response('upstream storage unavailable', { status: 502 });
    const failure = await createClient().probeMicroAppEntry('mcp-ai-vue-test');
    assert.equal(failure.ok, false);
    assert.equal(failure.status, 502);
    assert.match(failure.error || '', /HTTP 502/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test('token-file lookup prefers exact tenant identity and retains legacy fallbacks', () => {
  assert.deepEqual(
    buildTokenFileLookupKeys('https://microi.test/', 'demo', 'Product', 'Internal'),
    [
      'https://microi.test|demo|Product|Internal',
      'https://microi.test|demo||',
      'https://microi.test|demo|Product',
      'https://microi.test|demo',
      'https://microi.test',
    ],
  );
  assert.deepEqual(
    buildTokenFileLookupKeys('https://microi.test/', 'demo'),
    ['https://microi.test|demo||', 'https://microi.test|demo', 'https://microi.test'],
  );
  assert.deepEqual(
    buildTokenFileLookupKeys('https://microi.test/', 'demo', 'Product'),
    [
      'https://microi.test|demo|Product|',
      'https://microi.test|demo||',
      'https://microi.test|demo|Product',
      'https://microi.test|demo',
      'https://microi.test',
    ],
  );
  assert.deepEqual(
    buildTokenFileLookupKeys('https://microi.test/', 'demo', '', 'Internal'),
    [
      'https://microi.test|demo||Internal',
      'https://microi.test|demo||',
      'https://microi.test|demo|Internal',
      'https://microi.test|demo',
      'https://microi.test',
    ],
  );
});

test('empty type/network still selects the canonical broker token before a stale legacy alias', () => {
  const tokens: Record<string, string> = {
    'https://microi.test|demo||': 'broker-refreshed-token',
    'https://microi.test|demo': 'stale-legacy-token',
  };
  const selected = buildTokenFileLookupKeys('https://microi.test', 'demo')
    .map(key => tokens[key])
    .find(Boolean);
  assert.equal(selected, 'broker-refreshed-token');
});

test('typed MCP reload chooses a newer untyped tenant token over a stale exact alias', () => {
  const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = (issuedAt: number, suffix: string): string =>
    `${encode({ alg: 'none' })}.${encode({ MicroiTokenIssuedAt: issuedAt, suffix })}.signature`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-mcp-token-selection-'));
  const tokenFilePath = path.join(tempDir, 'tokens.json');
  const staleExact = jwt(100, 'typed-exact');
  const refreshedUntyped = jwt(200, 'untyped');
  try {
    fs.writeFileSync(tokenFilePath, JSON.stringify({
      'https://microi.test|demo|Product|Internal': staleExact,
      'https://microi.test|demo||': refreshedUntyped,
    }));
    const client = new MicroiClient({
      apiBaseUrl: 'https://microi.test',
      username: '',
      password: '',
      osClient: 'demo',
      osClientType: 'Product',
      osClientNetwork: 'Internal',
      token: staleExact,
      tokenFilePath,
    });

    assert.equal(client.reloadTokenFromFile(), true);
    assert.equal(
      (client as unknown as { token: string }).token,
      refreshedUntyped,
    );
    client.destroy();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('MCP requests credential-free VS Code recovery and reloads the rotated token file', async () => {
  const originalFetch = globalThis.fetch;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-mcp-auth-recovery-'));
  const tokenFilePath = path.join(tempDir, 'tokens.json');
  const recoveryDir = path.join(tempDir, 'recovery');
  const apiBaseUrl = 'https://microi.test';
  const osClient = 'demo';
  const osClientType = 'Product';
  const osClientNetwork = 'Internal';
  const tokenKey = `${apiBaseUrl}|${osClient}|${osClientType}|${osClientNetwork}`;
  fs.writeFileSync(tokenFilePath, JSON.stringify({ [tokenKey]: 'old-token' }));
  let statusCalls = 0;
  let refreshCalls = 0;
  const recoveryPayloads: Array<Record<string, unknown>> = [];
  let brokerTimer: ReturnType<typeof setInterval> | undefined;

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
      if (!fs.existsSync(recoveryDir)) { return; }
      const requests = fs.readdirSync(recoveryDir).filter(name => name.endsWith('.json'));
      if (requests.length === 0) { return; }
      for (const request of requests) {
        recoveryPayloads.push(JSON.parse(fs.readFileSync(path.join(recoveryDir, request), 'utf8')) as Record<string, unknown>);
      }
      fs.writeFileSync(tokenFilePath, JSON.stringify({ [tokenKey]: 'new-token' }));
      for (const request of requests) fs.rmSync(path.join(recoveryDir, request), { force: true });
    }, 25);

    const client = new MicroiClient({
      apiBaseUrl,
      username: '',
      password: '',
      osClient,
      osClientType,
      osClientNetwork,
      token: 'old-token',
      tokenFilePath,
      authRecoveryRequestDir: recoveryDir,
      requestTimeoutMs: 1_000,
    });
    const result = await client.getStatus();
    assert.equal(result.Code, 1);
    assert.equal(statusCalls, 2);
    assert.equal(refreshCalls, 1);
    assert.equal(recoveryPayloads.length, 1);
    assert.equal(recoveryPayloads[0]?.apiBaseUrl, apiBaseUrl);
    assert.equal(recoveryPayloads[0]?.osClient, osClient);
    assert.equal(recoveryPayloads[0]?.osClientType, osClientType);
    assert.equal(recoveryPayloads[0]?.osClientNetwork, osClientNetwork);
    assert.equal(
      recoveryPayloads[0]?.failedTokenHash,
      crypto.createHash('sha256').update('old-token').digest('hex'),
    );
  } finally {
    if (brokerTimer) clearInterval(brokerTimer);
    globalThis.fetch = originalFetch;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('MCP escalates to VS Code recovery when a refresh-issued token is immediately rejected', async () => {
  const originalFetch = globalThis.fetch;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-mcp-rejected-refresh-'));
  const tokenFilePath = path.join(tempDir, 'tokens.json');
  const recoveryDir = path.join(tempDir, 'recovery');
  const apiBaseUrl = 'https://microi.test';
  const osClient = 'demo';
  const osClientType = 'Product';
  const osClientNetwork = 'Internal';
  const tokenKey = `${apiBaseUrl}|${osClient}|${osClientType}|${osClientNetwork}`;
  const refreshIssuedToken = 'refresh-issued-but-rejected-token';
  const extensionHeldToken = 'different-extension-held-token';
  const recoveredToken = 'secret-storage-relogin-token';
  fs.writeFileSync(tokenFilePath, JSON.stringify({ [tokenKey]: 'old-token' }));
  let statusCalls = 0;
  let refreshCalls = 0;
  const recoveryPayloads: Array<Record<string, unknown>> = [];
  let brokerTimer: ReturnType<typeof setInterval> | undefined;

  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/SysUser/RefreshToken')) {
        refreshCalls += 1;
        return new Response(JSON.stringify({ Code: 1, Data: {}, Msg: '' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${refreshIssuedToken}`,
          },
        });
      }
      if (url.endsWith('/api/V8Engine/GetStatus')) {
        statusCalls += 1;
        const headers = new Headers(init?.headers);
        if (headers.get('Authorization') === `Bearer ${recoveredToken}`) {
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
      if (!fs.existsSync(recoveryDir)) { return; }
      const requests = fs.readdirSync(recoveryDir).filter(name => name.endsWith('.json'));
      if (requests.length === 0) { return; }
      for (const request of requests) {
        recoveryPayloads.push(JSON.parse(fs.readFileSync(path.join(recoveryDir, request), 'utf8')) as Record<string, unknown>);
      }
      // 真实 VS Code broker 会先同步扩展宿主已持有的不同 Token；
      // 若该 Token 也被后端拒绝，第二个请求的哈希与宿主当前 Token 一致，才会触发重登。
      const brokerToken = recoveryPayloads.length === 1 ? extensionHeldToken : recoveredToken;
      fs.writeFileSync(tokenFilePath, JSON.stringify({ [tokenKey]: brokerToken }));
      for (const request of requests) fs.rmSync(path.join(recoveryDir, request), { force: true });
    }, 25);

    const client = new MicroiClient({
      apiBaseUrl,
      username: '',
      password: '',
      osClient,
      osClientType,
      osClientNetwork,
      token: 'old-token',
      tokenFilePath,
      authRecoveryRequestDir: recoveryDir,
      requestTimeoutMs: 1_000,
    });
    const result = await client.getStatus();
    assert.equal(result.Code, 1);
    assert.equal(statusCalls, 4);
    assert.equal(refreshCalls, 1, 'rejected replacement token must not enter another refresh loop');
    assert.equal(recoveryPayloads.length, 2);
    assert.equal(
      recoveryPayloads[0]?.failedTokenHash,
      crypto.createHash('sha256').update(refreshIssuedToken).digest('hex'),
      'VS Code broker must receive the hash of the replacement token that was actually rejected',
    );
    assert.equal(
      recoveryPayloads[1]?.failedTokenHash,
      crypto.createHash('sha256').update(extensionHeldToken).digest('hex'),
      'a rejected extension-held token must trigger the broker relogin branch in the same bounded request',
    );
    const storedTokens = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8')) as Record<string, string>;
    assert.equal(storedTokens[tokenKey], recoveredToken);
  } finally {
    if (brokerTimer) clearInterval(brokerTimer);
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
          V8Limit: payload.V8Limit,
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
      V8Limit: 0,
      functionDescription: '创建接口引擎传输恢复测试',
    });

    assert.equal(result.Code, 1);
    assert.equal((result.Data as Record<string, unknown>).RecoveredAfterTransportError, true);
    assert.equal((result.Data as Record<string, unknown>).Verified, true);
    assert.equal(storedEngine?.V8Limit, 0);
    assert.match(String(storedEngine?.ApiV8Code || ''), /return \{ Code: 1, Data: "ok" \};/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('updateEngineRuntimeLimit updates only V8Limit and verifies explicit true', async () => {
  const originalFetch = globalThis.fetch;
  const storedEngine: Record<string, unknown> = {
    ApiEngineKey: 'runtime-policy-probe',
    ApiV8Code: 'return { Code: 1 };',
    V8Limit: 0,
  };
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/V8Engine/UpdateApiEngineCode')) {
        const payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        assert.equal(payload.ApiEngineKey, 'runtime-policy-probe');
        assert.equal(payload.V8Limit, 1);
        assert.equal(payload.ApiV8CodeBase64, undefined);
        assert.equal(payload.ApiV8Code, undefined);
        storedEngine.V8Limit = payload.V8Limit;
        return jsonResponse({ Code: 1, Data: { V8Limit: 1 }, Msg: '' });
      }
      if (url.endsWith('/api/V8Engine/GetApiEngineCode')) {
        return jsonResponse({ Code: 1, Data: storedEngine, Msg: '' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await createClient().updateEngineRuntimeLimit('runtime-policy-probe', true);

    assert.equal(result.Code, 1);
    assert.equal((result.Data as Record<string, unknown>).Verified, true);
    assert.equal((result.Data as Record<string, unknown>).V8Limit, 1);
    assert.equal(storedEngine.ApiV8Code, 'return { Code: 1 };');
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
      MenuBadgeEnabled: 1,
      MenuBadgeApiEngineKey: 'purchase_contract_menu_badge',
      EnableViewSchema: 1,
      ViewSchema: JSON.stringify({
        Views: [
          {
            Scene: 'List',
            Device: 'PC',
            Layout: {
              List: {
                Columns: [{
                  Field: 'ContractName',
                  Lines: ['ContractName', 'SignerName'],
                  TrailingFields: [{ Name: 'Status', DisplayStyle: 'Tag' }],
                }],
              },
            },
          },
          {
            Scene: 'Card',
            Device: 'Mobile',
            Layout: {
              Card: {
                TitleField: 'ContractName',
                TopFields: ['Status'],
                RightFields: [{ Name: 'Amount', Format: 'currency' }],
                BottomFields: ['ContractNo'],
              },
            },
          },
        ],
      }),
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
    assert.equal(storedModule.MenuBadgeEnabled, 1);
    assert.equal(storedModule.MenuBadgeApiEngineKey, 'purchase_contract_menu_badge');
    const savedSchema = JSON.parse(String(storedModule.ViewSchema)) as { Views: Array<{ Layout: Record<string, unknown> }> };
    assert.ok(savedSchema.Views[0].Layout.List);
    assert.ok(savedSchema.Views[1].Layout.Card);
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

test('createModule completes and verifies MicroService menu linkage after the idempotent create call', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      requests.push({ url, body });
      if (url.endsWith('/api/V8Engine/CreateModule')) {
        return jsonResponse({ Code: 1, Data: { ModuleId: 'menu-1', Url: '/micro-app/mcp-ai-vue-test/context-test' }, Msg: '' });
      }
      if (url.endsWith('/api/V8Engine/UpdateModule')) {
        return jsonResponse({ Code: 1, Data: { ModuleId: 'menu-1' }, Msg: '' });
      }
      if (url.endsWith('/api/V8Engine/GetModule')) {
        return jsonResponse({
          Code: 1,
          Data: {
            Id: 'menu-1',
            IsMicroiService: 1,
            OpenType: 'MicroService',
            ComponentName: 'MicroService',
            ComponentPath: '/micro-app/host',
            Url: '/micro-app/mcp-ai-vue-test/context-test',
            MicroServiceId: 'service-1',
            MicroServicePageId: 'page-1',
            MicroServiceRoutePath: '/context-test',
          },
          Msg: '',
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await createClient().createModule({
      Name: '上下文测试',
      ParentId: 'test-parent',
      OpenType: 'MicroService',
      ComponentName: 'MicroService',
      ComponentPath: '/micro-app/host',
      Url: '/micro-app/mcp-ai-vue-test/context-test',
      IsMicroiService: 1,
      MicroServiceId: 'service-1',
      MicroServicePageId: 'page-1',
      MicroServiceRoutePath: '/context-test',
      MicroServiceKey: 'mcp-ai-vue-test',
    });

    assert.equal(result.Code, 1);
    assert.equal((result.Data as Record<string, unknown>).MicroServiceBindingVerified, true);
    assert.equal(requests.filter(request => request.url.endsWith('/api/V8Engine/CreateModule')).length, 1);
    assert.equal(requests.filter(request => request.url.endsWith('/api/V8Engine/UpdateModule')).length, 1);
    assert.equal(requests.filter(request => request.url.endsWith('/api/V8Engine/GetModule')).length, 1);
    const update = requests.find(request => request.url.endsWith('/api/V8Engine/UpdateModule'))?.body;
    assert.equal(update?.MicroServicePageId, 'page-1');
    assert.equal(update?.MicroServiceRoutePath, '/context-test');
    assert.equal(update?.MicroServiceKey, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createTableIndex confirms an uncertain DDL write by normalized index readback', async () => {
  const originalFetch = globalThis.fetch;
  let indexes: Record<string, unknown>[] = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/V8Engine/CreateTableIndex')) {
        const payload = JSON.parse(String(init?.body || '{}')) as {
          IndexName?: string;
          Columns?: string[];
          Unique?: boolean;
        };
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
    assert.equal((result.Data as Record<string, unknown>).RecoveredAfterTransportError, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dropTableIndex confirms an uncertain DDL write by absence readback', async () => {
  const originalFetch = globalThis.fetch;
  let indexes: Record<string, unknown>[] = [{
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
    assert.equal((result.Data as Record<string, unknown>).RecoveredAfterTransportError, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
