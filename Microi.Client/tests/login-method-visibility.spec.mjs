import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    DEFAULT_LOGIN_METHOD_KEYS,
    LOGIN_METHOD_DISABLED_SETTINGS,
    isLoginMethodDisplayEnabled
} from "../src/utils/login-method-visibility.js";

test("five canonical login methods remain visible for missing and empty settings", function () {
    assert.deepEqual(DEFAULT_LOGIN_METHOD_KEYS, ["Passkey", "Totp", "Gitee", "WeChat", "GitHub"]);
    for (const methodKey of DEFAULT_LOGIN_METHOD_KEYS) {
        assert.equal(isLoginMethodDisplayEnabled({}, methodKey), true);
        assert.equal(isLoginMethodDisplayEnabled({ [LOGIN_METHOD_DISABLED_SETTINGS[methodKey]]: "" }, methodKey), true);
        assert.equal(isLoginMethodDisplayEnabled({ [LOGIN_METHOD_DISABLED_SETTINGS[methodKey]]: 0 }, methodKey), true);
    }
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
    const login = readFileSync(new URL("../src/views/login/index.vue", import.meta.url), "utf8");
    assert.match(login, /class="identity-login-button"[\s\S]*?@click\.stop="OpenLoginMethods"/);
    assert.match(login, /v-if="DefaultLoginMethodsHidden" class="login-methods-empty" role="status"/);
    assert.match(login, /请使用账号密码登录，或联系系统管理员开启至少一种登录方式/);
    assert.match(login, /externalDefaults\s*=\s*\[[\s\S]*?Gitee[\s\S]*?WeChat[\s\S]*?GitHub/);
});
