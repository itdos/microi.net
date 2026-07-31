import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(currentDir, "..");
const sidebarItem = fs.readFileSync(
    path.join(clientRoot, "src/layout/components/Sidebar/SidebarItem.vue"),
    "utf8"
);
const sidebar = fs.readFileSync(
    path.join(clientRoot, "src/layout/components/Sidebar/index.vue"),
    "utf8"
);
const item = fs.readFileSync(
    path.join(clientRoot, "src/layout/components/Sidebar/Item.vue"),
    "utf8"
);

test("recursive sidebar items carry an explicit depth and cap deep indentation", () => {
    assert.match(sidebarItem, /:level="normalizedLevel \+ 1"/);
    assert.match(sidebarItem, /Math\.min\(this\.normalizedLevel, 3\) \* 10/);
    assert.match(sidebarItem, /--mci-sidebar-menu-indent/);
});

test("expanded sidebar keeps nested menus full width and reserves text space", () => {
    assert.match(sidebar, /class="sidebar-main-menu"/);
    assert.match(sidebar, /&:not\(\.el-menu--collapse\)/);
    assert.match(sidebar, /padding-left: var\(--mci-sidebar-menu-indent, 20px\) !important/);
    assert.match(sidebar, /padding: 2px 0 6px/);
    assert.match(sidebar, /width: calc\(100% - 16px\)/);
});

test("truncated menu labels expose the complete accessible title", () => {
    assert.match(item, /class="menu-title" :title="title" :aria-label="title"/);
});
