import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sidebarItem = fs.readFileSync(path.join(clientRoot, "src/layout/components/Sidebar/SidebarItem.vue"), "utf8");
const sidebar = fs.readFileSync(path.join(clientRoot, "src/layout/components/Sidebar/index.vue"), "utf8");
const item = fs.readFileSync(path.join(clientRoot, "src/layout/components/Sidebar/Item.vue"), "utf8");

test("only rendered parent menus opt in to the persistent icon surface", () => {
    const leafBranch = sidebarItem.split('<el-menu-item\n            v-else-if="flyoutMode')[0];
    assert.doesNotMatch(leafBranch, /:is-parent=/);
    assert.equal((sidebarItem.match(/:is-parent="true"/g) || []).length, 2);
    assert.match(sidebar, /:is-parent="node\.hasChildren"/);
    assert.match(item, /isParent:\s*\{\s*type:\s*Boolean/);
});

test("parent icon surface stays circular and derives from the current sidebar text color", () => {
    assert.match(item, /'mci-sidebar-parent-icon': isParent/);
    assert.match(item, /&\.mci-sidebar-parent-icon::before\s*\{/);
    assert.match(item, /border-radius:\s*50%/);
    assert.match(item, /background:\s*color-mix\(in srgb, currentColor \d+%, transparent\)/);
    assert.doesNotMatch(item, /\.el-menu-item:hover \.sub-el-icon::before/);
});
