import { readLoginSourceSync } from "./helpers/login-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    DEFAULT_LOGIN_METHOD_KEYS,
    LOGIN_METHOD_DISABLED_SETTINGS,
    isLoginMethodDisplayEnabled
} from "../src/utils/login-method-visibility.js";

test("six canonical login methods remain visible for missing and empty settings", function () {
    assert.deepEqual(DEFAULT_LOGIN_METHOD_KEYS, ["Passkey", "Totp", "Microi", "Gitee", "WeChat", "GitHub"]);
    for (const methodKey of DEFAULT_LOGIN_METHOD_KEYS) {
        assert.equal(isLoginMethodDisplayEnabled({}, methodKey), true);
        assert.equal(isLoginMethodDisplayEnabled({ [LOGIN_METHOD_DISABLED_SETTINGS[methodKey]]: "" }, methodKey), true);
        assert.equal(isLoginMethodDisplayEnabled({ [LOGIN_METHOD_DISABLED_SETTINGS[methodKey]]: 0 }, methodKey), true);
    }
});

test("Microi 登录使用独立关闭开关并保持旧显示配置兼容", function () {
    assert.equal(LOGIN_METHOD_DISABLED_SETTINGS.Microi, "DisableLoginMicroi");
    for (const value of [1, "1", true, "true"]) {
        assert.equal(isLoginMethodDisplayEnabled({ DisableLoginMicroi: value }, "Microi"), false);
    }
    assert.equal(isLoginMethodDisplayEnabled({ DisableLoginGitee: 1 }, "Microi"), true);
    assert.equal(isLoginMethodDisplayEnabled({ DisableLoginMicroi: 1 }, "Gitee"), true);
    assert.equal(isLoginMethodDisplayEnabled({ LoginMicroiDisplay: 0 }, "Microi"), false);
    assert.equal(isLoginMethodDisplayEnabled({ "Login.Microi.Display": "false" }, "Microi"), false);
    assert.equal(isLoginMethodDisplayEnabled({ DisableLoginMicroi: 0, LoginMicroiDisplay: 0 }, "Microi"), true);
});

test("Microi 登录复用外部登录入口并使用独立品牌标记", function () {
    const login = readLoginSourceSync();
    assert.match(login, /key: "Microi", name: "Microi 登录"[\s\S]*?glyph: "M", tone: "microi"/);
    assert.match(login, /\.login-method-bubble\.is-microi\s*\{/);
    assert.doesNotMatch(login, /五种常用登录方式/);
});

test("only an explicitly enabled close switch hides a login method", function () {
    const settingKey = LOGIN_METHOD_DISABLED_SETTINGS.GitHub;
    assert.equal(isLoginMethodDisplayEnabled({ [settingKey]: 1 }, "GitHub"), false);
    assert.equal(isLoginMethodDisplayEnabled({ [settingKey]: "1" }, "GitHub"), false);
    assert.equal(isLoginMethodDisplayEnabled({ [settingKey]: true }, "GitHub"), false);
    assert.equal(isLoginMethodDisplayEnabled({ [settingKey]: "true" }, "GitHub"), false);
    assert.equal(isLoginMethodDisplayEnabled({ [settingKey]: null }, "GitHub"), true);
    assert.equal(isLoginMethodDisplayEnabled({ PublicSettings: { [settingKey]: 1 } }, "GitHub"), true);
});

test("new close switch wins and legacy positive display fields remain compatible", function () {
    assert.equal(isLoginMethodDisplayEnabled({ LoginGitHubDisplay: 0 }, "GitHub"), false);
    assert.equal(isLoginMethodDisplayEnabled({ LoginGitHubDisplay: 1 }, "GitHub"), true);
    assert.equal(isLoginMethodDisplayEnabled({ "Login.GitHub.Display": "false" }, "GitHub"), false);
    assert.equal(isLoginMethodDisplayEnabled({ DisableLoginGitHub: 0, LoginGitHubDisplay: 0 }, "GitHub"), true);
    assert.equal(isLoginMethodDisplayEnabled({ DisableLoginGitHub: 1, LoginGitHubDisplay: 1 }, "GitHub"), false);
});

test("login page keeps the entry button and renders an explicit all-hidden state", function () {
    const login = readLoginSourceSync();
    assert.match(login, /class="identity-login-button"[\s\S]*?@click\.stop="OpenLoginMethods"/);
    assert.match(login, /v-if="DefaultLoginMethodsHidden" class="login-methods-empty" role="status"/);
    assert.match(login, /请使用账号密码登录，或联系系统管理员开启至少一种登录方式/);
    assert.match(login, /externalDefaults\s*=\s*\[[\s\S]*?Gitee[\s\S]*?WeChat[\s\S]*?GitHub/);
});

test("successful password login keeps a truthful loading label until navigation completes", function () {
    const login = readLoginSourceSync();
    assert.match(login, /<span>\{\{ LoginButtonText \}\}<\/span>/);
    assert.match(login, /LoginStage:\s*"idle"/);
    assert.match(login, /LoginStage === "routes"[\s\S]*?正在加载工作台/);
    assert.match(login, /LoginStage === "entering"[\s\S]*?正在进入系统/);
    assert.match(login, /self\.LoginStage = "routes"[\s\S]*?await self\.GotoSystem\(\)/);
    assert.match(login, /self\.LoginStage = "entering"[\s\S]*?await self\.\$router\.push/);
});
