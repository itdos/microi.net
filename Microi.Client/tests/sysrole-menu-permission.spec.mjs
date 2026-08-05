import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setRoleMenuChecked } from "../src/views/system/utils/sysrole-menu-permission.js";

// zhy：静态核对角色管理界面与保存白名单，防止后续重构再次隐藏或过滤 Read。
const rolePermissionRowSource = readFileSync(new URL("../src/views/system/components/sysrole-menu-permission-row.vue", import.meta.url), "utf8");
const roleManageSource = readFileSync(new URL("../src/views/system/sysrole-manage.vue", import.meta.url), "utf8");

test("角色管理界面展示并保存 Read 权限", () => {
    assert.match(rolePermissionRowSource, /value:\s*["']Read["']/);
    assert.match(roleManageSource, /Read:\s*["']读取["']/);
    assert.match(roleManageSource, /defaultRoleTypes\s*=\s*\[[^\]]*["']Read["']/s);
});

test("勾选叶子菜单会同步保存标记和默认权限", () => {
    const row = {
        Id: "system-monitor",
        _Check: false,
        Permission: []
    };

    setRoleMenuChecked(row, true);

    assert.equal(row._Check, true);
    // zhy：菜单选中后必须默认包含 Read，保证角色可以访问菜单绑定的 FormEngine 数据。
    assert.deepEqual(row.Permission, ["Read", "Add", "Edit", "Del", "Export", "Import"]);
});

test("勾选父菜单会递归同步当前行和所有子菜单", () => {
    const row = {
        Id: "system-engine",
        _Check: false,
        Permission: [],
        MoreBtns: [{ Id: "parent-action" }],
        _Child: [
            {
                Id: "ai-engine-log",
                _Check: false,
                Permission: [],
                PageBtns: [{ Id: "view-log" }, { Id: "view-log" }]
            }
        ]
    };

    setRoleMenuChecked(row, true);

    assert.equal(row._Check, true);
    assert.equal(row._Child[0]._Check, true);
    // zhy：父子菜单递归勾选时都应获得 Read，避免子菜单查询被后端拒绝。
    assert.equal(row.Permission.includes("Read"), true);
    assert.equal(row._Child[0].Permission.includes("Read"), true);
    assert.equal(row.Permission.filter((value) => value === "parent-action").length, 1);
    assert.equal(row._Child[0].Permission.filter((value) => value === "view-log").length, 1);

    setRoleMenuChecked(row, false);

    assert.equal(row._Check, false);
    assert.equal(row._Child[0]._Check, false);
    assert.deepEqual(row.Permission, []);
    assert.deepEqual(row._Child[0].Permission, []);
});
