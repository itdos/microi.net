import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { readSecurityBlockedResult, SECURITY_GUARD_DOCUMENTATION_URL } from '../src/utils/security-blocked.js';

const source = await fs.readFile(new URL('../src/utils/api-service-status.js', import.meta.url), 'utf8');
const health = () => ({ status: 200, json: async () => ({ Code: 1, Data: { Status: 'Healthy', BackendVersion: 'v8.3.1' } }) });

function harness({ ready = false } = {}) {
    let now = 10000;
    let sequence = 0;
    let reloads = 0;
    let respond = async () => { throw new Error('Network Error'); };
    const timers = new Map();
    const calls = [];
    const window = {
        location: { origin: 'http://client.example', reload: () => reloads++ },
        __MICROI_APP_READY__: ready,
        __MICROI_APP_BOOT_ERROR__: ready ? '' : 'Network Error',
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        fetch(url, options) { calls.push({ url, options, at: now }); return respond(url, options); }
    };
    const sandbox = {
        window, reactive: value => value, readSecurityBlockedResult, SECURITY_GUARD_DOCUMENTATION_URL,
        URL, AbortController, Date: class extends Date { static now() { return now; } }
    };
    const api = vm.runInNewContext(source.replace(/^import .*;\s*/gm, '').replace(/^export /gm, '')
        + '\n({apiServiceState,reportApiServiceFailure,reportApiServiceRecovered,checkApiServiceNow});', sandbox);
    const context = { apiBase: 'https://api.example', osClient: 'tenant-a', url: '/api/business-save', method: 'POST' };
    const flush = () => new Promise(resolve => setImmediate(resolve));
    async function tick(ms) {
        const target = now + ms;
        for (let guard = 0; guard < 1000; guard++) {
            const next = [...timers].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            timers.delete(next[0]); now = next[1].at; next[1].callback(); await flush();
        }
        now = target; await flush();
    }
    return { ...api, window, calls, context, tick, flush, setRespond: fn => { respond = fn; }, reloads: () => reloads };
}

async function outage(h) {
    h.reportApiServiceFailure(new Error('Network Error'), h.context);
    await h.tick(2000);
    assert.equal(h.apiServiceState.active, true);
}

test('异常页面每五秒串行探测，后端恢复时重载失败的启动页且只执行一次', async () => {
    const h = harness();
    await outage(h);
    assert.equal(h.calls.length, 2);
    await h.tick(4999); assert.equal(h.calls.length, 2);
    await h.tick(1); assert.equal(h.calls.length, 3);
    h.setRespond(async () => health());
    await h.tick(5000);
    assert.equal(h.calls.length, 4);
    assert.equal(h.apiServiceState.active, false);
    assert.equal(h.reloads(), 1);
    await h.tick(20000); assert.equal(h.calls.length, 4);
    assert.equal(h.reloads(), 1);
    for (const call of h.calls) {
        assert.equal(new URL(call.url).pathname, '/apiengine/platform-service-health');
        assert.equal(new URL(call.url).searchParams.get('OsClient'), 'tenant-a');
        assert.equal(call.options.method, 'GET');
        assert.equal(call.options.credentials, 'omit');
        assert.equal(call.options.cache, 'no-store');
        assert.equal(call.options.body, undefined);
    }
});

test('已打开的业务页面在恢复时原地撤掉异常层，不刷新或重放保存请求', async () => {
    const h = harness({ ready: true });
    await outage(h);
    h.setRespond(async () => health());
    await h.tick(5000);
    assert.equal(h.apiServiceState.active, false);
    assert.equal(h.reloads(), 0);
    assert.ok(h.calls.every(call => call.options.method === 'GET'));
});

test('自动检查尚未完成时点击重新连接合并同一个探测', async () => {
    const h = harness();
    await outage(h);
    let resolveProbe;
    h.setRespond(() => new Promise(resolve => { resolveProbe = resolve; }));
    await h.tick(5000);
    const first = h.checkApiServiceNow();
    const second = h.checkApiServiceNow();
    assert.equal(h.calls.length, 3);
    resolveProbe(health());
    await Promise.all([first, second]);
    assert.equal(h.apiServiceState.active, false);
    assert.equal(h.reloads(), 1);
});

test('探测超时后继续五秒重试，慢请求之间不重叠', async () => {
    const h = harness();
    await outage(h);
    h.setRespond((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('timeout')));
    }));
    await h.tick(5000); assert.equal(h.calls.length, 3);
    await h.tick(4999); assert.equal(h.calls.length, 3);
    await h.tick(1); assert.equal(h.calls.length, 3);
    await h.tick(5000); assert.equal(h.calls.length, 4);
});

test('反向代理的 HTML/404 不能被当成后端恢复而触发循环刷新', async () => {
    const h = harness();
    await outage(h);
    h.setRespond(async () => ({ status: 404, json: async () => null }));
    assert.equal(await h.checkApiServiceNow(), false);
    assert.equal(h.apiServiceState.active, true);
    assert.equal(h.reloads(), 0);
});

test('旧目标迟到的健康结果不能关闭新目标的故障界面或覆盖诊断', async () => {
    const h = harness();
    await outage(h);
    let finishOld;
    h.setRespond(url => new URL(url).host === 'api.example'
        ? new Promise(resolve => { finishOld = resolve; })
        : Promise.reject(new Error('Network Error')));
    const old = h.checkApiServiceNow();
    h.reportApiServiceFailure(new Error('Network Error'), { ...h.context, apiBase: 'https://new-api.example' });
    finishOld(health());
    await old; await h.flush();
    assert.equal(h.reloads(), 0);
    assert.equal(h.apiServiceState.active, true);
    assert.equal(h.apiServiceState.apiBase, 'https://new-api.example');
    assert.doesNotMatch(h.apiServiceState.healthCheckUrl, /\/\/api\.example/);
});
