import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { withRequestTenant } from '../src/utils/request-tenant-context.js';
const source = await fs.readFile(new URL('../src/utils/itdos.osclient.js', import.meta.url), 'utf8');

test('首次域名发现不携带缓存或默认租户，显式租户及其它接口保留上下文', () => {
    const options = { apiBase: 'https://api.example', osClient: 'iTdos' };
    for (const path of ['/apiengine/platform-os-client-by-domain', '/api/Os/GetOsClientByDomain']) {
        assert.deepEqual(withRequestTenant({}, { ...options, url: options.apiBase + path }), {});
        assert.equal(withRequestTenant({}, { ...options, url: path, params: { OsClient: 'explicit' } }).osclient, 'explicit');
    }
    assert.equal(withRequestTenant({}, { ...options, url: '/apiengine/platform-sys-config' }).osclient, 'iTdos');
});

function harness({ cached = '', explicit = '', result = { Code: 1, Data: { OsClient: 'tenant-correct' } } } = {}) {
    let tenant = cached;
    const calls = [];
    const stop = new Error('STOP_AFTER_TENANT');
    const sandbox = {
        window: { location: { href: 'https://client.example/#/micro-app/test' } },
        location: { host: 'client.example' },
        localStorage: { getItem: () => tenant },
        config: { ApiBaseDev: 'https://api.example' },
        getRuntimeEndpointQuery: () => ({ osClient: { present: !!explicit, value: explicit }, apiBase: { present: false } }),
        getRuntimeWindowValue: () => '', publishRuntimeEndpointContext: () => {},
        PLATFORM_BOOTSTRAP_REQUEST_TIMEOUT_MS: 15000,
        store: { commit: () => {} },
        DiyCommon: {
            IsNull: v => v == null || v === '', SetApiBase: () => {},
            SetOsClient: v => { tenant = v; }, PostAsync: async request => { calls.push(request); return result; }
        },
        getPlatformSysConfig: async (_, request) => { calls.push(request); throw stop; }
    };
    const api = vm.runInNewContext(source.slice(source.indexOf('var DiyOsClient ='), source.indexOf('export { DiyOsClient }')) + '\nDiyOsClient;', sandbox);
    return { api, calls, stop, tenant: () => tenant };
}

test('无显式租户的启动重新解析域名并修复此前写入的错误默认缓存', async () => {
    for (const cached of ['', 'iTdos', 'old-tenant']) {
        const h = harness({ cached });
        await assert.rejects(h.api.OsClientInit(), error => error === h.stop);
        assert.equal(h.calls[0].url, '/apiengine/platform-os-client-by-domain');
        assert.equal(h.calls[0].skipAuthorization, true);
        assert.equal(h.tenant(), 'tenant-correct');
        assert.equal(h.calls[1].OsClient, 'tenant-correct');
    }
});

test('显式租户不做域名覆盖，域名解析失败不持久化默认租户或继续配置请求', async () => {
    const explicit = harness({ explicit: 'explicit' });
    await assert.rejects(explicit.api.OsClientInit(), error => error === explicit.stop);
    assert.equal(explicit.calls.length, 1);
    assert.equal(explicit.calls[0].OsClient, 'explicit');
    for (const result of [{ Code: 0, Msg: '域名解析失败' }, { Code: 1, Data: {} }]) {
        const h = harness({ result });
        await assert.rejects(h.api.OsClientInit(), error => error.code === 'MICROI_OSCLIENT_UNAVAILABLE');
        assert.equal(h.tenant(), '');
        assert.equal(h.calls.length, 1);
    }
});
