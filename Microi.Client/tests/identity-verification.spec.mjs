import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { platformServiceSourcePath } from "./helpers/platform-service-source.mjs";
import {
    IdentityVerification,
    createPasswordChangeActionHash,
    getIdentityCapabilities,
    isPasskeySupported,
    runExternalLogin,
    sha256Hex,
    translateTotpFailure,
    translateWebAuthnError
} from "../src/utils/identity-verification.js";

function bytes(...values) {
    return Uint8Array.from(values).buffer;
}

test("密码修改 ActionHash 与后端规范保持一致并绑定用户和新密码", async () => {
    const input = "Microi:ChangePassword:v1:user-a:encoded-password";
    const expected = createHash("sha256").update(input, "utf8").digest("hex");

    assert.equal(await createPasswordChangeActionHash("user-a", "encoded-password"), expected);
    assert.equal(await sha256Hex(input), expected);
    assert.notEqual(
        await createPasswordChangeActionHash("user-b", "encoded-password"),
        expected
    );
});
test("WebAuthn PublicKey 只转换规范的二进制字段", () => {
    const prepared = IdentityVerification.preparePublicKey({
        challenge: "AQID",
        user: { id: "BAUG", name: "admin" },
        allowCredentials: [{ type: "public-key", id: "BwgJ" }],
        excludeCredentials: [{ type: "public-key", id: "CgsM" }],
        timeout: 300000
    });

    assert.deepEqual([...new Uint8Array(prepared.challenge)], [1, 2, 3]);
    assert.deepEqual([...new Uint8Array(prepared.user.id)], [4, 5, 6]);
    assert.deepEqual([...new Uint8Array(prepared.allowCredentials[0].id)], [7, 8, 9]);
    assert.deepEqual([...new Uint8Array(prepared.excludeCredentials[0].id)], [10, 11, 12]);
    assert.equal(prepared.user.name, "admin");
    assert.equal(prepared.timeout, 300000);
});

test("WebAuthn 凭据序列化不包含浏览器对象和生物数据", () => {
    const serialized = IdentityVerification.serializeCredential({
        id: "credential-id",
        rawId: bytes(1, 2, 3),
        type: "public-key",
        authenticatorAttachment: "platform",
        getClientExtensionResults: () => ({ credProps: { rk: true } }),
        response: {
            clientDataJSON: bytes(4, 5),
            authenticatorData: bytes(6, 7),
            signature: bytes(8, 9),
            userHandle: bytes(10, 11),
            getTransports: () => ["internal"]
        }
    });

    assert.equal(serialized.rawId, "AQID");
    assert.equal(serialized.response.clientDataJSON, "BAU");
    assert.equal(serialized.response.signature, "CAk");
    assert.deepEqual(serialized.response.transports, ["internal"]);
    assert.equal("faceImage" in serialized, false);
    assert.equal("biometric" in serialized, false);
});

test("能力读取固定调用当前租户的 IdentityVerification API", async () => {
    const calls = [];
    const diyCommon = {
        PostAsync: async (...args) => {
            calls.push(args);
            return { Code: 1, Data: { Enabled: true, SessionSystem: "DiyToken" } };
        }
    };

    const result = await getIdentityCapabilities(diyCommon, "iTdos");
    assert.equal(result.SessionSystem, "DiyToken");
    assert.equal(calls[0][0], "/api/IdentityVerification/GetCapabilities");
    assert.deepEqual(calls[0][1], { OsClient: "iTdos" });
    assert.equal(calls[0][4], "json");
});

test("Passkey 只在安全上下文且浏览器认证器可用时启用", () => {
    const oldWindow = globalThis.window;
    const oldNavigator = globalThis.navigator;
    try {
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: { isSecureContext: true, PublicKeyCredential: class PublicKeyCredential {} }
        });
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: { credentials: { get() {} } }
        });
        assert.equal(isPasskeySupported(), true);
        globalThis.window.isSecureContext = false;
        assert.equal(isPasskeySupported(), false);
    } finally {
        Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
        Object.defineProperty(globalThis, "navigator", { configurable: true, value: oldNavigator });
    }
});

test("WebAuthn RP ID 不匹配时返回详细中文配置方案", () => {
    const oldWindow = globalThis.window;
    try {
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {
                location: {
                    origin: "https://os.jifulii.com",
                    hostname: "os.jifulii.com"
                }
            }
        });
        const error = new DOMException(
            "The relying party ID is not a registrable domain suffix of, nor equal to the current domain. Subsequently, an attempt to fetch the .well-known/webauthn resource of the claimed RP ID failed.",
            "SecurityError"
        );
        const translated = translateWebAuthnError(error, { rpId: "api.itdos.com" });

        assert.match(translated.message, /Passkey 域名配置与当前站点不匹配/);
        assert.match(translated.message, /os\.jifulii\.com/);
        assert.match(translated.message, /api\.itdos\.com/);
        assert.match(translated.message, /系统设置 → 登录与身份/);
        assert.match(translated.message, /PasskeyOrigins/);
        assert.match(translated.message, /\.well-known\/webauthn/);
        assert.doesNotMatch(translated.message, /registrable domain suffix/);
    } finally {
        Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
    }
});

test("旧后端 TOTP 认证标签异常不会再向用户暴露英文底层错误", () => {
    const translated = translateTotpFailure({
        Code: 0,
        Msg: "Authenticator 验证失败：The computed authentication tag did not match the input authentication tag."
    });

    assert.match(translated.Msg, /Authenticator 密钥无法解密/);
    assert.match(translated.Msg, /个人中心 → 验证器/);
    assert.match(translated.Msg, /sys_osclients\.AuthSecret/);
    assert.doesNotMatch(translated.Msg, /computed authentication tag/i);
});

test("外部登录通过弹窗回传一次性票据并最终换取 DiyToken 登录结果", async () => {
    const oldWindow = globalThis.window;
    const oldScreen = globalThis.screen;
    const oldNavigator = globalThis.navigator;
    const listeners = new Map();
    const popup = {
        closed: false,
        document: { title: "" },
        location: { replace() {} },
        resizeTo() {},
        close() { this.closed = true; }
    };
    const calls = [];
    try {
        Object.defineProperty(globalThis, "screen", { configurable: true, value: { width: 1440, height: 900 } });
        Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {
                location: { origin: "https://os.example.com", href: "https://os.example.com/#/login" },
                screenX: 0,
                screenY: 0,
                outerWidth: 1440,
                outerHeight: 900,
                open: () => popup,
                addEventListener: (name, handler) => listeners.set(name, handler),
                removeEventListener: (name, handler) => {
                    if (listeners.get(name) === handler) listeners.delete(name);
                }
            }
        });
        const diyCommon = {
            GetDid: () => "did-1",
            PostAsync: async (url, payload) => {
                calls.push({ url, payload });
                if (url.endsWith("/Begin")) {
                    setTimeout(() => listeners.get("message")?.({
                        source: popup,
                        origin: "https://api.example.com",
                        data: { type: "microi-external-login", provider: "Gitee", success: true, ticket: "opaque-ticket" }
                    }), 0);
                    return { Code: 1, Data: {
                        AuthorizeUrl: "https://gitee.com/oauth/authorize?state=opaque",
                        CallbackUrl: "https://api.example.com/api/ExternalLogin/Callback",
                        Popup: { Width: 720, Height: 760 }
                    } };
                }
                return { Code: 1, Data: { Id: "user-1" }, DataAppend: { LoginMethod: "External:Gitee" } };
            }
        };

        const result = await runExternalLogin({ diyCommon, osClient: "iTdos", provider: "Gitee" });

        assert.equal(result.Code, 1);
        assert.equal(calls[0].url, "/api/ExternalLogin/Begin");
        assert.equal(calls[0].payload.ReturnOrigin, "https://os.example.com");
        assert.equal(calls[1].url, "/api/ExternalLogin/CompleteLogin");
        assert.equal(calls[1].payload.Ticket, "opaque-ticket");
        assert.equal(calls[1].payload.Did, "did-1");
    } finally {
        Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
        Object.defineProperty(globalThis, "screen", { configurable: true, value: oldScreen });
        Object.defineProperty(globalThis, "navigator", { configurable: true, value: oldNavigator });
    }
});

test("客户端入口、V8 挂载和个人设置路由保持同一契约", async () => {
    const [login, navbar, mobileProfile, form, table, helper, app, router] = await Promise.all([
        readFile(new URL("../src/views/login/index.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/layout/components/Navbar.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/mobile/profile.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/diy-form.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/utils/v8-identity-verification.js", import.meta.url), "utf8"),
        readFile(new URL("../src/App.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/router/index.js", import.meta.url), "utf8")
    ]);

    assert.match(login, /LoginWithPasskey/);
    assert.match(login, /生物登录/);
    assert.match(login, /登录方式/);
    assert.match(login, /<Teleport to="body">/);
    assert.match(login, /@click\.stop="OpenLoginMethods"/);
    assert.match(login, /v-if="LoginMethodsVisible"[\s\S]*?class="login-methods-overlay"/);
    assert.match(login, /class="login-methods-panel"[\s\S]*?aria-modal="true"/);
    assert.match(login, /@click\.self="CloseLoginMethods"/);
    assert.doesNotMatch(login, /@mouseenter="OpenLoginMethods"/);
    assert.doesNotMatch(login, /进入吾码 DiyToken 权限体系/);
    assert.match(login, /LoginWithExternal/);
    assert.match(login, /LoginWithTotp/);
    assert.match(login, /LoginWithFace/);
    assert.match(navbar, /microi-platform-service\/personal-settings/);
    assert.match(mobileProfile, /microi-platform-service\/personal-settings/);
    assert.match(form, /initV8IdentityVerification/);
    assert.match(table, /initV8IdentityVerification/);
    assert.match(helper, /ConsumeIdentityVerificationTicket/);
    assert.match(helper, /ActionHash/);
    assert.match(helper, /verifyWithTotp/);
    assert.match(helper, /HasStepUpTotp/);
    assert.match(helper, /6 位 Code/);
    assert.match(router, /path: "\/login"[\s\S]*?anonymous: true/);
    assert.match(app, /anonymousHashPaths = \["#\/login", "#\/access-login", "#\/mci-redis-manager", "#\/online-office"\]/);
    assert.match(app, /self\.IsAnonymousRoute\(\) \|\| !self\.DiyCommon\.getToken\(\)/);
});

test("Authenticator 免密码登录使用独立安全弹层并兼顾移动端与无障碍", async () => {
    const login = await readFile(new URL("../src/views/login/index.vue", import.meta.url), "utf8");

    assert.match(login, /class="totp-login-shell"/);
    assert.match(login, /modal-class="totp-login-modal"/);
    assert.match(login, /class="totp-security-orb"/);
    assert.match(login, /无密码安全验证/);
    assert.match(login, /:global\(\.totp-login-shell\.el-dialog\)[\s\S]*?margin:\s*auto/);
    assert.match(login, /autocomplete="username"/);
    assert.match(login, /autocomplete="one-time-code"/);
    assert.match(login, /inputmode="numeric"/);
    assert.match(login, /@input="NormalizeTotpLoginCode"/);
    assert.match(login, /验证码不留存/);
    assert.match(login, /aria-busy="IdentityLoginWaiting === 'Totp' \? 'true' : 'false'"/);
    assert.match(login, /this\.\$refs\.totpCodeInput/);
    assert.match(login, /@media \(max-width: 520px\)[\s\S]*?\.totp-login-actions/);
    assert.match(login, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.totp-security-orb i/);
});

test("登录方式弹层、宿主浮层收起和个人中心公开头像保持完整契约", async () => {
    const [login, headerSearch, host, microAppMain, personalSettings, profileController] = await Promise.all([
        readFile(new URL("../src/views/login/index.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/components/HeaderSearch/index.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/micro-app/host.vue", import.meta.url), "utf8"),
        readFile(platformServiceSourcePath("src/main.js"), "utf8"),
        readFile(platformServiceSourcePath("src/PersonalSettings.vue"), "utf8"),
        readFile(new URL("../../Microi.Server/Microi.net.Api/Controllers/SysUserController.cs", import.meta.url), "utf8")
    ]);

    assert.match(login, /@media \(max-width: 600px\)[\s\S]*?\.login-method-bubbles\s*\{[\s\S]*?grid-template-columns: 1fr/);
    assert.match(headerSearch, /microi:close-global-overlays/);
    assert.match(headerSearch, /handleClickOutside/);
    assert.match(headerSearch, /@visible-change="handleVisibleChange"/);
    assert.match(host, /type === "micro-app:interaction"[\s\S]*?microi:close-global-overlays/);
    assert.match(microAppMain, /pointerdown[\s\S]*?micro-app:interaction[\s\S]*?force:\s*true/);
    assert.match(microAppMain, /micro-app:ready[\s\S]*?hostGeneration[\s\S]*?hostMountAttempt/);
    assert.match(personalSettings, /profile\.PublicAvatar/);
    assert.match(personalSettings, /path: 'member\/public-avatar'/);
    assert.match(personalSettings, /limit: false/);
    assert.match(personalSettings, /client\.resolveFileUrl\(user\.value\.Avatar\)/);
    assert.match(personalSettings, /identity-tech-banner\.jpg/);
    assert.match(personalSettings, /terminalData\?\.Terminals/);
    assert.match(personalSettings, /item\.ConnectionId\s*\|\|\s*item\.DeviceClientId/);
    assert.doesNotMatch(personalSettings, /MICROI IDENTITY CENTER/);
    assert.doesNotMatch(personalSettings, /window\.confirm/);
    assert.match(profileController, /public string PublicAvatar/);
    assert.match(profileController, /member\/public-avatar\//);
    assert.match(profileController, /if \(param\?\.Avatar != null\)/);
});

test("改密票据客户端具备 Passkey 优先、TOTP 与严格人脸回退", async () => {
    const source = await readFile(new URL("../src/utils/identity-verification.js", import.meta.url), "utf8");
    assert.match(source, /capabilities\.PasskeyEnabled && capabilities\.HasPasskey/);
    assert.match(source, /capabilities\.TotpEnabled && capabilities\.HasStepUpTotp/);
    assert.match(source, /capabilities\.FaceEnabled && capabilities\.HasFace/);
    assert.match(source, /purpose: "ChangePassword"/);
});
