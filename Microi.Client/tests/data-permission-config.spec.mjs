import assert from "node:assert/strict";
import test from "node:test";

import {
    compactDataPermissionConfig,
    composeDataPermissionSql,
    createDataPermissionMarker,
    extractDataPermissionConfig,
    isGeneratedDefaultDenySql,
    resolveDataPermissionSqlShape,
    shouldClearGeneratedDefaultDenySql,
    stripDataPermissionMarker
} from "../src/utils/data-permission-config.js";

const defaultSnapshot = {
    superAdminAll: true,
    superAdminLevel: 9999,
    tenantIsolation: false,
    tenantField: "TenantId",
    scopeMode: "self",
    ownerField: "UserId",
    departmentField: "DeptId",
    userLevelField: "Level",
    userDeptIdsField: "DeptIds",
    fullAccessRoleIds: [],
    fullAccessPostIds: [],
    fullAccessDeptIds: [],
    ruleMatch: "any",
    rules: [],
    joins: [{ tableName: "Sys_User", alias: "B" }]
};

test("new marker is short readable JSON and omits defaults and join duplication", function () {
    assert.deepEqual(compactDataPermissionConfig(defaultSnapshot), {});
    assert.equal(createDataPermissionMarker(defaultSnapshot), "-- MICROI_DATA_PERMISSION_CONFIG:{}");

    const changed = {
        ...defaultSnapshot,
        scopeMode: "department",
        departmentField: "DepartmentId",
        fullAccessRoleIds: ["role-1", "role-1"]
    };
    assert.equal(
        createDataPermissionMarker(changed),
        '-- MICROI_DATA_PERMISSION_CONFIG:{"scopeMode":"department","departmentField":"DepartmentId","fullAccessRoleIds":["role-1"]}'
    );
});

test("SQL body stays plaintext and round-trips independently from visual config", function () {
    const body = "-- 用户手写说明\n(A.Status = 1 OR A.OwnerId = '$CurrentUser.Id$')";
    const stored = composeDataPermissionSql(defaultSnapshot, body);
    const state = extractDataPermissionConfig(stored);

    assert.equal(state.format, "readable");
    assert.deepEqual(state.config, {});
    assert.equal(stripDataPermissionMarker(stored), body);
    assert.doesNotMatch(stored, /MICROI_DATA_PERMISSION_V1:/);
});

test("empty SQL remains truly empty without marker or parentheses", function () {
    assert.equal(composeDataPermissionSql(defaultSnapshot, ""), "");
    assert.equal(composeDataPermissionSql(defaultSnapshot, "  \n\t"), "");
});

test("only designer-generated default deny is eligible for migration", function () {
    const generated = `${createDataPermissionMarker({ ...defaultSnapshot, superAdminAll: false, scopeMode: "custom" })}
-- 【权限说明】总条件开始：外层括号保证优先级不变。
(
  -- 【权限说明】默认拒绝：尚未配置任何放行规则，因此任何普通用户都不能查看。
  1 = 0
  -- 【权限说明】总条件结束。
)`;
    assert.equal(isGeneratedDefaultDenySql(generated), true);
    assert.equal(shouldClearGeneratedDefaultDenySql(generated), true);
    assert.equal(isGeneratedDefaultDenySql("1 = 0"), false);
    assert.equal(shouldClearGeneratedDefaultDenySql("1 = 0"), false);
});

test("SQL shape never emits an empty parenthesized condition", function () {
    assert.equal(resolveDataPermissionSqlShape({ scopeMode: "custom", tenantIsolation: false }, 0), "empty");
    assert.equal(resolveDataPermissionSqlShape({ scopeMode: "all", tenantIsolation: false }, 3), "empty");
    assert.equal(resolveDataPermissionSqlShape({ scopeMode: "custom", tenantIsolation: true }, 0), "tenant-only");
    assert.equal(resolveDataPermissionSqlShape({ scopeMode: "all", tenantIsolation: true }, 3), "tenant-only");
    assert.equal(resolveDataPermissionSqlShape({ scopeMode: "custom", tenantIsolation: false }, 1), "branches");
    assert.equal(resolveDataPermissionSqlShape({ scopeMode: "custom", tenantIsolation: true }, 1), "tenant-and-branches");
});

test("legacy Base64 marker remains readable for existing modules", function () {
    const legacyConfig = { scopeMode: "custom", whereMode: "manual", manualSql: "1 = 0" };
    const encoded = Buffer.from(JSON.stringify(legacyConfig), "utf8").toString("base64url");
    const stored = `-- MICROI_DATA_PERMISSION_V1:${encoded}\n1 = 0`;
    const state = extractDataPermissionConfig(stored);

    assert.equal(state.format, "legacy-base64");
    assert.deepEqual(state.config, legacyConfig);
    assert.equal(stripDataPermissionMarker(stored), "1 = 0");
    assert.equal(shouldClearGeneratedDefaultDenySql(stored, state), false);
});
