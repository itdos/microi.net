import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/platform-shell-acceptance"
);

test.use({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

function tenantUrl(hash = "") {
    return `${FRONTEND}/?OsClient=iTdos${hash}`;
}

async function login(page) {
    await page.goto(tenantUrl(), { waitUntil: "domcontentloaded" });
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill("admin");
    await page.locator('input[type="password"]').first().fill(LOCAL_PASSWORD);

    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate((element) => (
            element.classList.contains("is-checked")
            || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!checked) await privacy.click();
    }

    const responsePromise = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const response = await responsePromise;
    const result = await response.json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
}

async function openRoute(page, hash) {
    await login(page);
    await page.goto(tenantUrl(hash), { waitUntil: "domcontentloaded" });
}

async function waitForFrame(page, selector) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
        for (const frame of page.frames()) {
            if (await frame.locator(selector).count().catch(() => 0)) return frame;
        }
        await page.waitForTimeout(250);
    }
    throw new Error(`MicroApp selector did not mount: ${selector}; frames=${page.frames().map((frame) => frame.url()).join(", ")}`);
}

async function expectUnifiedDialog(dialog, page) {
    const geometry = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const header = element.querySelector(":scope > .el-dialog__header");
        const headerStyle = header ? getComputedStyle(header) : null;
        const overlay = element.closest(".el-overlay-dialog");
        const overlayBox = overlay?.getBoundingClientRect();
        return {
            widthRatio: box.width / window.innerWidth,
            width: box.width,
            viewportWidth: window.innerWidth,
            inlineWidth: element.style.width,
            dialogWidthVar: element.style.getPropertyValue("--el-dialog-width"),
            overlayWidth: overlayBox?.width || 0,
            radius: Number.parseFloat(style.borderTopLeftRadius),
            borderTopWidth: Number.parseFloat(style.borderTopWidth),
            headerBorderTopWidth: headerStyle ? Number.parseFloat(headerStyle.borderTopWidth) : -1,
            headerCursor: headerStyle?.cursor || ""
        };
    });
    expect(geometry.widthRatio, JSON.stringify(geometry)).toBeGreaterThanOrEqual(0.74);
    expect(geometry.widthRatio).toBeLessThanOrEqual(0.82);
    expect(geometry.radius).toBeGreaterThanOrEqual(20);
    expect(geometry.borderTopWidth).toBeLessThanOrEqual(1);
    expect(geometry.headerBorderTopWidth).toBe(0);
    expect(["move", "grab"]).toContain(geometry.headerCursor);

    const overlay = page.locator(".mci-unified-overlay:visible").last();
    await expect(overlay).toBeVisible();
    const overlayStyle = await overlay.evaluate((element) => ({
        position: getComputedStyle(element).position,
        backdropFilter: getComputedStyle(element).backdropFilter || getComputedStyle(element).webkitBackdropFilter
    }));
    expect(["fixed", "absolute"]).toContain(overlayStyle.position);
    expect(typeof overlayStyle.backdropFilter).toBe("string");
}

test("动态菜单首次直达与刷新都重新匹配真实路由而不是404", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await openRoute(page, "#/api-engine");

    const apiHeader = page.locator(".module-presentation-header")
        .filter({ hasText: /接口引擎|API Engine/i })
        .first();
    await expect(apiHeader).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".error-page, .page-404, [data-testid='page-404']")).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(apiHeader).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveURL(/#\/api-engine(?:\?|$)/);
    await expect(page.locator(".error-page, .page-404, [data-testid='page-404']")).toHaveCount(0);
});

test("接口引擎自动添加索引：只使用 sys_apiengine 真实物理字段", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openRoute(page, "#/api-engine");
    const development = page.getByRole("button", { name: /开发设计|Dev Design/i }).first();
    await expect(development).toBeVisible({ timeout: 45_000 });
    await development.click();
    const indexEntry = page.locator(".el-dropdown-menu:visible").getByText(/索引管理|Index Manager/i).first();
    await expect(indexEntry).toBeVisible();
    await indexEntry.click();

    const dialog = page.locator(".el-dialog:visible").filter({ hasText: /索引管理|Index Manager/i }).last();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const responsePromise = page.waitForResponse(
        (response) => /\/api\/FormEngine\/AutoGenerateIndexes(?:\?|$)/i.test(response.url()),
        { timeout: 60_000 }
    );
    const autoAdd = dialog.getByRole("button", { name: /自动添加索引|Auto Add Index/i }).first();
    await autoAdd.click();
    const response = await responsePromise;
    const result = await response.json();
    expect(Number(result.Code), result.Msg || "auto index generation failed").toBe(1);
    expect(Array.isArray(result.Data?.Failed) ? result.Data.Failed : []).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/索引字段[^\n]*OsClient|物理表[^\n]*不存在[^\n]*OsClient/i);
    await expect(autoAdd).toBeEnabled();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04b-api-engine-auto-index.png"), fullPage: false });
});

test("首次进入系统设置：路由内容不整页闪烁且负向毛玻璃配置可见", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await openRoute(page, "#/api-engine");
    await expect(page.locator(".app-main-microi, .mci-route-view-host").first()).toBeVisible({ timeout: 45_000 });

    await page.evaluate(() => {
        const samples = [];
        const startedAt = performance.now();
        window.__microiRouteVisualSamples = samples;
        const sample = () => {
            const host = document.querySelector(".mci-route-view-host")
                || document.querySelector(".app-main-microi");
            const hostBox = host?.getBoundingClientRect();
            const visibleRouteChildren = host
                ? [...host.children].filter((element) => {
                    const style = getComputedStyle(element);
                    const box = element.getBoundingClientRect();
                    return style.display !== "none" && style.visibility !== "hidden"
                        && Number(style.opacity || 1) > 0.01 && box.width > 1 && box.height > 1
                        && !element.classList.contains("mci-loading-skeleton")
                        && element.id !== "MicroiService";
                }).length
                : 0;
            samples.push({
                at: Math.round(performance.now() - startedAt),
                hostWidth: hostBox?.width || 0,
                hostHeight: hostBox?.height || 0,
                visibleRouteChildren,
                pageSkeletons: document.querySelectorAll(
                    ".app-main-microi > .mci-loading-skeleton:not([hidden]), .mci-route-view-host > .mci-loading-skeleton:not([hidden])"
                ).length,
                routeTransitions: document.querySelectorAll(
                    ".fade-transform-leave-active, .fade-transform-enter-active, .fade-transform-enter-from, .fade-transform-leave-to"
                ).length
            });
            if (performance.now() - startedAt < 2_000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        location.hash = "#/system-config?RecordId=a5fabe90-995f-45a0-adb4-606cdb98cdcd";
    });

    await expect(page.locator(".module-form-workbench")).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(2_100);
    const samples = await page.evaluate(() => window.__microiRouteVisualSamples || []);
    const visualSummary = {
        sampleCount: samples.length,
        pageSkeletonFrames: samples.filter((sample) => sample.pageSkeletons > 0).length,
        routeTransitionFrames: samples.filter((sample) => sample.routeTransitions > 0).length,
        blankRouteFrames: samples.filter((sample) => sample.hostWidth > 0
            && sample.hostHeight > 0 && sample.visibleRouteChildren === 0 && sample.pageSkeletons === 0).length
    };
    expect(visualSummary.pageSkeletonFrames, JSON.stringify(visualSummary)).toBe(0);
    expect(visualSummary.routeTransitionFrames, JSON.stringify(visualSummary)).toBe(0);
    expect(
        visualSummary.blankRouteFrames,
        JSON.stringify({ visualSummary, samples: samples.slice(0, 40) })
    ).toBe(0);
    await page.locator(".diy-form-section-nav__item")
        .filter({ hasText: /界面风格|Interface Style/i })
        .first()
        .click();
    await expect(page.locator(".el-form-item")
        .filter({ hasText: /关闭表单遮罩毛玻璃|Disable\s*(?:the\s*)?form\s*mask\s*blur/i })
        .first()).toBeVisible({ timeout: 30_000 });
});

test("统一 Tabs：工作区、表格和表单右侧关系面板使用同一视觉语言与数字角标", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openRoute(page, "#/api-engine");

    const workspaceTabs = page.locator(".parent-tabs.mci-tabs--workspace").first();
    const moduleTabs = page.locator(".table-rowlist-tabs.mci-tabs--module").first();
    await expect(workspaceTabs).toBeVisible({ timeout: 45_000 });
    await expect(moduleTabs).toBeVisible({ timeout: 45_000 });
    for (const tabs of [workspaceTabs, moduleTabs]) {
        const active = tabs.locator(".el-tabs__item.is-active").first();
        const activeBar = tabs.locator(".el-tabs__active-bar").first();
        await expect(active).toBeVisible();
        await expect(activeBar).toBeVisible();
        const style = await active.evaluate((element) => ({
            activeBackground: getComputedStyle(element).backgroundColor,
            activeShadow: getComputedStyle(element).boxShadow,
            indicatorContent: getComputedStyle(element, "::after").content,
            navBackground: getComputedStyle(element.closest(".el-tabs__nav-wrap")).backgroundColor,
            navBorder: Number.parseFloat(getComputedStyle(element.closest(".el-tabs__nav-wrap")).borderTopWidth)
        }));
        expect(style.navBorder).toBe(0);
        expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(style.navBackground);
        expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(style.activeBackground);
        expect(style.activeShadow).toBe("none");
        expect(["none", "normal", ""]).toContain(style.indicatorContent.replaceAll('"', ""));
        const barStyle = await activeBar.evaluate((element) => ({
            display: getComputedStyle(element).display,
            height: Number.parseFloat(getComputedStyle(element).height),
            transitionDuration: getComputedStyle(element).transitionDuration,
            background: getComputedStyle(element).backgroundColor
        }));
        expect(barStyle.display).not.toBe("none");
        expect(barStyle.height).toBeGreaterThanOrEqual(2);
        expect(barStyle.transitionDuration).not.toBe("0s");
        expect(["transparent", "rgba(0, 0, 0, 0)"]).not.toContain(barStyle.background);
    }
    const moduleBar = moduleTabs.locator(".el-tabs__active-bar").first();
    const moduleItems = moduleTabs.locator(".el-tabs__item");
    const beforeTransform = await moduleBar.evaluate((element) => getComputedStyle(element).transform);
    await moduleItems.nth(1).click();
    await expect(moduleItems.nth(1)).toHaveClass(/is-active/);
    await expect.poll(() => moduleBar.evaluate((element) => getComputedStyle(element).transform))
        .not.toBe(beforeTransform);
    const moduleHeader = page.locator(".module-presentation-header.has-metrics").first();
    await expect(moduleHeader).toBeVisible();
    const moduleCards = await moduleHeader.evaluate((header) => {
        const copy = header.querySelector(".module-presentation-copy");
        const metrics = [...header.querySelectorAll(".module-metric-item")];
        return {
            parentBackground: getComputedStyle(header).backgroundColor,
            parentBorder: Number.parseFloat(getComputedStyle(header).borderTopWidth),
            copyBackground: copy ? getComputedStyle(copy).backgroundColor : "",
            copyShadow: copy ? getComputedStyle(copy).boxShadow : "",
            metricCount: metrics.length,
            metricShadows: metrics.map((item) => getComputedStyle(item).boxShadow)
        };
    });
    expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(moduleCards.parentBackground);
    expect(moduleCards.parentBorder).toBe(0);
    expect(["transparent", "rgba(0, 0, 0, 0)"]).not.toContain(moduleCards.copyBackground);
    expect(moduleCards.copyShadow).not.toBe("none");
    expect(moduleCards.metricCount).toBeGreaterThan(0);
    expect(moduleCards.metricShadows.every((value) => value !== "none")).toBe(true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-api-engine-unified-tabs.png"), fullPage: false });

    await page.goto(tenantUrl("#/mic-form-engine"), { waitUntil: "domcontentloaded" });
    const firstCard = page.locator(".box-card.card-redesign:not(.card-skeleton)").first();
    await expect(firstCard).toBeVisible({ timeout: 45_000 });
    await firstCard.getByRole("button", { name: /^(?:编辑|Edit)$/i }).click();
    const rightTabs = page.locator(".form-right-tabs.mci-tabs--right-panel").last();
    await expect(rightTabs).toBeVisible({ timeout: 30_000 });
    await expect(rightTabs.locator(".el-tabs__item")).toHaveCount(3);
    await expect(rightTabs.locator(".mci-tab-badge")).toHaveCount(3);
    await expect(rightTabs.locator(".el-tabs__active-bar").first()).toBeVisible();
    const badges = await rightTabs.locator(".mci-tab-badge").allTextContents();
    expect(badges.every((value) => /^\d+$/.test(value.trim()))).toBe(true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-form-related-tabs-with-counts.png"), fullPage: false });
});

test("通知中心：快速打开80%大圆角可拖动弹层，消息详情保持当前路由", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openRoute(page, "#/api-engine");

    const entry = page.locator(".task-entry").first();
    await expect(entry).toBeVisible({ timeout: 30_000 });
    const startedAt = Date.now();
    await entry.click();
    const dialog = page.locator(".microi-notification-dialog.mci-unified-dialog").last();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    await expectUnifiedDialog(dialog, page);
    await expect(dialog.locator(".notification-tabs.mci-tabs--module")).toBeVisible();

    const originalUrl = page.url();
    const viewMessage = dialog.getByRole("button", { name: "查看", exact: true }).first();
    if (await viewMessage.isVisible().catch(() => false)) {
        await viewMessage.click();
        const detail = page.locator(".microi-message-detail-dialog.mci-unified-dialog").last();
        await expect(detail).toBeVisible({ timeout: 5_000 });
        expect(page.url()).toBe(originalUrl);
        await expect(detail.locator(".message-detail__content")).toBeVisible();
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-notification-center-dialog.png"), fullPage: false });
});

test("数据库定时备份：80%大圆角、无顶部强调线、可拖动且微应用完整加载", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openRoute(page, "#/osclients");

    const backupButton = page.getByRole("button", { name: /数据库定时备份/ }).first();
    await expect(backupButton).toBeVisible({ timeout: 45_000 });
    await backupButton.click();
    const dialog = page.locator(".diy-form-container.mci-unified-dialog").filter({ hasText: "数据库定时备份" }).last();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expectUnifiedDialog(dialog, page);
    const backupFrame = await waitForFrame(page, ".mci-backup-page");
    await expect(backupFrame.locator(".mci-backup-hero")).toBeVisible({ timeout: 30_000 });
    await expect(backupFrame.getByText("备份设置", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-database-backup-dialog.png"), fullPage: false });
});

test("应用商城：官方源、同页工作区、分类分页、完整详情和可拖动源管理", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openRoute(page, "#/microi-store");
    const store = await waitForFrame(page, ".marketplace");

    await expect(store.getByText("平台官方应用源", { exact: true }).first()).toBeVisible({ timeout: 45_000 });
    await expect(store.getByText("吾码官方源", { exact: true })).toHaveCount(0);
    const category = store.locator('select[aria-label="应用分类"]');
    await expect(category).toBeVisible();
    const categoryText = await category.locator("option").allTextContents();
    expect(categoryText).toEqual(expect.arrayContaining(["游戏", "企业应用", "办公协同"]));

    const firstCard = store.locator(".app-card").first();
    await expect(firstCard).toBeVisible({ timeout: 45_000 });
    await expect(firstCard.locator(".preview-wrap img, .preview-fallback")).toBeVisible();
    await expect(firstCard.locator(".official-source-badge")).toContainText("平台官方源");
    await expect(firstCard.locator("button.install")).toHaveCount(0);
    const pager = store.locator('.pager[aria-label="分页"]');
    await expect(pager).toBeVisible();
    await expect(pager.locator('select')).toBeVisible();
    await expect(pager.locator('input[type="number"]')).toBeVisible();

    const routeBeforeModes = page.url();
    await store.getByRole("button", { name: /已经安装应用/ }).click();
    await expect(store.locator(".market-tabs button.active")).toContainText("已经安装应用");
    expect(page.url()).toBe(routeBeforeModes);
    await store.getByRole("button", { name: "发布 / 制作离线包", exact: true }).first().click();
    await expect(store.locator(".market-tabs button.active")).toContainText("发布 / 制作离线包");
    expect(page.url()).toBe(routeBeforeModes);
    await store.getByRole("button", { name: "安装离线包", exact: true }).first().click();
    await expect(store.locator(".offline-panel")).toBeVisible();
    expect(page.url()).toBe(routeBeforeModes);
    await store.getByRole("button", { name: "应用市场", exact: true }).click();
    await expect(firstCard).toBeVisible({ timeout: 45_000 });

    const beforeDetailScrollState = await page.evaluate(() => ({
        htmlComputed: getComputedStyle(document.documentElement).overflow,
        htmlInline: document.documentElement.style.overflow,
        bodyComputed: getComputedStyle(document.body).overflow,
        bodyInline: document.body.style.overflow
    }));
    expect(beforeDetailScrollState.htmlComputed, JSON.stringify(beforeDetailScrollState)).not.toBe("hidden");

    await store.getByRole("button", { name: "查看完整详情", exact: true }).first().click();
    const detail = store.locator(".modal-shell.app-detail");
    const detailBackdrop = store.locator(".modal-backdrop").filter({ has: detail });
    await expect(detail).toBeVisible({ timeout: 30_000 });
    await expect(detail.locator(".detail-fields")).toBeVisible();
    await expect(detail.locator(".versions-panel")).toContainText("选择安装版本");
    const versionToolbar = detail.locator(".version-toolbar");
    const versionKeyword = versionToolbar.getByPlaceholder("版本号、备注、发布人或动作");
    const versionPageSize = versionToolbar.locator("select");
    await expect(versionKeyword).toBeVisible();
    await expect(versionPageSize).toHaveValue("8");

    const isVersionsQuery = (response, expected = {}) => {
        const proxyRequest = /\/api\/MarketplaceSource\/Query(?:\?|$)/i.test(response.url());
        const directRequest = /\/apiengine\/get-microi-store-versions(?:\?|$)/i.test(response.url());
        if (!proxyRequest && !directRequest) return false;
        let payload;
        try {
            payload = response.request().postDataJSON();
        } catch (_) {
            return false;
        }
        const param = proxyRequest ? payload?.Param : payload;
        return (!proxyRequest || payload?.Operation === "Versions")
            && (expected.pageSize === undefined || Number(param?._PageSize) === expected.pageSize)
            && (expected.pageIndex === undefined || Number(param?._PageIndex) === expected.pageIndex)
            && (expected.keyword === undefined || String(param?._Keyword || "") === expected.keyword);
    };
    const pageSizeResponsePromise = page.waitForResponse(
        (response) => isVersionsQuery(response, { pageSize: 5, pageIndex: 1 }),
        { timeout: 30_000 }
    );
    await versionPageSize.selectOption("5");
    const pageSizeResponse = await pageSizeResponsePromise;
    const pageSizeResult = await pageSizeResponse.json();
    expect(Number(pageSizeResult.Code), pageSizeResult.Msg || "version pagination failed").toBe(1);
    expect(Number(pageSizeResult.DataAppend?.PaginationVersion || 0)).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(pageSizeResult.Data) ? pageSizeResult.Data.length : 0).toBeLessThanOrEqual(5);
    await expect(versionToolbar.getByRole("button", { name: "搜索", exact: true })).toBeEnabled();

    const firstVersionLabel = detail.locator(".version-list label").first();
    await expect(firstVersionLabel).toBeVisible();
    const firstVersion = (await firstVersionLabel.locator("b").innerText()).trim();
    const searchResponsePromise = page.waitForResponse(
        (response) => isVersionsQuery(response, { pageSize: 5, pageIndex: 1, keyword: firstVersion }),
        { timeout: 30_000 }
    );
    await versionKeyword.fill(firstVersion);
    await versionToolbar.getByRole("button", { name: "搜索", exact: true }).click();
    const searchResponse = await searchResponsePromise;
    const searchResult = await searchResponse.json();
    expect(Number(searchResult.Code), searchResult.Msg || "version search failed").toBe(1);
    expect(Array.isArray(searchResult.Data) ? searchResult.Data.length : 0).toBeLessThanOrEqual(5);
    await expect(detail.locator(".version-list")).toContainText(firstVersion);

    const clearResponsePromise = page.waitForResponse(
        (response) => isVersionsQuery(response, { pageSize: 5, pageIndex: 1, keyword: "" }),
        { timeout: 30_000 }
    );
    await versionToolbar.getByRole("button", { name: "清空", exact: true }).click();
    await clearResponsePromise;
    const versionPager = detail.locator('.version-pager[aria-label="历史版本分页"]');
    await expect(versionPager).toBeVisible();
    const nextVersionResponsePromise = page.waitForResponse(
        (response) => isVersionsQuery(response, { pageSize: 5, pageIndex: 2, keyword: "" }),
        { timeout: 30_000 }
    );
    await versionPager.getByRole("button", { name: "下一页", exact: true }).click();
    const nextVersionResponse = await nextVersionResponsePromise;
    const nextVersionResult = await nextVersionResponse.json();
    expect(Number(nextVersionResult.Code), nextVersionResult.Msg || "version next page failed").toBe(1);
    expect(Array.isArray(nextVersionResult.Data) ? nextVersionResult.Data.length : 0).toBeLessThanOrEqual(5);
    await expect(versionPager).toContainText("第 2 /");

    const detailHeader = detail.locator(".modal-header.draggable");
    const dragTo = async (clientX, clientY) => {
        const start = await detailHeader.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return { x: box.left + Math.min(120, box.width / 2), y: box.top + Math.min(40, box.height / 2) };
        });
        await detailHeader.dispatchEvent("pointerdown", { button: 0, clientX: start.x, clientY: start.y, pointerId: 7 });
        await store.evaluate(({ x, y }) => {
            window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 7 }));
            window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 7 }));
        }, { x: clientX, y: clientY });
    };
    const expectDetailInViewport = async () => {
        const geometry = await detail.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
        });
        expect(geometry.left, JSON.stringify(geometry)).toBeGreaterThanOrEqual(17);
        expect(geometry.top, JSON.stringify(geometry)).toBeGreaterThanOrEqual(17);
        expect(geometry.right, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewportWidth - 17);
        expect(geometry.bottom, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewportHeight - 17);
    };
    await dragTo(-5_000, -5_000);
    await expectDetailInViewport();
    await dragTo(5_000, 5_000);
    await expectDetailInViewport();
    const globalOverlay = page.locator(".micro-app-host__global-overlay");
    await expect(globalOverlay).toBeVisible();
    await expect(globalOverlay).toHaveCSS("pointer-events", "none");
    await expect(globalOverlay.locator(".micro-app-host__global-overlay-segment")).toHaveCount(4);
    await expect(page.locator(".micro-app-host--modal-active .micro-app-host__app")).toHaveCSS("overflow", "visible");
    await expect(page.locator(".micro-app-host--modal-active .micro-app-host__app")).toHaveCSS("contain", "none");
    const hostScrollLock = await page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).overflow,
        body: getComputedStyle(document.body).overflow,
        scrollY: window.scrollY
    }));
    expect(hostScrollLock.html).toBe("hidden");
    expect(hostScrollLock.body).toBe("hidden");
    const childScrollLock = await store.evaluate(() => ({
        html: getComputedStyle(document.documentElement).overflow,
        body: getComputedStyle(document.body).overflow,
        scrollY: window.scrollY
    }));
    expect(childScrollLock.html).toBe("hidden");
    expect(childScrollLock.body).toBe("hidden");
    const backdropGeometry = await detailBackdrop.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight, zIndex: Number(getComputedStyle(element).zIndex) };
    });
    const hostGeometry = await page.locator(".micro-app-host--modal-active .micro-app-host__app").evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    });
    const globalOverlayGeometry = await globalOverlay.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight, zIndex: Number(getComputedStyle(element).zIndex) };
    });
    expect(Math.abs(globalOverlayGeometry.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(globalOverlayGeometry.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(globalOverlayGeometry.width - globalOverlayGeometry.viewportWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(globalOverlayGeometry.height - globalOverlayGeometry.viewportHeight)).toBeLessThanOrEqual(1);
    expect(globalOverlayGeometry.zIndex).toBeGreaterThanOrEqual(10_000);
    expect(backdropGeometry.left).toBeLessThanOrEqual(hostGeometry.left + 1);
    expect(backdropGeometry.top).toBeLessThanOrEqual(hostGeometry.top + 1);
    expect(backdropGeometry.right).toBeGreaterThanOrEqual(hostGeometry.right - 1);
    expect(backdropGeometry.bottom).toBeGreaterThanOrEqual(Math.min(hostGeometry.bottom, backdropGeometry.viewportHeight) - 1);
    expect(backdropGeometry.zIndex).toBeGreaterThanOrEqual(12_000);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(hostScrollLock.scrollY);
    expect(await store.evaluate(() => window.scrollY)).toBe(childScrollLock.scrollY);
    expect(page.url()).toBe(routeBeforeModes);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-marketplace-detail-top-layer.png"), fullPage: false });
    await detail.getByRole("button", { name: "关闭", exact: true }).first().click({ timeout: 10_000 });
    await expect(globalOverlay).toHaveCount(0);
    await page.waitForTimeout(500);
    const unlockedState = await page.evaluate(() => ({
        htmlComputed: getComputedStyle(document.documentElement).overflow,
        htmlInline: document.documentElement.style.overflow,
        htmlClass: document.documentElement.className,
        bodyComputed: getComputedStyle(document.body).overflow,
        bodyInline: document.body.style.overflow,
        bodyClass: document.body.className,
        visibleElementOverlays: [...document.querySelectorAll(".el-overlay")].filter((element) => {
            const style = getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
        }).length
    }));
    expect(unlockedState.htmlComputed, JSON.stringify(unlockedState)).not.toBe("hidden");

    await store.getByRole("button", { name: "管理商城源", exact: true }).click();
    const sourceDialog = store.locator(".modal-shell.source-editor");
    await expect(sourceDialog).toBeVisible();
    await expect(sourceDialog.getByText("来源修改后立即保存，不再需要“保存全部来源”。", { exact: true })).toBeVisible();
    await expect(sourceDialog.getByText("保存全部来源", { exact: true })).toHaveCount(0);
    await expect(sourceDialog.getByText(/个可访问应用/).first()).toBeVisible();
    const sourceStyle = await sourceDialog.evaluate((element) => ({
        radius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
        cursor: getComputedStyle(element.querySelector(".modal-header.draggable")).cursor
    }));
    expect(sourceStyle.radius).toBeGreaterThanOrEqual(20);
    expect(["move", "grab"]).toContain(sourceStyle.cursor);
    await expect(page.locator(".micro-app-host__global-overlay")).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-marketplace-source-dialog.png"), fullPage: false });
});
