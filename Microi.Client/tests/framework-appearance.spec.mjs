import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveUserThemeMode } from '../src/utils/user-visual-preferences.js';
import { buildUiDensityVariables } from '../src/utils/ui-density.js';
import { APPEARANCE_RESET, applyFrameworkAppearance, clearLocalAppearance, getAppearanceWatchValues, markTextButton, normalizeHiddenFrameworkFunctions, readLocalAppearance, resolveAppearanceDensity, resolveAppearanceSwitch, saveLocalAppearance } from '../src/utils/framework-appearance.js';
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileTemplate } from '../node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js';

test('跟随系统的主题值必须采用全局深色模式', () => {
    assert.equal(resolveUserThemeMode({ Id: 'u1', ThemeMode: 'System' }, 'light', 'dark'), 'dark');
});

test('个人空值继承全局，显式关闭可覆盖全局开启，旧租户只读取自身设备选择', () => {
    const system = { DisableGradient: 1, UiDensityScale: 110 };
    const inherited = { Id: 'u1', DisableGradient: null, UiDensityScale: null };
    assert.equal(resolveAppearanceSwitch(inherited, system, 'DisableGradient', { DisableGradient: 0 }), true);
    assert.equal(resolveAppearanceSwitch({ ...inherited, DisableGradient: 0 }, system, 'DisableGradient'), false);
    assert.equal(resolveAppearanceSwitch({ Id: 'u1' }, system, 'DisableGradient', { DisableGradient: 0 }), false);
    assert.equal(resolveAppearanceDensity(inherited, system, { UiDensityScale: 90 }), 110);
    assert.equal(resolveAppearanceDensity({ ...inherited, UiDensityScale: 90 }, system), 90);
    assert.equal(resolveAppearanceDensity({}, {}, {}), 100);
    assert.equal(resolveAppearanceDensity({ UiDensityScale: 'invalid' }, system), 110);
});

test('隐藏框架功能只接受固定枚举并兼容 Checkbox 的 JSON、数组与逗号值', () => {
    assert.deepEqual(normalizeHiddenFrameworkFunctions('["Chat","Theme","Avatar","AI","AI"]'), ['Chat', 'Theme', 'AI']);
    assert.deepEqual(normalizeHiddenFrameworkFunctions('Search,FullScreen'), ['Search', 'FullScreen']);
    assert.deepEqual(normalizeHiddenFrameworkFunctions([{ Key: 'Bluetooth' }, 'Language']), ['Bluetooth', 'Language']);
    assert.deepEqual(normalizeHiddenFrameworkFunctions({ Chat: true }), []);
});

test('文字slot按钮标记与纯图标按钮分开，文案变更可撤销标记', () => {
    const attributes = new Map();
    const button = { textContent: ' 保存 ', setAttribute: (key,value) => attributes.set(key,value), removeAttribute: key => attributes.delete(key) };
    markTextButton(button);
    assert.equal(attributes.get('data-mci-text-button'), 'true');
    button.textContent = '  ';
    markTextButton(button);
    assert.equal(attributes.has('data-mci-text-button'), false);
});

test('主题监听只采集外观标量，不遍历权限树或密钥配置', () => {
    const user = { Id: 'u1', UiDensityScale: 110, get _RoleLimits() { throw new Error('不应读取权限树'); } };
    const system = { DisableShadow: 1, get ServerPrivateSettings() { throw new Error('不应读取私密配置'); } };
    const values = getAppearanceWatchValues({ GetCurrentUser: user, SysConfig: system });
    assert.ok(values.includes(110)); assert.ok(values.includes(1));
    assert.ok(values.every(value => value == null || typeof value !== 'object'));
});

function appearanceFixture() {
    const memory = new Map(), properties = new Map(), attributes = new Map();
    globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) };
    globalThis.document = { documentElement: { style: { setProperty: (key, value) => properties.set(key, value) }, dataset: {}, classList: { add() {}, remove() {} }, getAttribute: key => attributes.get(key) || null, setAttribute: (key, value) => attributes.set(key, value) } };
    globalThis.getComputedStyle = () => ({ getPropertyValue: key => properties.get(key) || '' });
    const store = { ApiBase: 'https://fixture.example', OsClient: 'tenant-a', GetCurrentUser: { Id: 'u1' }, SysConfig: {}, setThemeColor(value) { this.themeColor = value; } };
    return { store, memory, properties, attributes };
}

test('租户或帐号切换不会读取另一身份的本地偏好，恢复默认同时清旧版设备值', () => {
    const { store, memory } = appearanceFixture();
    saveLocalAppearance(store, { DisableShadow: 1, UiDensityScale: 90 });
    assert.equal(readLocalAppearance(store).UiDensityScale, 90);
    store.GetCurrentUser = { Id: 'u2' };
    assert.deepEqual(readLocalAppearance(store), {});
    store.GetCurrentUser = { Id: 'u1' }; store.OsClient = 'tenant-b';
    assert.deepEqual(readLocalAppearance(store), {});
    store.OsClient = 'tenant-a';
    for (const key of ['mci-theme', 'mci:corner-style', 'microi_ui_density_scale']) memory.set(key, 'legacy');
    clearLocalAppearance(store);
    assert.equal(memory.size, 0);
    assert.equal(store.themeColor, '');
    assert.equal(APPEARANCE_RESET.DisableGradient, null);
    assert.equal(APPEARANCE_RESET.UiDensityScale, null);
    assert.equal(APPEARANCE_RESET.LoginStyle, 'System');
});

test('继承全局只渲染且不固化个人值，下一次全局变更立即生效', () => {
    const { store, memory, properties, attributes } = appearanceFixture();
    store.GetCurrentUser = { Id: 'u1', ThemeMode: '', ThemeColor: '', CornerStyle: 'System', DisableGradient: null, DisableShadow: null, DisableButtonIcon: null, UiDensityScale: null, LoginStyle: 'System' };
    store.SysConfig = { ThemeMode: 'dark', ThemeColor: '#16a34a', CornerStyle: 'square', DisableGradient: 1, DisableShadow: 1, DisableButtonIcon: 1, UiDensityScale: 110, LoginStyle: 'Split' };
    memory.set('mci-theme', 'light');
    applyFrameworkAppearance(store);
    assert.equal(attributes.get('data-theme'), 'dark');
    assert.equal(attributes.get('data-mci-disable-gradient'), 'true');
    assert.equal(properties.get('--mci-ui-scale'), '1.1');
    assert.equal(store.loginStyle, 'Split');
    assert.equal(memory.size, 1, '全局默认不能写成个人手选');
    assert.equal(memory.get('mci-theme'), 'light');
    store.SysConfig = { ThemeMode: 'light', UiDensityScale: 90, DisableShadow: 0 };
    applyFrameworkAppearance(store);
    assert.equal(attributes.get('data-theme'), 'light');
    assert.equal(attributes.get('data-mci-disable-shadow'), 'false');
    assert.equal(properties.get('--mci-ui-scale'), '0.9');
    assert.equal(store.loginStyle, 'Original');
});

test('主题与顶栏 SFC 可编译，隐藏组保留独立账号入口', () => {
    for (const file of ['ThemeSelect.vue', 'UiDensitySelect.vue', 'Navbar.vue']) {
        const filename = new URL(`../src/layout/components/${file}`, import.meta.url);
        const source = readFileSync(filename, 'utf8');
        const { descriptor, errors } = parse(source, { filename: file });
        assert.deepEqual(errors, []);
        const result = compileTemplate({ source: descriptor.template.content, filename: file, id: `fixture-${file}` });
        assert.deepEqual(result.errors, []);
        assert.ok(compileScript(descriptor, { id: `fixture-${file}` }).content);
        if (file === 'Navbar.vue') {
            for (const key of ['Chat', 'BackgroundTasks', 'Search', 'Language', 'Theme', 'AI', 'Bluetooth', 'SystemStyle', 'FullScreen']) assert.ok(source.includes(`data-framework-function="${key}"`));
            assert.doesNotMatch(source, /avatar-container[^>]*v-if/);
        }
    }
});

test('全框架密度提供表单、菜单、标签和弹窗的尺寸令牌', () => {
    const compact = buildUiDensityVariables(90), large = buildUiDensityVariables(110);
    for (const name of ['--mci-ui-form-gap', '--mci-ui-menu-height', '--mci-ui-tab-height', '--mci-ui-dialog-padding']) {
        assert.ok(parseFloat(large[name]) > parseFloat(compact[name]), `${name} 应随密度同步变化`);
    }
});
