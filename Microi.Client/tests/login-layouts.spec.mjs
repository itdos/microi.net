import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { compile, computed, createSSRApp, h, reactive, toRefs } from "vue";
import { renderToString } from "@vue/server-renderer";
import { compileStyleAsync, parse } from "@vue/compiler-sfc";
import { createI18n } from "vue-i18n";
import { platformUiMessages } from "../src/lang/platform-ui.js";
import { LOGIN_STYLES, resolveLoginStyle } from "../src/views/login/login-style.js";

const root = new URL("../src/views/login/", import.meta.url);
const businessSource = readFileSync(new URL("login-business.mixin.js", root), "utf8");

test('新增外观设置及登录文案在三种兜底语言中实际渲染', async () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
        const i18n = createI18n({ legacy: false, locale, messages: platformUiMessages });
        const words = platformUiMessages[locale].Msg.FrameworkAppearance;
        for (const key of Object.keys(platformUiMessages['zh-CN'].Msg.FrameworkAppearance)) {
            assert.equal(typeof words[key], 'string', `${locale}:${key}`);
            assert.notEqual(i18n.global.t(`Msg.FrameworkAppearance.${key}`), `Msg.FrameworkAppearance.${key}`);
        }
        for (const style of ['Split', 'Console']) {
            const { descriptor } = parse(readFileSync(new URL(`layouts/${style}LoginLayout.vue`, root), 'utf8'));
            const layout = { props: { title: String, subtitle: String }, render: compile(descriptor.template.content) };
            const app = createSSRApp({ render: () => h(layout, { title: 'Microi' }) });
            app.use(i18n);
            const html = await renderToString(app);
            assert.ok(html.includes(words[style === 'Split' ? 'splitTagline' : 'consoleTitleFirst']));
            if (locale === 'en') assert.doesNotMatch(html, /让想法落地|专注当下|连接下一步|工作台|协作/);
        }
    }
});

function loadBusiness(extra = {}) {
    const stores = {
        diy: reactive({ CurrentTime: new Date(), DesktopBg: {}, OsClient: "tenant", WebTitle: "工作台", SysConfig: {}, SystemStyle: "Classic", GetCurrentUser: {} }),
        settings: reactive({ title: "工作台" }), user: {}, permission: {}
    };
    const source = businessSource.replace(/^import\s[\s\S]*?;\s*/gm, "")
        .replace("export function setupLoginState", "function setupLoginState")
        .replace("export default", "const loginBusinessMixin =");
    const result = vm.runInNewContext(source + "\n({ loginBusinessMixin, setupLoginState });", {
        config: {}, window: {}, computed, storeToRefs: toRefs,
        useDiyStore: () => stores.diy, useSettingsStore: () => stores.settings,
        useUserStore: () => stores.user, usePermissionStore: () => stores.permission,
        useRouter: () => ({ name: "router" }), useRoute: () => ({ name: "route" }),
        DiyCommon: {}, DiyApi: {}, isPasskeySupported: () => false,
        ...extra
    });
    return { ...result, stores };
}

test("登录模板显式个人值继承全局，空值、System 和未知配置兼容原界面", () => {
    assert.deepEqual(LOGIN_STYLES, ["Original", "Minimal", "Split", "Console"]);
    for (const style of LOGIN_STYLES) {
        assert.equal(resolveLoginStyle(undefined, style), style);
        assert.equal(resolveLoginStyle(style.toLowerCase(), "Split"), style);
    }
    assert.equal(resolveLoginStyle("System", "Minimal"), "Minimal");
    assert.equal(resolveLoginStyle("", "Console"), "Console");
    assert.equal(resolveLoginStyle(null, null), "Original");
    assert.equal(resolveLoginStyle("<script>", "Console"), "Original");
    assert.equal(resolveLoginStyle(undefined, "uninstalled-template"), "Original");
});

test("根登录显式执行共享 setup，Pinia 引用随当前租户及配置响应变化", async () => {
    const { setupLoginState, stores } = loadBusiness();
    const source = readFileSync(new URL("index.vue", root), "utf8");
    assert.match(source, /mixins:\s*\[loginBusinessMixin\]/);
    assert.match(source, /setup:\s*setupLoginState/);
    const state = setupLoginState();
    assert.equal(state.OsClient.value, "tenant");
    stores.diy.OsClient = "tenant-two";
    stores.diy.SysConfig = { LoginStyle: "Minimal" };
    assert.equal(state.OsClient.value, "tenant-two");
    assert.equal(state.SysConfig.value.LoginStyle, "Minimal");
    stores.diy.GetCurrentUser = { Account: "current" };
    assert.equal(state.GetCurrentUser.value.Account, "current");
    assert.equal(state.SystemStyle.value, "Classic");
});

test("四个视觉模板只呈现同一表单 slot，不复制认证、注册或租户业务", async () => {
    for (const style of LOGIN_STYLES) {
        const source = readFileSync(new URL(`layouts/${style}LoginLayout.vue`, root), "utf8");
        const { descriptor, errors } = parse(source);
        assert.deepEqual(errors, []);
        assert.doesNotMatch(source, /DiyCommon|DiyApi|PostAsync|localStorage|LoginWith|Token|v-model=/);
        const layout = { props: { title: String, subtitle: String }, render: compile(descriptor.template.content) };
        const app = createSSRApp({ render: () => h(layout, { title: "租户工作台" }, {
            default: () => h("form", { "data-shared-login": "yes" }, [h("input", { name: "account" }), h("button", "登录")])
        }) });
        app.use(createI18n({ legacy: false, locale: 'zh-CN', messages: platformUiMessages }));
        const html = await renderToString(app);
        assert.equal((html.match(/data-shared-login="yes"/g) || []).length, 1);
        assert.equal((html.match(/name="account"/g) || []).length, 1);
        assert.match(html, /登录/);
        for (const block of descriptor.styles) {
            const result = await compileStyleAsync({ source: block.content, filename: `${style}LoginLayout.vue`, id: "data-v-login", scoped: true });
            assert.deepEqual(result.errors, []);
        }
    }
    const index = parse(readFileSync(new URL("index.vue", root), "utf8")).descriptor;
    assert.doesNotThrow(() => compile(index.template.content));
    const stylesheet = await compileStyleAsync({
        source: readFileSync(new URL("login-layouts.scss", root), "utf8"),
        filename: new URL("login-layouts.scss", root).pathname,
        id: "data-v-login", scoped: true, preprocessLang: "scss"
    });
    assert.deepEqual(stylesheet.errors, []);
    const appearance = await compileStyleAsync({
        source: readFileSync(new URL("login-appearance.scss", root), "utf8"),
        filename: new URL("login-appearance.scss", root).pathname,
        id: "data-v-login", scoped: false, preprocessLang: "scss"
    });
    assert.deepEqual(appearance.errors, []);
    // scoped :global 祖先会丢弃后代，不能把隐藏图标错误编译成隐藏整个 html。
    assert.match(appearance.code, /html\[data-mci-disable-button-icon="?true"?\] #divLogin \.login-button-content/);
    assert.doesNotMatch(appearance.code, /html\[[^\]]+\]\s*\{[^}]*display:\s*none/);
});

test("共享登录保留验证码组合、错误刷新、重复提交保护与隐私阻止", async () => {
    const { loginBusinessMixin: mixin } = loadBusiness();
    for (const enabled of [1, true, "1", "true", false, "0"]) {
        let sent, refreshed = 0, encrypted = 0;
        const model = {
            Account: "account", Pwd: "password", SysConfig: { EnableCaptcha: enabled },
            OsClient: "tenant", CaptchaId: "captcha", CaptchaValue: "4", LoginWaiting: false,
            DiyApi: { Login: () => "/api/SysUser/login" },
            DiyCommon: { IsNull: value => !value, Result: () => false, Tips: () => {}, Post: (_url, body, callback) => { sent = body; callback({ Code: 0 }); } },
            diyStore: { IsPhoneView: false },
            encryptPassword: () => { encrypted++; return "rsa-password"; }, GetCaptcha: () => { refreshed++; },
            isEnabledFlag: mixin.methods.isEnabledFlag
        };
        Object.defineProperty(model, "EnableCaptcha", { get: () => mixin.computed.EnableCaptcha.call(model) });
        await mixin.methods.Login.call(model);
        assert.equal(sent.Pwd, "rsa-password");
        assert.equal(sent.OsClient, "tenant");
        assert.equal(sent._ClientType, "PC");
        assert.equal(Object.hasOwn(sent, "_CaptchaId"), model.EnableCaptcha);
        assert.equal(refreshed, model.EnableCaptcha ? 1 : 0);
        assert.equal(model.LoginWaiting, false);
        assert.equal(model.LoginStage, "idle");
        model.LoginWaiting = true;
        await mixin.methods.Login.call(model);
        assert.equal(encrypted, 1);
        model.LoginWaiting = false;
        model.SysConfig.EnablePrivacyPolicy = 1;
        model.CheckPrivacyPolicy = false;
        await mixin.methods.Login.call(model);
        assert.equal(encrypted, 1);
    }
});

test("共享免密登录保留同一策略与认证后导航，不因模板切换创建旁路", async () => {
    let requests = 0, completed;
    const result = { Code: 1, Data: { Account: "account" } };
    const { loginBusinessMixin: mixin } = loadBusiness({ verifyWithPasskey: async () => { requests++; return result; } });
    const model = {
        OsClient: "tenant", IdentityLoginWaiting: "", SysConfig: { EnablePrivacyPolicy: 1 }, CheckPrivacyPolicy: false,
        DiyCommon: { Tips: () => {} }, diyStore: { IsPhoneView: true },
        ValidateIdentityLoginPolicy: mixin.methods.ValidateIdentityLoginPolicy,
        CompleteIdentityLogin: async value => { completed = value; }
    };
    await mixin.methods.LoginWithPasskey.call(model);
    assert.equal(requests, 0);
    model.CheckPrivacyPolicy = true;
    await mixin.methods.LoginWithPasskey.call(model);
    assert.equal(requests, 1);
    assert.equal(completed, result);
    assert.equal(model.IdentityLoginWaiting, "");
    const calls = [];
    const methodsModel = { CloseLoginMethods: () => calls.push("close"), LoginWithPasskey: () => calls.push("passkey"), OpenTotpLogin: () => calls.push("totp"), LoginWithFace: () => calls.push("face"), LoginWithExternal: key => calls.push(key), LoginWithFederated: key => calls.push(key) };
    for (const method of [{ key: "Passkey" }, { key: "Totp" }, { key: "Face" }, { provider: "Microi" }, { federated: true, connectionKey: "enterprise" }]) {
        mixin.methods.StartLoginMethod.call(methodsModel, { ...method, available: true });
    }
    assert.deepEqual(calls, ["close", "passkey", "close", "totp", "close", "face", "close", "Microi", "close", "enterprise"]);
    mixin.methods.StartLoginMethod.call(methodsModel, { key: "Passkey", available: false });
    assert.equal(calls.length, 10);
});
