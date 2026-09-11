import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readPlatformServiceSource } from "./helpers/platform-service-source.mjs";

const root = new URL("../", import.meta.url);

async function source(path) {
    return readFile(new URL(path, root), "utf8");
}

test("startup screen distinguishes mount, readiness, slow service and recoverable failure", async function () {
    const [main, loading, html, osClient] = await Promise.all([
        source("src/main.js"),
        source("public/static/js/microi.loading.js"),
        source("index.html"),
        source("src/utils/itdos.osclient.js")
    ]);

    assert.match(main, /__MICROI_APP_MOUNTED__\s*=\s*true/);
    assert.match(main, /__MICROI_APP_READY__\s*=\s*true/);
    assert.match(main, /await router\.isReady\(\)/);
    assert.match(main, /requestAnimationFrame\(function \(\) \{[\s\S]*requestAnimationFrame\(resolve\)/);
    assert.match(main, /microi:app-ready/);
    assert.match(main, /microi:app-boot-failed/);
    assert.match(loading, /return window\.__MICROI_APP_READY__ === true/);
    assert.match(loading, /loadingRate\s*=\s*100/);
    assert.match(loading, /应用已就绪，正在进入/);
    assert.match(loading, /finishTimer\s*=\s*setTimeout/);
    assert.match(loading, /后端服务响应较慢/);
    assert.match(loading, /仍在等待后端服务/);
    assert.match(loading, /后端服务暂时不可用/);
    assert.match(loading, /startupRetry/);
    assert.match(html, /id="startupStatus"/);
    assert.match(loading, /系统初始化尚未完成，请检查服务后重新加载/);
    // Cache versions advance when startup diagnostics change. Require a real,
    // cache-busted script reference without rejecting a newer valid version.
    const loadingScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']\/static\/js\/microi\.loading\.js\?d=(\d{10})["'][^>]*>/g)];
    assert.equal(loadingScripts.length, 1, "load the startup runtime exactly once");
    assert.ok(Number(loadingScripts[0][1]) >= 2026091001, "do not restore a stale startup runtime cache key");
    assert.match(osClient, /MICROI_SYSCONFIG_UNAVAILABLE/);
    assert.match(osClient, /throw sysConfigError/);
});

test("white palette uses readable semantic accents across splash, login, shell and micro-apps", async function () {
    const [theme, design, adminTheme, html, login, sidebar, host, dialog] = await Promise.all([
        source("src/utils/theme-color.js"),
        source("src/styles/mci-design.scss"),
        source("src/styles/mci-admin-theme.scss"),
        source("index.html"),
        source("src/views/login/index.vue"),
        source("src/layout/components/Sidebar/index.vue"),
        source("src/views/micro-app/host.vue"),
        source("src/views/micro-app/dialog.vue")
    ]);

    assert.match(theme, /function createInteractiveProfile/);
    assert.match(theme, /getReadableAccent\(profile\.value, mode === "dark" \? "#1D293B" : "#FFFFFF"\)/);
    assert.match(theme, /"--mci-color-primary-on-surface": primary/);
    assert.match(theme, /"--mci-brand-primary": paletteProfile\.value/);
    assert.match(design, /--mci-color-primary-on-surface:/);
    assert.match(adminTheme, /data-mci-palette="white"/);
    assert.match(html, /\.mci-app-title[\s\S]*?--mci-color-primary-on-surface/);
    assert.match(html, /\.mci-startup-error__retry[\s\S]*?--mci-text-on-primary/);
    assert.match(login, /\.login-methods-orbit[\s\S]*?--mci-color-primary-on-surface/);
    assert.match(login, /\.login-methods-footnote \.el-icon[\s\S]*?--mci-color-primary-on-surface/);
    assert.match(sidebar, /margin: 3px 8px;[\s\S]{0,120}?border:\s*0 !important/);
    assert.match(sidebar, /&\.is-active[\s\S]*?box-shadow:\s*none !important/);
    assert.match(sidebar, /height:\s*42%/);
    assert.match(adminTheme, /data-mci-palette="white"[\s\S]*?\.el-sub-menu__title[\s\S]*?border-bottom:\s*0 !important/);
    for (const runtimeHost of [host, dialog]) {
        assert.match(runtimeHost, /themePalette:/);
        assert.match(runtimeHost, /themePrimaryText:/);
        assert.match(runtimeHost, /themeTokens:/);
        assert.match(runtimeHost, /--mci-color-primary-on-surface/);
    }
});

test("modern form remains the default while classic mode and all label positions stay supported", async function () {
    const [form, state, styles, formUtils, switchComponent] = await Promise.all([
        source("src/views/form-engine/diy-form.vue"),
        source("src/views/form-engine/mixins/diy-form-state.mixin.js"),
        source("src/views/form-engine/styles/diy-form.scss"),
        source("src/views/form-engine/mixins/form-utils.mixin.js"),
        source("src/views/form-engine/diy-field-component/diy-switch.vue")
    ]);

    assert.match(form, /:label-position="GetLabelPosition\(\)"/);
    assert.match(form, /:label-width="GetFormLabelWidth\(\)"/);
    assert.match(form, /UseParentFieldSettingsDialog/);
    assert.match(state, /presentation === 'classic' \|\| presentation === 'legacy'/);
    assert.match(state, /'diy-form--modern'/);
    assert.match(state, /diy-form--label-/);
    assert.match(styles, /\.diy-form--modern/);
    assert.match(styles, /\.diy-form--label-left/);
    assert.match(styles, /\.diy-form--label-right/);
    assert.match(styles, /\.diy-form--label-top/);
    assert.match(styles, /&:not\(\.diy-form--settingscenter\):not\(\.diy-form--controlcenter\)/);
    assert.match(styles, /\.diy-modern-field-card > \.container-form-item[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent/);
    assert.match(styles, /\.diy-modern-field-card \.el-input__wrapper[\s\S]*?background:\s*var\(--diy-modern-surface\)/);
    assert.match(styles, /html\.dark|:global\(html\.dark\)/);
    assert.match(state, /diy-modern-field-card--tall/);
    assert.match(styles, /\.diy-modern-field-card--tall \.el-form-item__label[\s\S]*?align-items:\s*flex-start/);
    assert.match(styles, /\.diy-modern-field-card \.el-input__prefix[\s\S]*?align-items:\s*center/);
    // 四个字段说明提示与设计器宽度提示共用真正的 CSS 三角箭头。
    assert.equal((form.match(/popper-class="diy-field-description-tooltip"/g) || []).length, 5);
    assert.equal((form.match(/:teleported="true"/g) || []).length >= 4, true);
    assert.match(form, /class="diy-field-description diy-field-description--inline"[\s\S]*?tabindex="0"[\s\S]*?:aria-label="field\.Description"/);
    assert.match(styles, /\.diy-field-description\s*\{[\s\S]*?pointer-events:\s*auto !important/);
    assert.match(formUtils, /Switch.*DisplayMode[\s\S]*?return false/);
    assert.match(switchComponent, /UseCardDisplay/);
    assert.match(switchComponent, /class="diy-switch-card"/);
    assert.match(switchComponent, /CommonV8CodeChange/);
});

test("form and designer dialogs share the modern draggable themed treatment", async function () {
    const [full, fullStyles, designer, designerMixin, collapseGroup, tabs, divider] = await Promise.all([
        source("src/views/form-engine/diy-form-full.vue"),
        source("src/views/form-engine/styles/diy-form-full.global.scss"),
        source("src/views/form-engine/diy-design.vue"),
        source("src/views/form-engine/mixins/diy-form-designer.mixin.js"),
        source("src/views/form-engine/diy-field-component/diy-collapse-group.vue"),
        source("src/views/form-engine/diy-field-component/diy-tabs.vue"),
        source("src/views/form-engine/diy-field-component/diy-divider.vue")
    ]);

    assert.match(full, /diy-form-modern-dialog/);
    assert.match(full, /diy-form-modern-drawer/);
    assert.match(full, /diy-form-modern-overlay/);
    assert.match(fullStyles, /backdrop-filter:\s*blur/);
    assert.match(fullStyles, /\.diy-form-container\.el-drawer\.diy-form-modern-drawer/);
    assert.match(fullStyles, /\.diy-form-container\.el-dialog\.diy-form-modern-dialog[\s\S]*?> \.el-dialog__header[\s\S]*?border-top:\s*0 !important/);
    assert.match(fullStyles, /\.diy-form-container\.el-drawer\.diy-form-modern-drawer[\s\S]*?border-radius:\s*0 !important/);
    assert.match(fullStyles, /> \.el-drawer__header[\s\S]*?border-top:\s*2px solid var\(--diy-dialog-accent\) !important/);
    assert.match(full, /@close="HandleModernOverlayClose"/);
    assert.match(fullStyles, /\.diy-form-modern-overlay\.is-closing[\s\S]*?backdrop-filter:\s*none !important/);
    assert.match(fullStyles, /html\.dark|body\.dark/);
    assert.equal((full.match(/class="diy-form-header-search"/g) || []).length, 3);
    assert.equal((full.match(/class="diy-form-field-search-toolbar diy-form-field-search-toolbar--mobile"/g) || []).length, 3);
    assert.equal((full.match(/placeholder="搜索字段"/g) || []).length, 6);
    assert.equal((full.match(/<el-icon><Refresh \/><\/el-icon>[\s\S]*?刷新当前记录/g) || []).length >= 3, true);
    assert.equal((full.match(/:FieldSearchKeyword="FormFieldSearchKeyword"/g) || []).length, 3);
    assert.match(full, /FormFieldSearchMatchCount/);
    assert.match(full, /async RefreshCurrentForm\(\)[\s\S]*?await formRef\.Init\(\)/);
    assert.match(full, /Init\(param\)[\s\S]*?FormFieldSearchKeyword = ""/);
    assert.match(fullStyles, /\.diy-form-field-search-toolbar[\s\S]*?\.diy-form-field-search-count/);
    assert.match(designer, /class="diy-designer-field-dialog mci-unified-dialog mci-field-config-dialog"/);
    assert.match(designer, /modal-class="diy-designer-field-overlay mci-unified-overlay mci-field-config-overlay"/);
    assert.match(designer, /\sdraggable[\s\r\n>]/);
    assert.doesNotMatch(designer, /DiyComponentConfigPanel/);
    assert.doesNotMatch(designer, /HandleInlineComponentConfigChange/);
    assert.doesNotMatch(designer, /OpenSelectedComponentConfig/);
    assert.match(designerMixin, /CallbackOpenFieldSettings/);
    assert.match(designerMixin, /openNativeComponentConfig/);
    assert.match(designerMixin, /hasNativeFieldConfig\(field\.Component\)[\s\S]*?typeof refComponent\.openConfig === "function"[\s\S]*?refComponent\.openConfig\(\)/);
    for (const component of [collapseGroup, tabs, divider]) {
        assert.match(component, /defineExpose\(\{[\s\S]*?openConfig/);
    }
    assert.match(collapseGroup, /&__header\s*\{[\s\S]*?background:\s*var\(--group-bg\)/);
});

test("visual modernization retains page, batch and both row V8 action surfaces", async function () {
    const [table, tableStyles, full, specialCell] = await Promise.all([
        source("src/views/form-engine/diy-table.vue"),
        source("src/styles/diy-table.scss"),
        source("src/views/form-engine/diy-form-full.vue"),
        source("src/views/form-engine/diy-components/DiyTableSpecialCell.vue")
    ]);

    assert.match(table, /SysMenuModel\.PageBtns/);
    assert.match(table, /SysMenuModel\.BatchSelectMoreBtns/);
    assert.match(table, /_RowMoreBtnsOut/);
    assert.match(table, /_RowMoreBtnsIn/);
    assert.match(table, /handleMoreMenuAction\('custom', btn\)/);
    assert.match(tableStyles, /border-right:\s*0 !important/);
    assert.match(tableStyles, /:deep\(\.el-table\.table-data\.el-table--border td\.el-table__cell\)[\s\S]*?border-right-style:\s*none !important/);
    assert.match(tableStyles, /\.card-wrapper-desktop \.card-actions[\s\S]*?border-top:\s*0;[\s\S]*?background:\s*transparent/);
    assert.match(full, /SysMenuModel\.FormBtns/);
    assert.match(full, /RunMoreBtn\(btn, CurrentRowModel, CurrentRowModel\._V8\)/);
    assert.match(full, /isFormMaskBlurEnabled/);
    assert.match(full, /!isFormMaskBlurEnabled\(this\.diyStore\?\.SysConfig\)/);
    assert.match(full, /isExplicitlyDisabled\(tableValue\)/);
    assert.match(table, /global-col-menu-head/);
    assert.match(tableStyles, /\.global-col-menu-head/);
    assert.match(specialCell, /diy-special-action--table-child/);
    assert.match(specialCell, /查看子表/);
  assert.match(specialCell, /\.diy-special-action--table-child[\s\S]*?border-radius:\s*999px/);
  assert.match(tableStyles, /:global\(\.diy-open-table-dialog\.el-dialog\)[\s\S]*?border-radius:\s*18px/);
});

test("clean shell styling keeps tabs, search controls and metrics theme-aware", async function () {
    const [shell, mciDesign, table, tableStyles, formStyles, diyStyles, sidebar, tags] = await Promise.all([
        source("src/styles/mci-admin-theme.scss"),
        source("src/styles/mci-design.scss"),
        source("src/views/form-engine/diy-table.vue"),
        source("src/styles/diy-table.scss"),
        source("src/views/form-engine/styles/diy-form.scss"),
        source("src/styles/itdos.diy.scss"),
        source("src/layout/components/Sidebar/index.vue"),
        source("src/layout/components/TagsView/index.vue")
    ]);

    assert.match(shell, /\.tags-view-container-microi[\s\S]*?border-bottom:\s*0 !important;[\s\S]*?box-shadow:\s*none !important/);
    assert.match(shell, /\.el-tabs:not\(\.mci-tabs\) \.el-tabs__item\.is-active/);
    assert.match(mciDesign, /\.mci-tabs\s*\{/);
    assert.doesNotMatch(mciDesign, /--mci-tabs-track/);
    assert.match(mciDesign, /\.el-tabs__nav-wrap[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent/);
    assert.match(mciDesign, /> \.el-tabs__header \.el-tabs__item::before[\s\S]*?height:\s*54%;[\s\S]*?border-radius:\s*999px/);
    assert.match(mciDesign, /\.mci-tabs\.el-tabs--left/);
    assert.match(mciDesign, /\.mci-tabs\.el-tabs--right/);
    assert.match(tags, /mci-tabs mci-tabs--workspace/);
    assert.match(table, /mci-tabs mci-tabs--module/);
    assert.match(diyStyles, /#table-rowlist-tabs:not\(\.mci-tabs\)/);
    assert.match(tableStyles, /\.module-presentation-header\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none/);
    assert.match(tableStyles, /\.module-presentation-copy\s*\{[\s\S]*?background:\s*var\(--mci-presentation-header-bg[\s\S]*?box-shadow:/);
    assert.match(tableStyles, /\.module-presentation-header \.module-metric-item\s*\{[\s\S]*?border:\s*0;[\s\S]*?box-shadow:/);
    assert.match(formStyles, /\.field-form-tabs:not\(\.mci-tabs\)/);
    assert.match(formStyles, /\.el-form-item__label\)[\s\S]*?height:\s*34px;[\s\S]*?margin-bottom:\s*0/);
    assert.match(formStyles, /\.el-date-editor \.el-input__wrapper\)[\s\S]*?height:\s*34px/);
    assert.match(tableStyles, /\.keyword-search[\s\S]*?background:\s*transparent/);
    assert.match(sidebar, /\.el-sub-menu[\s\S]*?border-bottom:\s*0 !important/);
});

test("micro-app hosts and platform pages keep the live theme contract", async function () {
    const [dialogHost, routeHost, runtime, settings, settingsStyles, marketplace] = await Promise.all([
        source("src/views/micro-app/dialog.vue"),
        source("src/views/micro-app/host.vue"),
        readPlatformServiceSource("src/microi.js"),
        readPlatformServiceSource("src/SystemSettings.vue"),
        readPlatformServiceSource("src/system-settings.css"),
        readPlatformServiceSource("src/Marketplace.vue")
    ]);

    for (const host of [dialogHost, routeHost]) {
        assert.match(host, /themeMode:\s*this\.runtimeThemeMode/);
        assert.match(host, /themeColor:\s*this\.runtimeThemeColor/);
        assert.match(host, /new MutationObserver\(\(\) => this\.syncRuntimeTheme\(true\)\)/);
        assert.match(host, /attributeFilter:\s*\["class", "style", "data-theme", "data-mci-palette"\]/);
        assert.match(host, /themePrimaryText:/);
        assert.match(host, /themeTokens:\s*\{ \.\.\.this\.runtimeThemeTokens \}/);
    }
    assert.match(runtime, /export function subscribeContext/);
    assert.match(runtime, /microApp\?\.addDataListener/);
    assert.match(runtime, /microApp\?\.removeDataListener/);
    assert.match(settings, /subscribeContext\(\(nextContext\) => Object\.assign\(context, nextContext\)\)/);
    assert.match(settings, /<style scoped src="\.\/system-settings\.css"><\/style>/);
    assert.match(settingsStyles, /\.system-settings\[data-theme="dark"\]/);
    assert.match(marketplace, /subscribeContext\(next=>Object\.assign\(context,next\),false\)/);
});

test("notification center opens immediately as a unified dialog and badges only actionable messages", async function () {
    const [center, noticeHelper] = await Promise.all([
        source("src/layout/components/BackgroundTaskCenter.vue"),
        source("src/utils/official-app-notice.js")
    ]);
    assert.match(center, /class="microi-notification-dialog mci-unified-dialog"/);
    assert.match(center, /width="80%"/);
    assert.match(center, /\sdraggable[\s\r\n>]/);
    assert.match(center, /@opened="handleCenterOpened"/);
    assert.match(center, /activeTab:\s*"platformMessages"/);
    assert.match(center, /<el-tab-pane name="tasks" lazy>/);
    assert.match(center, /return this\.notificationUnreadCount \+ this\.appNoticeCount/);
    assert.match(center, /return this\.isAdmin && !this\.isOfficialPlatform \? this\.storeNotices\.length : 0/);
    assert.match(noticeHelper, /item\.Status === "Uninstalled" \|\| item\.Status === "Outdated"/);
    assert.match(center, /installOrUpdateAllPlatformApps/);
    assert.match(center, /DiyCommon\.ApiEngine\.RunBackground\([\s\S]*?"bulk-import-microi-store-packages"/);
    assert.match(center, /ApplicationType:\s*"Platform"/);
    assert.match(center, /ConcurrencyKey:\s*"bulk-import-microi-store-packages"/);
    assert.match(center, /return this\.isSuperAdmin && !this\.isOfficialPlatform/);
    assert.match(center, /officialAppExecutionScope\(\)[\s\S]*?this\.invalidateOfficialAppCheckWork\(\);[\s\S]*?this\.stopOfficialAppChecker\(\);[\s\S]*?this\.storeNotices = \[\]/);
    assert.match(center, /checkOfficialApps\(force\)[\s\S]*?if \(this\.officialAppChecksDisposed \|\| !this\.isAdmin \|\| this\.isOfficialPlatform\) \{[\s\S]*?this\.storeNotices = \[\];[\s\S]*?return Promise\.resolve\(\);/);
    assert.match(center, /@row-click="openNotificationDetail"/);
    assert.match(center, /class="microi-message-detail-dialog mci-unified-dialog"/);
});

test("header badges share one visual contract and realtime tooltip uses a triangle", async function () {
    const [navbar, center, theme] = await Promise.all([
        source("src/layout/components/Navbar.vue"),
        source("src/layout/components/BackgroundTaskCenter.vue"),
        source("src/styles/mci-admin-theme.scss")
    ]);

    assert.match(navbar, /popper-class="mci-realtime-tooltip"/);
    assert.match(navbar, /class="mci-header-badge"/);
    assert.match(center, /class="mci-header-badge"/);
    assert.doesNotMatch(center, /task-badge-flash|microi-task-badge-pulse/);
    assert.match(theme, /\.mci-header-badge > \.el-badge__content\.is-fixed/);
    assert.match(theme, /\.mci-realtime-tooltip[\s\S]*?clip-path:\s*polygon\(50% 0, 100% 100%, 0 100%\)/);
});

test("marketplace keeps workflows in a sanitized browser top-layer dialog", async function () {
    const [marketplace, modalStyles, host, safeHtml] = await Promise.all([
        readPlatformServiceSource("src/Marketplace.vue"),
        readPlatformServiceSource("src/marketplace-modal.css"),
        source("src/views/micro-app/host.vue"),
        readPlatformServiceSource("src/safe-html.js")
    ]);
    assert.match(marketplace, /平台官方应用源/);
    assert.match(marketplace, /key:'installed'/);
    assert.match(marketplace, /key:'published'/);
    assert.match(marketplace, /key:'offline'/);
    assert.match(marketplace, /StoreVersionId:selected\.VersionId/);
    assert.match(marketplace, /_PageIndex:versionPageIndex\.value/);
    assert.match(marketplace, /_PageSize:versionPageSize\.value/);
    assert.match(marketplace, /_Keyword:versionKeyword\.value/);
    assert.match(marketplace, /class="version-toolbar"/);
    assert.match(marketplace, /class="version-pager"/);
    assert.match(marketplace, /function clampDrag\(name,shell/);
    assert.match(marketplace, /data-drag-name="detail"/);
    assert.match(marketplace, /window\.addEventListener\('resize',clampOpenDialogs\)/);
    assert.match(marketplace, /sourceCredentialKey\(effectiveSource\.value\)/);
    assert.match(marketplace, /source\?\.HasCredential\?/);
    assert.match(marketplace, /action:'setGlobalOverlay'/);
    assert.match(marketplace, /nativeTopLayer/);
    assert.match(marketplace, /dialog\.showModal\(\)/);
    assert.match(marketplace, /<dialog ref="detailDialog"/);
    assert.match(marketplace, /v-html="detailHtml"/);
    assert.match(marketplace, /sanitizeMarketplaceHtml/);
    assert.doesNotMatch(marketplace, /<p>\{\{\s*detailModel\?\.AppDetail/);
    assert.match(marketplace, /syncModalDocumentScrollLock\(visible\)/);
    assert.match(marketplace, /lockScroll:visible/);
    assert.match(marketplace, /action:'openForm'/);
    assert.doesNotMatch(marketplace, /microi-store-installed|microi-store-published/);
    assert.match(host, /micro-app-host__global-overlay/);
    assert.match(host, /micro-app-host__global-overlay-segment/);
    assert.match(host, /globalOverlaySegments\(\)/);
    assert.match(host, /updateGlobalOverlayHole\(\)/);
    assert.match(host, /syncGlobalOverlayScrollLock\(this\.globalOverlayVisible\)/);
    assert.match(host, /globalOverlayMaskVisible/);
    assert.match(host, /globalOverlayPromote/);
    assert.match(host, /!nativeTopLayer/);
    assert.match(host, /html\.style\.overflow\s*=\s*"hidden"/);
    assert.match(host, /\.micro-app-host--modal-active \.micro-app-host__app/);
    assert.match(host, /pointer-events:\s*none/);
    assert.match(host, /pointer-events:\s*auto/);
    assert.match(modalStyles, /z-index:\s*12000/);
    assert.match(modalStyles, /height:\s*100dvh/);
    assert.match(modalStyles, /dialog\.modal-backdrop::backdrop/);
    assert.match(modalStyles, /browser top layer/);
    assert.match(modalStyles, /\.detail-rich/);
    assert.match(modalStyles, /\.version-toolbar/);
    assert.match(safeHtml, /DOMPurify/);
    assert.match(safeHtml, /FORBID_TAGS/);
    assert.match(safeHtml, /noopener noreferrer nofollow/);
    assert.match(host, /Width:\s*"80%"/);
});

test("loading and high-frequency navigation paths keep the lightweight rendering contracts", async function () {
    const [loadingRuntime, loadingStyles, sidebarItem, sidebar, formSchema, tags] = await Promise.all([
        source("src/utils/mci-loading.js"),
        source("src/styles/mci-loading.scss"),
        source("src/layout/components/Sidebar/Item.vue"),
        source("src/layout/components/Sidebar/index.vue"),
        source("src/views/form-engine/mixins/diy-form-schema.mixin.js"),
        source("src/layout/components/TagsView/index.vue")
    ]);

    assert.match(loadingRuntime, /mci-loading-skeleton--\$\{variant\}/);
    assert.match(loadingStyles, /\.mci-loading-skeleton--table::after\s*\{[\s\S]*?display:\s*none/);
    assert.match(sidebarItem, /const badgeWatchSignature = computed/);
    assert.match(sidebarItem, /watch\(badgeWatchSignature, \(\) => loadBadge\(true\)\)/);
    assert.doesNotMatch(sidebarItem, /watch\([\s\S]{0,300}?deep:\s*true/);
    assert.match(sidebar, /:collapse-transition="false"/);
    assert.match(formSchema, /QueueTabRender\(tabKey\)/);
    assert.match(formSchema, /self\.\$nextTick\(\(\) => \{/);
  assert.match(formSchema, /scheduleFrame\(\(\) => \{[\s\S]*?scheduleFrame\(\(\) => \{/);
    assert.match(formSchema, /EnsureTabRendered\(tabKey\)/);
    assert.doesNotMatch(tags, /\.tags-view-item[\s\S]{0,240}?transition:\s*all/);
});
