import assert from "node:assert/strict";
import test from "node:test";

import {
    hasCurrentUserAuthorizationSnapshot,
    mergeCurrentUserSnapshot,
    mergeCurrentUserWithCachedSnapshot,
    normalizeCurrentUserRoleLimits
} from "../src/utils/current-user-state.js";

test("current user role permissions can be normalized repeatedly", () => {
    const user = {
        Id: "u1",
        _RoleLimits: [{ Permission: '["Add","Edit","Del"]' }]
    };

    const first = normalizeCurrentUserRoleLimits(user);
    const second = normalizeCurrentUserRoleLimits({ ...first, ThemeMode: "dark" });

    assert.deepEqual(first._RoleLimits[0].Permission, ["Add", "Edit", "Del"]);
    assert.deepEqual(second._RoleLimits[0].Permission, ["Add", "Edit", "Del"]);
    assert.equal(second.ThemeMode, "dark");
});

test("invalid or missing role permission snapshots fail closed without blocking user state", () => {
    const malformed = normalizeCurrentUserRoleLimits({
        Id: "u1",
        _RoleLimits: [{ Permission: "Add,Edit,Del" }, { Permission: null }]
    });
    const missing = normalizeCurrentUserRoleLimits({ Id: "u2" });

    assert.deepEqual(malformed._RoleLimits.map(item => item.Permission), [[], []]);
    assert.deepEqual(missing._RoleLimits, []);
});

test("same-user preference snapshots cannot erase omitted authorization fields", () => {
    const previous = {
        Id: "u1",
        Name: "管理员",
        _IsAdmin: true,
        _RoleLimits: [{ FkId: "menu-1", Permission: ["Add"] }],
        _Roles: [{ Id: "role-1" }],
        RoleIds: '["role-1"]',
        Level: 9999
    };

    const merged = mergeCurrentUserSnapshot(previous, {
        Id: "u1",
        ThemeMode: "dark"
    });

    assert.equal(merged._IsAdmin, true);
    assert.equal(merged._RoleLimits, previous._RoleLimits);
    assert.equal(merged.Level, 9999);
    assert.equal(merged.ThemeMode, "dark");
    assert.equal(hasCurrentUserAuthorizationSnapshot(merged), true);
});

test("explicit authorization revocation and user changes are never merged with stale access", () => {
    const previous = {
        Id: "u1",
        _IsAdmin: true,
        _RoleLimits: [{ FkId: "menu-1", Permission: ["Add"] }]
    };
    const revoked = mergeCurrentUserSnapshot(previous, {
        Id: "u1",
        _IsAdmin: false,
        _RoleLimits: []
    });
    const switched = mergeCurrentUserSnapshot(previous, { Id: "u2", Name: "新用户" });

    assert.equal(revoked._IsAdmin, false);
    assert.deepEqual(revoked._RoleLimits, []);
    assert.equal(hasCurrentUserAuthorizationSnapshot(revoked), true);
    assert.equal("_IsAdmin" in switched, false);
    assert.equal("_RoleLimits" in switched, false);
});

test("a cold Pinia state hydrates same-user authorization before a partial preference update", () => {
    const cached = {
        Id: "admin-id",
        Name: "管理员",
        _IsAdmin: true,
        _RoleLimits: [{ FkId: "contact-menu", Permission: ["Add", "Edit", "FormDesign"] }],
        Level: 9999
    };
    const merged = mergeCurrentUserWithCachedSnapshot(
        { Id: "", Avatar: "", NickName: "" },
        cached,
        { Id: "admin-id", ThemeColor: "#8b5cf6" }
    );

    assert.equal(merged._IsAdmin, true);
    assert.deepEqual(merged._RoleLimits, cached._RoleLimits);
    assert.equal(merged.ThemeColor, "#8b5cf6");
});

test("a cached snapshot from another account is never used during an account switch", () => {
    const merged = mergeCurrentUserWithCachedSnapshot(
        { Id: "old-user", _IsAdmin: true, _RoleLimits: [{ Permission: ["Add"] }] },
        { Id: "old-user", _IsAdmin: true, _RoleLimits: [{ Permission: ["Add"] }] },
        { Id: "new-user", Name: "普通用户" }
    );

    assert.equal(merged.Id, "new-user");
    assert.equal("_IsAdmin" in merged, false);
    assert.equal("_RoleLimits" in merged, false);
});
