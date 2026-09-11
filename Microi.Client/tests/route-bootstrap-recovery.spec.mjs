import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { createMemoryHistory, createRouter } from 'vue-router';
import * as navigationState from '../src/router/navigation-state.js';

const source = await fs.readFile(new URL('../src/permission.js', import.meta.url), 'utf8');
const routePath = '/api-engine?RecordId=existing-record';
const withoutImports = value => value.replace(/^import[\s\S]*?;\s*/gm, '').replace(/^export /gm, '');

// 执行实际权限守卫和 Vue Router；断言首个导航结果，避免只检查源码里是否出现重试字样。
function createHarness({ identityFailure, menuFailure, bootstrap = true, token: initialToken = 'session' } = {}) {
    let token = initialToken;
    const calls = { identity: 0, menu: 0, reset: 0 };
    const route = { path: '/api-engine', component: {} };
    const router = createRouter({ history: createMemoryHistory(), routes: [route, { path: '/login', component: {} }] });
    const user = {
        roles: [],
        async getInfo() {
            calls.identity++;
            const failure = identityFailure?.(calls.identity);
            if (failure) throw failure;
            this.roles = ['admin'];
        },
        async resetToken() { calls.reset++; token = ''; this.roles = []; }
    };
    const permission = {
        addRoutes: [],
        async generateRoutes() {
            calls.menu++;
            const failure = menuFailure?.(calls.menu);
            if (failure) throw failure;
            this.addRoutes = [route];
            return this.addRoutes;
        }
    };
    const location = { href: `http://localhost:61500/?OsClient=iTdos#${routePath}` };
    const sandbox = {
        ...navigationState, router, location,
        window: { location }, document: { querySelector: () => null },
        sessionStorage: { removeItem() {} },
        useUserStore: () => user, usePermissionStore: () => permission,
        useDiyStore: () => ({ GetCurrentUser: {}, setState() {}, setCurrentUser() {} }), pinia: {},
        DiyCommon: { GetOsClient: () => 'iTdos', getToken: () => token }, DiyApi: {},
        normalizeAccessRoute: value => value, normalizeMenuRoutePath: value => value,
        getFirstValidRoutePath: () => '', hasAccessibleRoutePath: () => true,
        getLegacySsoCapabilities: async () => [], readLegacySsoCredential: () => '',
        waitForPlatformBootstrap: async () => bootstrap,
        startRouteLoading() {}, cancelRouteLoading() {}, finishRouteLoading() {},
        console: { error() {}, warn() {} }
    };
    vm.runInNewContext(withoutImports(source), sandbox);
    router.onError(() => {});
    return { router, calls, user, getToken: () => token };
}

async function openRoute(harness) {
    const ready = harness.router.isReady();
    const navigation = harness.router.push(routePath);
    return Promise.all([ready, navigation]);
}

test('短暂身份读取失败自动恢复原 RecordId，成功验证身份后才加载菜单', async () => {
    const h = createHarness({ identityFailure: attempt => attempt === 1 && new Error('temporary identity read failure') });
    await openRoute(h);
    assert.equal(h.router.currentRoute.value.fullPath, routePath);
    assert.equal(h.calls.identity, 2);
    assert.equal(h.calls.menu, 1);
    assert.equal(h.calls.reset, 0);
});

test('短暂菜单读取失败保留登录态并重新匹配目标路由', async () => {
    const h = createHarness({ menuFailure: attempt => attempt < 3 && new Error('temporary menu read failure') });
    await openRoute(h);
    assert.equal(h.router.currentRoute.value.fullPath, routePath);
    assert.equal(h.calls.menu, 3);
    assert.equal(h.calls.reset, 0);
});

test('持续身份错误最多读取三次，首屏保留真实原因和阶段，禁止放行权限', async () => {
    const h = createHarness({ identityFailure: () => Object.assign(new Error('权限快照不可用'), { code: 0 }) });
    await assert.rejects(openRoute(h), error => {
        assert.match(error.message, /权限快照不可用/);
        assert.doesNotMatch(error.message, /Navigation aborted/);
        assert.equal(error.bootstrapStage, 'identity');
        return true;
    });
    assert.equal(h.calls.identity, 3);
    assert.equal(h.calls.menu, 0);
    assert.equal(h.calls.reset, 0);
    assert.equal(h.user.roles.length, 0);
});

test('菜单依赖自带重试耗尽后不再叠加重试，保留配置错误', async () => {
    const h = createHarness({ menuFailure: () => Object.assign(new Error('平台菜单资源尚未就绪'), { reasonCode: 'PLATFORM_SYS_MENU_NOT_READY' }) });
    await assert.rejects(openRoute(h), error => error.bootstrapStage === 'menu' && /菜单资源/.test(error.message));
    assert.equal(h.calls.menu, 1);
    assert.equal(h.calls.reset, 0);
});

for (const code of [1001, 1002]) {
    test(`认证错误 ${code} 不重试，回登录页并保留深链接`, async () => {
        const h = createHarness({ identityFailure: () => Object.assign(new Error('登录身份已失效'), { code }) });
        await openRoute(h);
        assert.equal(h.calls.identity, 1);
        assert.equal(h.calls.menu, 0);
        assert.equal(h.calls.reset, 1);
        assert.equal(h.router.currentRoute.value.path, '/login');
        assert.equal(h.router.currentRoute.value.query.redirect, routePath);
    });
}

test('HTTP 权限拒绝不重试、不清空会话、不放行受保护页面', async () => {
    const h = createHarness({ identityFailure: () => Object.assign(new Error('权限不足'), { response: { status: 403 } }) });
    await assert.rejects(openRoute(h), /权限不足/);
    assert.equal(h.calls.identity, 1);
    assert.equal(h.calls.menu, 0);
    assert.equal(h.calls.reset, 0);
});

test('HTTP 401 保留原地址返回登录页，不能误报路由启动失败', async () => {
    const h = createHarness({ identityFailure: () => Object.assign(new Error('Unauthorized'), { response: { status: 401 } }) });
    await openRoute(h);
    assert.equal(h.calls.identity, 1);
    assert.equal(h.calls.reset, 1);
    assert.equal(h.router.currentRoute.value.query.redirect, routePath);
});

test('重试等待期间退出登录时，不再发送身份或菜单请求', async () => {
    let calls = 0;
    let retryChecks = 0;
    const failure = new Error('temporary failure before logout');
    await assert.rejects(navigationState.readRouteBootstrap(async () => {
        calls++;
        throw failure;
    }, () => ++retryChecks === 1), error => error === failure);
    assert.equal(calls, 1);
});

test('匿名冷启动正常到登录页，健康会话只读取一次', async () => {
    const anonymous = createHarness({ token: '' });
    await openRoute(anonymous);
    assert.equal(anonymous.calls.identity, 0);
    assert.equal(anonymous.router.currentRoute.value.path, '/login');
    const healthy = createHarness();
    await openRoute(healthy);
    assert.equal(healthy.calls.identity, 1);
    assert.equal(healthy.calls.menu, 1);
});

test('当前用户请求的传输失败必须结束 getInfo Promise，允许守卫恢复或显示错误', async () => {
    const userSource = await fs.readFile(new URL('../src/pinia/modules/user.js', import.meta.url), 'utf8');
    const transportError = new Error('Network Error');
    const sandbox = {
        defineStore: (_, options) => options,
        DiyApi: { GetCurrentUser: () => '/apiengine/platform-current-user' },
        DiyCommon: { PostAsync: async () => { throw transportError; } }
    };
    const options = vm.runInNewContext(`${withoutImports(userSource)}\nuseUserStore;`, sandbox);
    const outcome = await Promise.race([
        options.actions.getInfo.call({}).then(() => 'resolved', error => error),
        new Promise(resolve => setTimeout(() => resolve('pending'), 100))
    ]);
    assert.equal(outcome, transportError);
});
