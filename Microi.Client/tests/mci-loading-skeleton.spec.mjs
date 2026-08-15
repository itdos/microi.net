import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");
const workspaceRoot = path.resolve(clientRoot, "..");
const read = relativePath => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

function listFiles(root, extension) {
    const result = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const absolute = path.join(root, entry.name);
        if (entry.isDirectory()) result.push(...listFiles(absolute, extension));
        else if (entry.name.endsWith(extension)) result.push(absolute);
    }
    return result;
}

const directive = read("src/utils/mci-loading.js");
const loadingStyles = read("src/styles/mci-loading.scss");
const designStyles = read("src/styles/mci-design.scss");
const openClawStyles = read("src/styles/theme-openclaw.scss");
const main = read("src/main.js");
const permission = read("src/permission.js");
const appMain = read("src/layout/components/AppMain.vue");
const tagsView = read("src/layout/components/TagsView/index.vue");
const diyTable = read("src/views/form-engine/diy-table.vue");
const diyForm = read("src/views/form-engine/diy-form.vue");
const navbar = read("src/layout/components/Navbar.vue");
const aiEngine = read("src/views/ai-engine/index.vue");
const mobileProfile = read("src/views/mobile/profile.vue");
const sysUserManage = read("src/views/system/sysuser-manage.vue");
const diyImgUpload = read("src/views/form-engine/diy-field-component/diy-imgupload.vue");
const diyTableSpecialCell = read("src/views/form-engine/diy-components/DiyTableSpecialCell.vue");
const themeColor = read("src/utils/theme-color.js");
const uiSkill = fs.readFileSync(path.join(workspaceRoot, "microi.skills/ui-design/references/progressive-02-字体.md"), "utf8");
const frontendSkill = fs.readFileSync(path.join(workspaceRoot, "microi.skills/microi-client-frontend/references/progressive-02-8-运行时高频坑复盘.md"), "utf8");

test("all Microi.Client content loaders use the semantic skeleton directive", () => {
    const vueFiles = listFiles(path.join(clientRoot, "src"), ".vue");
    const legacy = [];
    for (const file of vueFiles) {
        const source = fs.readFileSync(file, "utf8");
        if (/\bv-loading(?::[\w-]+)?\s*=/.test(source) || /\belement-loading-(?:text|background)\s*=/.test(source)) {
            legacy.push(path.relative(clientRoot, file));
        }
    }
    assert.deepEqual(legacy, []);
    assert.doesNotMatch(directive, /ElLoading/);
    assert.match(main, /app\.directive\("mci-loading", MciLoadingDirective\)/);
    assert.match(main, /styles\/mci-loading\.scss/);
});

test("skeleton variants preserve table, card, form, detail, page and compact geometry", () => {
    for (const variant of ["table", "cards", "form", "detail", "page", "stats", "list", "tree", "compact"]) {
        assert.match(directive, new RegExp(`\\"${variant}\\"`), variant);
        assert.match(loadingStyles, new RegExp(`(?:is-|--|host--)${variant}`), variant);
    }
    assert.match(directive, /aria-busy/);
    assert.match(directive, /aria-live/);
    assert.match(directive, /SERVICE_BUSY_STATE/);
    assert.match(directive, /target\.setAttribute\("aria-busy", "true"\)/);
    assert.match(loadingStyles, /prefers-reduced-motion:\s*reduce/);
    assert.match(loadingStyles, /animation:\s*mci-skeleton-shimmer\s+1\.18s/);
});

test("table, form and menu navigation expose skeletons before empty content", () => {
    assert.match(diyTable, /v-mci-loading:table="tableLoading"/);
    assert.match(diyTable, /class="table-card-el-row"[\s\S]*?:aria-busy="tableLoading \? 'true' : 'false'"/);
    assert.match(diyTable, /v-if="!tableLoading"[^>]*>\{\{ \$t\('Msg\.NoData'\)/);
    assert.doesNotMatch(diyTable, /tableLoading \? \$t\('Msg\.DataLoading'\)/);
    assert.match(diyForm, /v-mci-loading:form="!GetDiyTableRowModelFinish"/);
    assert.doesNotMatch(diyForm, /form-skeleton-container/);
    assert.match(permission, /startRouteLoading\(\)/);
    assert.match(permission, /finishRouteLoading\(\)/);
    assert.match(appMain, /v-mci-loading:page="routeLoading"/);
    assert.match(tagsView, /mci-route-view-host[^>]*v-mci-loading:page="routeLoading"/);
});

test("light, dark and custom palettes drive skeleton tokens without black loading masks", () => {
    for (const token of ["surface", "card", "header", "base", "highlight", "accent", "border"]) {
        assert.match(designStyles, new RegExp(`--mci-skeleton-${token}:`), token);
        assert.match(themeColor, new RegExp(`\\"--mci-skeleton-${token}\\"`), token);
    }
    assert.doesNotMatch(designStyles, /\.el-loading-mask\s*\{\s*background:\s*rgba\(/s);
    assert.doesNotMatch(openClawStyles, /\.el-loading-mask\s*\{\s*background:\s*rgba\(/s);
    assert.match(loadingStyles, /\.el-loading-mask\s*\{[\s\S]*?--mci-skeleton-surface/);
    assert.match(loadingStyles, /--mci-skeleton-accent/);
});

test("remote avatars and private images never render the legacy loading.gif sentinel", () => {
    for (const source of [navbar, aiEngine, mobileProfile, sysUserManage]) {
        assert.doesNotMatch(source, /(?:AvatarUrl|Avatar)\s*=\s*["']\.\/static\/img\/loading\.gif["']/);
        assert.doesNotMatch(source, /:src\s*=\s*["'][^"']*loading\.gif/);
        assert.match(source, /mci-avatar-skeleton/);
    }
    assert.match(diyImgUpload, /isImagePathLoading/);
    assert.match(diyImgUpload, /mci-media-skeleton/);
    assert.doesNotMatch(diyImgUpload, /return\s+["']\.\/static\/img\/loading\.gif["']/);
    assert.match(diyTableSpecialCell, /mci-media-skeleton/);
    assert.match(diyTableSpecialCell, /mci-inline-value-skeleton diy-special-file-loading/);
    assert.doesNotMatch(diyTableSpecialCell, /'is-loading':\s*!resolvedUrls/);
});

test("authoritative skills define theme-aware content loading and action-progress boundaries", () => {
    for (const source of [uiSkill, frontendSkill]) {
        assert.match(source, /--mci-skeleton-surface/);
        assert.match(source, /自定义主题/);
        assert.match(source, /v-mci-loading/);
        assert.match(source, /按钮.*Loading|按钮内 `loading`/);
        assert.match(source, /真实进度|可信百分比/);
    }
});
