import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryHistory, createRouter } from "vue-router";
import { resolveMenuFolderRoutePath } from "../src/utils/dynamic-menu-routes.js";

test("旧父子菜单共用地址时，浏览器书签和点击仍解析到业务模块", () => {
    const menu = { Id: "parent-assets", Url: "/assets", _Child: [{ Id: "asset-list", Url: "/assets" }] };
    const before = JSON.stringify(menu);
    const folder = resolveMenuFolderRoutePath(menu, menu.Url);
    const router = createRouter({ history: createMemoryHistory(), routes: [{
        path: folder, name: "parent", component: {}, children: [
            { path: folder, name: "grid", component: {} },
            { path: menu._Child[0].Url, name: "asset-list", component: {} }
        ]
    }] });
    assert.equal(router.resolve("/assets").name, "asset-list");
    assert.equal(router.resolve(folder).name, "grid");
    assert.equal(JSON.stringify(menu), before);
});

test("检查深层子模块，并忽略 URL 查询参数与末尾斜线", () => {
    const menu = { Id: "nested-parent", _Child: [{ Url: "/middle", _Child: [{ Url: "assets/?status=1" }] }] };
    assert.equal(resolveMenuFolderRoutePath(menu, "/assets"), "/folder-nestedparent");
});

test("无路径冲突时保留目录地址，外部地址不与本地子模块混淆", () => {
    assert.equal(resolveMenuFolderRoutePath({ Id: "p", _Child: [{ Url: "/assets" }] }, "/asset-center"), "/asset-center");
    assert.equal(resolveMenuFolderRoutePath({ Id: "p", _Child: [{ Url: "https://example.com/assets" }] }, "/assets"), "/assets");
    assert.equal(resolveMenuFolderRoutePath({ Id: "p", _Child: [] }, "/assets"), "/assets");
});
