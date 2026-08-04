import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    LOGIN_CREDENTIAL_HISTORY_STORAGE_KEY,
    MAX_REMEMBERED_LOGIN_ACCOUNTS,
    clearRememberedLoginAccounts,
    readRememberedLoginAccounts,
    removeRememberedLoginAccount,
    updateRememberedLoginAccountProfile,
    upsertRememberedLoginAccount
} from "../src/utils/login-credential-history.js";
import { resolveLoginSystemLogoUrl } from "../src/utils/login-branding.js";

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

test("remembered passwords are AES-encrypted at rest and decrypt for the matching tenant", () => {
    const storage = createStorage();
    upsertRememberedLoginAccount({
        storage,
        osClient: "tenant-a",
        account: "admin",
        password: "Secret#123",
        user: { Id: "user-1", Account: "admin", Name: "管理员", Avatar: "/private/avatar.png" },
        updatedAt: 100
    });

    const raw = storage.getItem(LOGIN_CREDENTIAL_HISTORY_STORAGE_KEY);
    assert.ok(raw);
    assert.doesNotMatch(raw, /Secret#123/);
    assert.match(raw, /aes-v1:/);
    assert.deepEqual(readRememberedLoginAccounts({ storage, osClient: "tenant-a" }), [{
        Account: "admin",
        Password: "Secret#123",
        UserId: "user-1",
        DisplayName: "管理员",
        Avatar: "/private/avatar.png",
        AvatarDataUrl: "",
        UpdatedAt: 100
    }]);
    assert.deepEqual(readRememberedLoginAccounts({ storage, osClient: "tenant-b" }), []);
});

test("upsert keeps tenant histories isolated, orders recent accounts, and caps each tenant", () => {
    const storage = createStorage();
    for (let index = 0; index < MAX_REMEMBERED_LOGIN_ACCOUNTS + 2; index += 1) {
        upsertRememberedLoginAccount({
            storage,
            osClient: "tenant-a",
            account: `user-${index}`,
            password: `pwd-${index}`,
            updatedAt: index + 1
        });
    }
    upsertRememberedLoginAccount({
        storage,
        osClient: "tenant-b",
        account: "other",
        password: "other-password",
        updatedAt: 50
    });

    const tenantA = readRememberedLoginAccounts({ storage, osClient: "tenant-a" });
    assert.equal(tenantA.length, MAX_REMEMBERED_LOGIN_ACCOUNTS);
    assert.equal(tenantA[0].Account, `user-${MAX_REMEMBERED_LOGIN_ACCOUNTS + 1}`);
    assert.equal(tenantA.at(-1).Account, "user-2");
    assert.equal(readRememberedLoginAccounts({ storage, osClient: "tenant-b" })[0].Account, "other");
});

test("avatar profile updates preserve the remembered password and reject oversized/non-image snapshots", () => {
    const storage = createStorage();
    const avatarDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    upsertRememberedLoginAccount({
        storage,
        osClient: "tenant-a",
        account: "demo",
        password: "demo-password"
    });
    updateRememberedLoginAccountProfile({
        storage,
        osClient: "tenant-a",
        account: "demo",
        user: { Id: "user-demo", Name: "演示用户", Avatar: "/private/demo.png" },
        avatarDataUrl
    });

    assert.deepEqual(readRememberedLoginAccounts({ storage, osClient: "tenant-a" })[0], {
        Account: "demo",
        Password: "demo-password",
        UserId: "user-demo",
        DisplayName: "演示用户",
        Avatar: "/private/demo.png",
        AvatarDataUrl: avatarDataUrl,
        UpdatedAt: readRememberedLoginAccounts({ storage, osClient: "tenant-a" })[0].UpdatedAt
    });

    updateRememberedLoginAccountProfile({
        storage,
        osClient: "tenant-a",
        account: "demo",
        avatarDataUrl: "data:text/plain;base64,bm90LWFuLWltYWdl"
    });
    assert.equal(readRememberedLoginAccounts({ storage, osClient: "tenant-a" })[0].AvatarDataUrl, avatarDataUrl);
});

test("remove and clear affect only the requested account or tenant", () => {
    const storage = createStorage();
    for (const [osClient, account] of [["tenant-a", "one"], ["tenant-a", "two"], ["tenant-b", "other"]]) {
        upsertRememberedLoginAccount({ storage, osClient, account, password: "pwd" });
    }

    removeRememberedLoginAccount({ storage, osClient: "tenant-a", account: "one" });
    assert.deepEqual(readRememberedLoginAccounts({ storage, osClient: "tenant-a" }).map((item) => item.Account), ["two"]);
    clearRememberedLoginAccounts({ storage, osClient: "tenant-a" });
    assert.deepEqual(readRememberedLoginAccounts({ storage, osClient: "tenant-a" }), []);
    assert.equal(readRememberedLoginAccounts({ storage, osClient: "tenant-b" })[0].Account, "other");
});

test("login system logo resolves Microi file objects, JSON strings, and URL variants", () => {
    const getServerPath = (path) => `https://files.microi.test${path}`;

    assert.equal(resolveLoginSystemLogoUrl({ Path: "/tenant/logo.png" }, getServerPath), "https://files.microi.test/tenant/logo.png");
    assert.equal(resolveLoginSystemLogoUrl('{"Path":"/tenant/logo-json.png"}', getServerPath), "https://files.microi.test/tenant/logo-json.png");
    assert.equal(resolveLoginSystemLogoUrl('[{"Path":"/tenant/logo-array.png"}]', getServerPath), "https://files.microi.test/tenant/logo-array.png");
    assert.equal(resolveLoginSystemLogoUrl("tenant/logo-relative.png", getServerPath), "https://files.microi.test/tenant/logo-relative.png");
    assert.equal(resolveLoginSystemLogoUrl("https://cdn.microi.test/logo.png", getServerPath), "https://cdn.microi.test/logo.png");
    assert.equal(resolveLoginSystemLogoUrl("./static/img/logo.png", getServerPath), "./static/img/logo.png");
    assert.equal(resolveLoginSystemLogoUrl(null, getServerPath), "");
});

test("login SFC wires branding, remembered accounts, classic default, and AI motion", () => {
    const component = readFileSync(new URL("../src/views/login/index.vue", import.meta.url), "utf8");

    assert.match(component, /v-model="RememberPassword"/);
    assert.match(component, /class="remember-password-label">记住密码/);
    assert.doesNotMatch(component, /仅在此设备本地加密保存/);
    assert.match(component, /popper-class="login-account-history-popper"/);
    assert.match(component, /@click="SelectRememberedAccount\(item\)"/);
    assert.match(component, /v-if="CurrentAccountAvatarUrl"/);
    assert.match(component, /this\.SysConfig\?\.SysLogo/);
    assert.match(component, /resolveLoginSystemLogoUrl/);
    assert.match(component, /class="login-system-logo"/);
    assert.match(component, /class="login-brand" :class="\{ 'has-subtitle': !!SystemSubTitle \}"/);
    assert.match(component, /<span v-if="SystemSubTitle">\{\{ SystemSubTitle \}\}<\/span>/);
    assert.match(component, /--mci-login-brand-height:\s*40px/);
    assert.match(component, /\.login-system-logo\s*\{[\s\S]*?width:\s*var\(--mci-login-brand-height\);[\s\S]*?height:\s*var\(--mci-login-brand-height\);[\s\S]*?flex:\s*0 0 var\(--mci-login-brand-height\);/);
    assert.match(component, /\.login-brand[\s\S]*?\.login-title\s*\{[\s\S]*?height:\s*var\(--mci-login-brand-height\);[\s\S]*?justify-content:\s*center;/);
    assert.doesNotMatch(component, /\.login-system-logo\s*\{[^}]*?(?:width|height|flex-basis):\s*(?:56|64)px/);
    assert.doesNotMatch(component, /选择界面风格|style-selector-wrapper/);
    assert.match(component, /self\.diyStore\.setState\("SystemStyle", "Classic"\)/);
    assert.match(component, /self\.PersistRememberedLogin\(result\.Data \|\| \{\}\)/);
    assert.match(component, /class="login-button-energy"/);
    assert.match(component, /class="login-button-energy-beam"/);
    assert.match(component, /@keyframes mciLoginEnergySweep/);
    assert.match(component, /@keyframes mciLoginCurrentTrace/);
    assert.match(component, /@keyframes mciLoginCardBreath/);
    assert.match(component, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(component, /--mci-login-control-radius:\s*12px/);
    assert.match(component, /\.remember-password-checkbox[\s\S]*?border-radius:\s*var\(--mci-login-control-radius\)/);
    assert.match(component, /\.login-button[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*var\(--mci-login-control-radius\)/);
    assert.match(component, /\.loginCenterBgCover[\s\S]*?border:\s*0;[\s\S]*?box-shadow:\s*var\(--mci-login-card-shadow\)/);
    assert.doesNotMatch(component, /login-button-energy-line|mci-login-button-circuit|mciLoginCircuitFlow/);
    assert.doesNotMatch(component, /box-shadow:\s*0 0 0 1px rgba\(255,\s*255,\s*255[^;]*inset/);
    assert.match(component, /box-sizing:\s*border-box/);
    assert.match(component, /@media \(min-width: 1200px\)[\s\S]*?width:\s*620px/);
    assert.doesNotMatch(component, /@media \(min-width: 1365px\)/);
});
