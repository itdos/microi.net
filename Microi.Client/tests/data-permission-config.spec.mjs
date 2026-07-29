import assert from "node:assert/strict";
import test from "node:test";

import {
    compactDataPermissionConfig,
    composeDataPermissionSql,
    createDataPermissionMarker,
    extractDataPermissionConfig,
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

test("legacy Base64 marker remains readable for existing modules", function () {
    const legacyConfig = { scopeMode: "custom", whereMode: "manual", manualSql: "1 = 0" };
    const encoded = Buffer.from(JSON.stringify(legacyConfig), "utf8").toString("base64url");
    const stored = `-- MICROI_DATA_PERMISSION_V1:${encoded}\n1 = 0`;
    const state = extractDataPermissionConfig(stored);

    assert.equal(state.format, "legacy-base64");
    assert.deepEqual(state.config, legacyConfig);
    assert.equal(stripDataPermissionMarker(stored), "1 = 0");
});
