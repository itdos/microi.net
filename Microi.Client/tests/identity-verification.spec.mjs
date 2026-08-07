import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    IdentityVerification,
    createPasswordChangeActionHash,
    getIdentityCapabilities,
    isPasskeySupported,
    sha256Hex
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

test("客户端入口、V8 挂载和个人设置路由保持同一契约", async () => {
    const [login, navbar, mobileProfile, form, table, helper] = await Promise.all([
        readFile(new URL("../src/views/login/index.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/layout/components/Navbar.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/mobile/profile.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/diy-form.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/utils/v8-identity-verification.js", import.meta.url), "utf8")
    ]);

    assert.match(login, /LoginWithPasskey/);
    assert.match(login, /LoginWithFace/);
    assert.match(navbar, /microi-platform-service\/personal-settings/);
    assert.match(mobileProfile, /microi-platform-service\/personal-settings/);
    assert.match(form, /initV8IdentityVerification/);
    assert.match(table, /initV8IdentityVerification/);
    assert.match(helper, /ConsumeIdentityVerificationTicket/);
    assert.match(helper, /ActionHash/);
});

test("改密票据客户端具备 Passkey 优先与严格人脸回退", async () => {
    const source = await readFile(new URL("../src/utils/identity-verification.js", import.meta.url), "utf8");
    assert.match(source, /capabilities\.PasskeyEnabled && capabilities\.HasPasskey/);
    assert.match(source, /capabilities\.FaceEnabled && capabilities\.HasFace/);
    assert.match(source, /purpose: "ChangePassword"/);
});
