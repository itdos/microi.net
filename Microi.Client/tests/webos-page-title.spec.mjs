import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { computed, effectScope, nextTick, reactive, ref, unref, watch } from 'vue';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';

const source = fs.readFileSync(new URL('../src/views/webos/layouts/app-container.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = descriptor.scriptSetup.content.replace(/^import\s+.*?\s+from\s+['"][^'"]+['"];\r?\n/gm, '');
const titleExpression = descriptor.template.content.match(/webos-page-title">\{\{([\s\S]*?)\}\}/)[1];

// 执行真实容器 setup 和模板标题表达式，防止只补文案或只测未被页面使用的辅助函数。
function container(t, meta = { Id: 'menu-a', DiyTableId: 'table-a', title: '公告中心', icon: 'fa-solid fa-bullhorn' }, embedded = false) {
    const scope = effectScope();
    t.after(() => scope.stop());
    const route = reactive({ path: '/notice', fullPath: '/notice', meta });
    const messages = [];
    const parent = { postMessage: message => messages.push(message) };
    const window = { parent, name: 'microi-webos-window:' + 'a'.repeat(32), location: { origin: 'https://example.test' }, addEventListener() {}, removeEventListener() {} };
    const context = vm.createContext({
        computed, reactive, ref, unref, watch, onMounted() {}, onBeforeUnmount() {},
        useRoute: () => route, useRouter: () => ({ push() {}, replace: () => Promise.resolve() }),
        useDiyStore: () => ({ SysConfig: {}, getToken: () => 'test-session', GetCurrentUser: {} }),
        useWebosStore: () => ({}), isEmbeddedWindowContext: () => embedded,
        window, document: { title: '平台首页' }, V8: {},
    });
    scope.run(() => vm.runInContext(`${script}\nglobalThis.instance = { title: () => unref(${titleExpression}), menu: CurrentSysMenuModel, table: CurrentDiyTableModel, menuCallback: CallbackSysMenuModel, tableCallback: CallbackCurrentDiyTableModel, notify: notifyParentRoute };`, context));
    return { ...context.instance, route, messages };
}

test('WebOS 直链与刷新无需旧事件即可显示权限路由中的菜单标题', t => {
    assert.equal(container(t).title(), '公告中心');
    assert.equal(container(t, { title: '采购订单' }).title(), '采购订单');
});

test('当前页面的菜单与表单回调仍可补充标题，后续模型替换不残留旧属性', t => {
    const current = container(t, {});
    current.tableCallback({ Id: 'table-a', Description: '通知列表' }, '/notice');
    assert.equal(current.title(), '通知列表');
    current.menuCallback({ Id: 'menu-a', Name: '公告中心', IconClass: 'notice' }, '/notice');
    assert.equal(current.title(), '公告中心');
    current.menuCallback({ Id: 'menu-a', Name: '公告' }, '/notice');
    assert.equal(current.menu.IconClass, undefined);
});

test('切换路由清空上页模型，旧页面的迟到事件不能覆盖当前标题', async t => {
    const current = container(t);
    current.menuCallback({ Id: 'menu-a', Name: '旧公告标题' }, '/notice');
    current.route.meta = { Id: 'menu-b', DiyTableId: 'table-b', title: '客户管理' };
    current.route.path = '/customers';
    current.route.fullPath = '/customers';
    await nextTick();
    assert.equal(current.title(), '客户管理');
    current.menuCallback({ Id: 'menu-a', Name: '迟到的公告' }, '/notice');
    current.tableCallback({ Id: 'table-a', Description: '旧表单' }, '/notice');
    assert.equal(current.title(), '客户管理');
    assert.equal(current.menu.Id, undefined);
    assert.equal(current.table.Id, undefined);
});

test('同一路由查询变化和路由元数据迟到更新保持响应式', async t => {
    const current = container(t, {});
    current.tableCallback({ Description: '旧记录' }, '/notice');
    current.route.fullPath = '/notice?id=2';
    current.route.meta = { title: '第二条记录' };
    await nextTick();
    assert.equal(current.title(), '第二条记录');
    current.route.meta.title = '更新后的记录';
    assert.equal(current.title(), '更新后的记录');
});

test('嵌入窗回传与直链使用同一标题，拒绝旧路由及无效模型', async t => {
    const current = container(t, { title: '采购订单' }, true);
    current.notify();
    assert.equal(current.messages.at(-1).title, '采购订单');
    for (const value of [null, undefined, '错误文本', ['数组']]) {
        current.menuCallback(value, '/notice');
        current.tableCallback(value, '/notice');
    }
    assert.equal(Object.keys(current.menu).length, 0);
    assert.equal(Object.keys(current.table).length, 0);
    current.route.meta.title = '销售订单';
    await nextTick();
    assert.equal(current.messages.at(-1).title, '销售订单');
});

test('WebOS 手机与桌面标题共用响应式结果，容器可编译', () => {
    assert.doesNotThrow(() => compileScript(descriptor, { id: 'webos-page-title' }));
    const result = compileTemplate({ source: descriptor.template.content, filename: 'app-container.vue', id: 'webos-page-title' });
    assert.deepEqual(result.errors, []);
    assert.equal((descriptor.template.content.match(/\{\{\s*PageTitle\s*\}\}/g) || []).length, 2);
});
