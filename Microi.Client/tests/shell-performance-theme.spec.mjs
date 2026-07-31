import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");
const read = (relativePath) => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

const sidebar = read("src/layout/components/Sidebar/index.vue");
const sidebarItem = read("src/layout/components/Sidebar/SidebarItem.vue");
const sidebarStyles = read("src/styles/sidebar.scss");
const layout = read("src/layout/index.vue");
const hamburger = read("src/components/Hamburger/index.vue");
const adminTheme = read("src/styles/mci-admin-theme.scss");
const aiEngine = read("src/views/ai-engine/index.vue");
const designer = read("src/views/form-engine/diy-design.vue");

test("desktop sidebar uses a lightweight CSS compact state", () => {
    assert.match(sidebar, /:collapse="false"/);
    assert.match(sidebar, /sidebar-main-menu--compact/);
    const menuTag = sidebar.match(/<el-menu[\s\S]*?>/)?.[0] || "";
    assert.doesNotMatch(menuTag, /:collapse="isCollapse"/);
    assert.match(sidebarStyles, /\.sidebar-main-menu--compact/);
    assert.match(sidebarStyles, /> \.el-sub-menu > \.el-menu\s*\{\s*display: none !important/);
    assert.match(sidebar, /@mouseover="handleCompactMenuMouseOver"/);
    assert.match(sidebar, /class="mci-sidebar-menu-popper mci-sidebar-compact-flyout"/);
    assert.match(sidebar, /buildCompactChildren\(node\)/);
    assert.match(sidebar, /compactPanels = this\.compactPanels\.slice\(0, panelIndex \+ 1\)/);
    assert.match(sidebar, /generateTitle\.call\(this, title \|\| ""\)/);
    assert.match(sidebarItem, /data-compact-index/);
    assert.match(sidebarStyles, /\.mci-sidebar-compact-flyout\s*\{[\s\S]*?position: fixed;[\s\S]*?max-height: calc\(100vh - 16px\)/);
    assert.match(sidebarStyles, /background: var\(--sidebar-bg-color/);
    assert.match(sidebarStyles, /\.mci-sidebar-flyout-arrow/);
    assert.match(sidebarStyles, /\.main-container-microi\s*\{[\s\S]*?transition: none/);
    assert.match(layout, /\.fixed-header-microi\s*\{[\s\S]*?transition: none/);
});

test("hamburger inherits the active light or dark theme color", () => {
    assert.match(hamburger, /fill: currentColor/);
    assert.match(hamburger, /aria-label/);
    assert.match(adminTheme, /\.hamburger-container-microi svg\s*\{[\s\S]*?fill: currentColor !important/);
});

test("AI composer control labels stay on one line", () => {
    assert.match(aiEngine, /\.semantic-label\s*\{[\s\S]*?flex: 0 0 auto;[\s\S]*?white-space: nowrap/);
    assert.match(aiEngine, /\.semantic-select\s*\{[\s\S]*?flex: 0 0 132px/);
    assert.match(aiEngine, /\.reasoning-select\s*\{[\s\S]*?flex: 0 0 102px/);
});

test("form designer and readonly fields use runtime theme surfaces", () => {
    assert.match(designer, /class="diy-design-toolbar"/);
    assert.match(designer, /background-color: var\(--el-bg-color-page/);
    assert.match(designer, /border-right: 1px solid var\(--mci-divider-color/);
    assert.doesNotMatch(designer, /background-color:\s*#fff;/);
    assert.match(adminTheme, /\.el-input__wrapper:has\(\.el-input__inner\[readonly\]\)/);
    assert.match(adminTheme, /\.el-input-number\.is-disabled \.el-input-number__decrease/);
    assert.match(adminTheme, /-webkit-text-fill-color: var\(--el-text-color-regular\)/);
});
