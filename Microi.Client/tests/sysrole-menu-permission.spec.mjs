import test from "node:test";
import assert from "node:assert/strict";
import { setRoleMenuChecked } from "../src/views/system/utils/sysrole-menu-permission.js";

test("勾选叶子菜单会同步保存标记和默认权限", () => {
    const row = {
        Id: "system-monitor",
        _Check: false,
        Permission: []
    };

    setRoleMenuChecked(row, true);

    assert.equal(row._Check, true);
    assert.deepEqual(row.Permission, ["Add", "Edit", "Del", "Export", "Import"]);
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
    assert.equal(row.Permission.filter((value) => value === "parent-action").length, 1);
    assert.equal(row._Child[0].Permission.filter((value) => value === "view-log").length, 1);

    setRoleMenuChecked(row, false);

    assert.equal(row._Check, false);
    assert.equal(row._Child[0]._Check, false);
    assert.deepEqual(row.Permission, []);
    assert.deepEqual(row._Child[0].Permission, []);
});
