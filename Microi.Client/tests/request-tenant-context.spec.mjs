import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const common = await fs.readFile(new URL('../src/utils/diy.common.js', import.meta.url), 'utf8');
const tenantModule = await import('../src/utils/request-tenant-context.js').catch(() => ({}));
const base = 'https://localhost:61501';

function transport(method = 'UseAxios', apiBase = base) {
    const calls = [];
    const axios = options => { calls.push(options); return new Promise(() => {}); };
    axios.all = () => new Promise(() => {});
    const DiyCommon = {
        getToken: () => 'stale-other-tenant-token', GetApiBase: () => apiBase,
        GetOsClient: () => 'iTdos', GetDid: () => 'isolated-device',
        GetCurrentLang: () => 'cn', AttachLangParam: () => {},
        IsNull: value => value == null || value === ''
    };
    const start = common.indexOf(`    ${method}: function`);
    const end = common.indexOf(method === 'UseAxios' ? '    UseAxiosAll:' : '    GetSysBaseData:', start);
    const subject = vm.runInNewContext(`({${common.slice(start, end)}})`, {
        DiyCommon, axios, LocalStorageManager: { get: () => '' }, ...tenantModule
    });
    return { calls, run: subject[method] };
}

for (const method of ['get', 'post']) {
    test(`${method} 当前租户请求不能由旧 Token 选择租户`, () => {
        const t = transport();
        t.run({ url: `${base}/apiengine/platform-current-user`, method, param: {} });
        assert.equal(t.calls[0].headers.osclient, 'iTdos');
        assert.equal(t.calls[0].headers.authorization, 'Bearer stale-other-tenant-token');
    });
}

for (const [name, url, param, header, expected] of [
    ['JSON 显式租户', `${base}/apiengine/public`, { OsClient: 'target' }, {}, 'target'],
    ['URL 显式租户', `${base}/apiengine/public?OsClient=target`, {}, {}, 'target'],
    ['路径显式租户', `${base}/apiengine/public--OsClient--target--`, {}, {}, 'target'],
    ['表单显式租户', `${base}/apiengine/public`, new URLSearchParams({ OsClient: 'target' }), {}, 'target'],
    ['既有请求头', `${base}/apiengine/public`, {}, { OsClient: 'target' }, 'target'],
    ['其它服务器', 'https://another.invalid/apiengine/public', {}, {}, undefined],
    ['端口边界', 'https://localhost:615010/apiengine/public', {}, {}, undefined]
]) {
    test(`${name} 保留调用者上下文且不修改入参`, () => {
        const t = transport();
        const originalHeader = { ...header };
        t.run({ url, method: 'post', param, header });
        const keys = Object.keys(t.calls[0].headers).filter(key => key.toLowerCase() === 'osclient');
        assert.equal(keys.length, expected === undefined ? 0 : 1);
        assert.equal(t.calls[0].headers[keys[0]], expected);
        assert.deepEqual(header, originalHeader);
    });
}

test('API 子路径边界不会把页面租户传给相邻服务', () => {
    const t = transport('UseAxios', `${base}/microi`);
    t.run({ url: `${base}/microi-other/api`, method: 'get', param: {} });
    assert.equal(t.calls[0].headers.osclient, undefined);
    t.run({ url: `${base}/microi/api`, method: 'get', param: {} });
    assert.equal(t.calls[1].headers.osclient, 'iTdos');
});

test('批量请求逐项解析租户，不能让前一个请求污染后一个', () => {
    const t = transport('UseAxiosAll');
    t.run({ method: 'post', allParams: [
        { Url: `${base}/api/first`, Param: { OsClient: 'target' } },
        { Url: `${base}/api/second`, Param: {} },
        { Url: 'https://another.invalid/api', Param: {} }
    ] });
    assert.deepEqual(t.calls.map(call => call.headers.osclient), ['target', 'iTdos', undefined]);
});

const stripImports = source => source.replace(/^import\s[\s\S]*?;\s*/gm, '').replace(/^export /gm, '');
test('共享 axios 拦截器同时保留查询参数与 JSON 的租户选择', async () => {
    let intercept;
    const source = await fs.readFile(new URL('../src/utils/request.js', import.meta.url), 'utf8');
    vm.runInNewContext(stripImports(source).replace('default service;', '')
        .replace('import.meta.env.VITE_BASE_API', 'undefined'), {
        axios: { create: () => ({ interceptors: {
            request: { use: action => { intercept = action; } }, response: { use: () => {} }
        } }) },
        ElMessageBox: {}, ElMessage: {},
        DiyCommon: { getToken: () => '', GetApiBase: () => base, GetOsClient: () => 'iTdos' },
        ...tenantModule
    });
    const request = { url: `${base}/api`, headers: {}, data: { OsClient: 'body-tenant' }, params: { _Lang: 'cn' } };
    assert.equal(intercept(request).headers.osclient, 'body-tenant');
    assert.equal(intercept({ ...request, headers: {}, params: { OsClient: 'query-tenant' } }).headers.osclient, 'query-tenant');
});

const userSource = await fs.readFile(new URL('../src/pinia/modules/user.js', import.meta.url), 'utf8');
test('身份启动失败只向守卫返回错误，重试不触发全局弹窗', async () => {
    let notices = 0;
    let requestOptions;
    const failure = { Code: 0, Msg: '真实接口配置错误' };
    const options = vm.runInNewContext(`${stripImports(userSource)}\nuseUserStore;`, {
        defineStore: (_, value) => value,
        DiyApi: { GetCurrentUser: () => '/apiengine/platform-current-user' },
        DiyCommon: {
            Post: (_url, _data, success) => success(failure),
            PostAsync: async (_url, _data, _success, _error, _type, opts) => { requestOptions = opts; return failure; },
            Result: () => { notices++; return false; }
        }
    });
    await assert.rejects(options.actions.getInfo.call({}), error => error.message === failure.Msg && error.code === 0);
    assert.equal(notices, 0);
    assert.equal(requestOptions.suppressAuthFailure, true);
    assert.equal(requestOptions.suppressErrorNotification, true);
});

const appSource = await fs.readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
for (const success of [true, false]) {
    test(`App 后台身份初始化等待首次导航${success ? '成功' : '失败'}，不与守卫重复报错`, async () => {
        let settle;
        let reads = 0;
        const ready = new Promise((resolve, reject) => { settle = () => success ? resolve() : reject(new Error('bootstrap failed')); });
        const start = appSource.indexOf('        async PageInit() {');
        const end = appSource.indexOf('        IsAnonymousRoute() {', start);
        const action = vm.runInNewContext(`({${appSource.slice(start, end)}}).PageInit`, {
            isEmbeddedWebosWindowRuntime: () => false,
            hasCurrentUserAuthorizationSnapshot: () => true,
            window: { setInterval: () => 1 }
        });
        const work = action.call({
            $router: { isReady: () => ready }, IsAnonymousRoute: () => false,
            DiyCommon: { getToken: () => 'cached' }, diyStore: { GetCurrentUser: { Id: 'user' } },
            RefreshTokenWithLock: async () => { reads++; }, TryConnectWebSocketAfterCurrentUser: () => {}, timers: []
        });
        // 先挂拒绝处理，保证旧实现未等待 ready 时也不会制造未处理拒绝。
        ready.catch(() => {});
        await Promise.resolve();
        assert.equal(reads, 0);
        settle();
        await work;
        assert.equal(reads, success ? 1 : 0);
    });
}
