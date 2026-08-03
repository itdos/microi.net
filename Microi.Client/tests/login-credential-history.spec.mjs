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

test("login SFC wires remembered accounts, avatar fallback, and a stable desktop card width", () => {
    const component = readFileSync(new URL("../src/views/login/index.vue", import.meta.url), "utf8");

    assert.match(component, /v-model="RememberPassword"/);
    assert.match(component, /popper-class="login-account-history-popper"/);
    assert.match(component, /@click="SelectRememberedAccount\(item\)"/);
    assert.match(component, /v-if="CurrentAccountAvatarUrl"/);
    assert.match(component, /self\.PersistRememberedLogin\(result\.Data \|\| \{\}\)/);
    assert.match(component, /box-sizing:\s*border-box/);
    assert.match(component, /@media \(min-width: 1200px\)[\s\S]*?width:\s*620px/);
    assert.doesNotMatch(component, /@media \(min-width: 1365px\)/);
});
