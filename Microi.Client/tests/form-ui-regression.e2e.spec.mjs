import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const JUNCHI_PASSWORD = process.env.PW_JUNCHI_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const CLIENT_ROOT = path.basename(process.cwd()).toLowerCase() === "microi.client"
    ? process.cwd()
    : path.resolve(process.cwd(), "Microi.Client");
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/form-ui-acceptance"
);

test.use({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    permissions: ["clipboard-read", "clipboard-write"],
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

function tenantUrl(osClient, apiBase = "") {
    const query = new URLSearchParams({ OsClient: osClient });
    if (apiBase) query.set("ApiBase", apiBase);
    return `${FRONTEND}/?${query.toString()}`;
}

async function login(page, { osClient, password, apiBase = "" }) {
    await page.goto(tenantUrl(osClient, apiBase), { waitUntil: "domcontentloaded" });
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill("admin");
    await page.locator('input[type="password"]').first().fill(password);

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

async function openTenantRoute(page, tenant, hash) {
    await login(page, tenant);
    await page.goto(`${tenantUrl(tenant.osClient, tenant.apiBase)}${hash}`, { waitUntil: "domcontentloaded" });
}

async function chooseDesignerField(page, fieldName) {
    const selector = page.getByTestId("designer-field-search").first();
    await expect(selector).toBeVisible({ timeout: 45_000 });
    await selector.click();
    const input = selector.locator("input").first();
    await input.fill(fieldName);
    const option = page.locator(".el-select-dropdown:visible .el-select-dropdown__item")
        .filter({ hasText: fieldName })
        .first();
    await expect(option, `designer field option ${fieldName}`).toBeVisible({ timeout: 15_000 });
    await option.click();
    return page.locator(".field-drag-handle.selected-field").first();
}

async function expectHealthyLogo(page) {
    const logo = page.locator("img.sidebar-logo-microi").first();
    await expect(logo).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => logo.evaluate((image) => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        src: image.currentSrc || image.src
    })), { timeout: 20_000 }).toMatchObject({ complete: true });
    const state = await logo.evaluate((image) => ({ naturalWidth: image.naturalWidth, src: image.currentSrc || image.src }));
    expect(state.naturalWidth, `logo failed to load: ${state.src}`).toBeGreaterThan(0);
}

async function waitForSystemSettingsFrame(page) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
        for (const frame of page.frames()) {
            if (await frame.locator(".system-settings").count().catch(() => 0)) return frame;
        }
        await page.waitForTimeout(250);
    }
    throw new Error(`system-settings application did not mount; frames: ${page.frames().map((frame) => frame.url()).join(", ")}`);
}

async function readKeywordSearchMetrics(keywordInput) {
    return keywordInput.evaluate((root) => {
        const input = root.querySelector("input");
        const wrapper = root.querySelector(".el-input__wrapper");
        const prepend = root.querySelector(".el-input-group__prepend");
        const append = root.querySelector(".el-input-group__append");
        const prependButton = prepend?.querySelector("button");
        const appendButton = append?.querySelector("button");
        const parseRgb = (value) => (String(value || "").match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const luminance = (value) => {
            const channels = parseRgb(value).map((channel) => channel / 255).map((channel) => (
                channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
            ));
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const contrast = (foreground, background) => {
            const fg = luminance(foreground);
            const bg = luminance(background);
            return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        };
        const nearestBackground = (element) => {
            let current = element;
            while (current) {
                const value = getComputedStyle(current).backgroundColor;
                if (value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)") return value;
                current = current.parentElement;
            }
            return "rgb(255, 255, 255)";
        };
        const box = (element) => {
            const rect = element?.getBoundingClientRect();
            return rect ? { width: rect.width, height: rect.height } : null;
        };
        const inputBackground = nearestBackground(wrapper || input);
        const placeholderColor = input ? getComputedStyle(input, "::placeholder").color : "";
        const inputColor = input ? getComputedStyle(input).color : "";
        const prependBackground = nearestBackground(prependButton || prepend);
        const appendBackground = nearestBackground(appendButton || append);
        const prependColor = prependButton ? getComputedStyle(prependButton).color : "";
        const appendColor = appendButton ? getComputedStyle(appendButton).color : "";
        return {
            prepend: box(prepend),
            append: box(append),
            input: box(wrapper),
            placeholderContrast: contrast(placeholderColor, inputBackground),
            inputContrast: contrast(inputColor, inputBackground),
            prependContrast: contrast(prependColor, prependBackground),
            appendContrast: contrast(appendColor, appendBackground)
        };
    });
}

async function switchThemeMode(page, mode) {
    await page.evaluate(async (nextMode) => {
        const { setThemeMode } = await import("/src/utils/theme-color.js");
        setThemeMode(nextMode);
    }, mode);
    await expect.poll(() => page.evaluate(() => ({
        mode: document.documentElement.dataset.theme,
        dark: document.documentElement.classList.contains("dark")
    }))).toEqual({ mode, dark: mode === "dark" });
    await page.waitForTimeout(200);
}

async function expectRecordSearch(scope, { dialog = false } = {}) {
    const selector = scope.locator(
        dialog
            ? '.diy-form-record-selector--dialog:visible'
            : '.diy-form-record-selector:visible:not(.diy-form-record-selector--dialog):not(.diy-form-record-selector--mobile)'
    ).first();
    await expect(selector).toBeVisible({ timeout: 30_000 });
    await expect(selector.locator('[aria-label="搜索并切换记录"]').first()).toBeVisible();
    await expect(selector.locator(".el-select input").first()).toBeVisible();
    await expect(selector.locator(".diy-form-record-count")).toContainText(/共\s*\d+\s*条/);
    return selector;
}

async function readPresentationVisualSignature(scope) {
    const nav = scope.locator(".diy-form-section-nav:visible").first();
    await expect(nav).toBeVisible({ timeout: 30_000 });
    return nav.evaluate((element) => {
        const root = element.closest(".diy-form--controlcenter, .diy-form--settingscenter");
        const active = element.querySelector(".diy-form-section-nav__item.active");
        const main = root?.querySelector(".diy-form-presentation-main");
        const style = getComputedStyle(element);
        const activeStyle = active ? getComputedStyle(active) : null;
        const mainStyle = main ? getComputedStyle(main) : null;
        return {
            controlCenter: Boolean(root?.classList.contains("diy-form--controlcenter")),
            navBackground: style.backgroundColor,
            navBorderRadius: style.borderRadius,
            activeBackground: activeStyle?.backgroundColor || "",
            activeBorderRadius: activeStyle?.borderRadius || "",
            mainBackground: mainStyle?.backgroundColor || "",
            mainBorderRadius: mainStyle?.borderRadius || ""
        };
    });
}

async function expectSectionMetadata(scope) {
    const sections = scope.locator(".diy-form-section-nav__item:visible");
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThan(0);
    let requiredTagFound = false;

    for (let index = 0; index < sectionCount; index += 1) {
        const section = sections.nth(index);
        await section.click();
        await expect(section).toHaveClass(/active/);
        const tags = scope.locator(".diy-form-section-head__tags .el-tag:visible");
        await expect(tags.first()).toContainText(/\d+\s*项/);
        if (await tags.count() > 1) {
            await expect(tags.nth(1)).toContainText(/\d+\s*必填项/);
            requiredTagFound = true;
        }
    }

    await sections.first().click();
    return requiredTagFound;
}

test("表单呈现契约：HTML 分组说明、页脚与必填统计由同一 DiyForm 安全渲染", async () => {
    const runtimePath = path.join(CLIENT_ROOT, "src/views/form-engine/form-presentation-runtime.js");
    const [formSource, runtimeSource] = await Promise.all([
        fs.readFile(path.join(CLIENT_ROOT, "src/views/form-engine/diy-form.vue"), "utf8"),
        fs.readFile(runtimePath, "utf8")
    ]);
    const { buildFormPresentationSections } = await import(pathToFileURL(runtimePath).href);
    const sections = buildFormPresentationSections({
        tabs: [{ Id: "security", Name: "安全设置" }],
        groupedFields: {
            security: [
                { Name: "Account", Component: "Text", NotEmpty: true },
                { Name: "Remark", Component: "Textarea", NotEmpty: false }
            ]
        },
        table: {
            Tabs: [{
                Id: "security",
                Name: "安全设置",
                SubtitleHtml: "<strong>{fieldCount}</strong> 项配置",
                SectionSubtitleHtml: "支持 <em>HTML</em> 说明",
                FooterTitle: "安全边界",
                FooterDescriptionHtml: "仅向 <code>admin</code> 展示"
            }]
        },
        config: { RequiredCountText: "{count} 必填项" }
    });

    expect(formSource).toContain('v-safe-html="section.NavigationSubtitleHtml"');
    expect(formSource).toContain('v-safe-html="PresentationNavigationFooter.Html"');
    expect(formSource).toContain('v-safe-html="ActivePresentationSection.SectionSubtitleHtml"');
    expect(formSource).toContain("ActivePresentationSection.RequiredCount > 0");
    expect(runtimeSource).toContain('"{count} 必填项"');
    expect(runtimeSource).toContain("BadgeApiEngineKey");
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
        FieldCount: 2,
        RequiredCount: 1,
        RequiredLabel: "1 必填项",
        NavigationSubtitleHtml: "<strong>2</strong> 项配置",
        SectionSubtitleHtml: "支持 <em>HTML</em> 说明",
        FooterTitle: "安全边界",
        FooterDescriptionHtml: "仅向 <code>admin</code> 展示"
    });
});

test("本地接口引擎：通用关键词搜索在亮色与暗色主题下保持清晰等宽", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/api-engine");
    const keywordInput = page.locator(".diy-table .keyword-search .keyword-input:visible").first();
    await expect(keywordInput).toBeVisible({ timeout: 45_000 });

    const assertMetrics = (metrics, theme) => {
        expect(metrics.prepend, `${theme} prepend geometry`).not.toBeNull();
        expect(metrics.append, `${theme} append geometry`).not.toBeNull();
        expect(Math.abs(metrics.prepend.width - metrics.append.width), `${theme} action widths`).toBeLessThanOrEqual(1);
        expect(metrics.prepend.width, `${theme} action width`).toBeGreaterThanOrEqual(32);
        expect(metrics.prepend.width, `${theme} action width`).toBeLessThanOrEqual(36);
        expect(Math.abs(metrics.prepend.height - metrics.append.height), `${theme} action heights`).toBeLessThanOrEqual(1);
        expect(metrics.placeholderContrast, `${theme} placeholder contrast`).toBeGreaterThanOrEqual(4.5);
        expect(metrics.inputContrast, `${theme} input text contrast`).toBeGreaterThanOrEqual(4.5);
        expect(metrics.prependContrast, `${theme} reset icon contrast`).toBeGreaterThanOrEqual(3);
        expect(metrics.appendContrast, `${theme} search icon contrast`).toBeGreaterThanOrEqual(3);
    };

    await switchThemeMode(page, "light");
    assertMetrics(await readKeywordSearchMetrics(keywordInput), "light");
    await keywordInput.screenshot({ path: path.join(SCREENSHOT_DIR, "00-keyword-search-light.png") });

    await switchThemeMode(page, "dark");
    assertMetrics(await readKeywordSearchMetrics(keywordInput), "dark");
    await keywordInput.screenshot({ path: path.join(SCREENSHOT_DIR, "00-keyword-search-dark.png") });
});

test("本地接口引擎表单：字段说明以紧凑灰字直显，不再使用信息图标", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/api-engine");
    const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 45_000 });
    await firstRow.dblclick();

    const form = page.locator(".diy-form-container.el-dialog, .diy-form-container.el-drawer").last();
    await expect(form).toBeVisible({ timeout: 30_000 });
    const visibleDescriptions = form.locator(".diy-field-description:visible");
    await expect(visibleDescriptions.first()).toBeVisible({ timeout: 30_000 });
    expect(await visibleDescriptions.count()).toBeGreaterThan(0);
    await expect(form.locator(".diy-field-label > .el-icon")).toHaveCount(0);

    const descriptionMetrics = await visibleDescriptions.evaluateAll((elements) => elements.map((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
            className: element.className,
            color: style.color,
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight),
            height: box.height,
            overflow: style.overflow,
            whiteSpace: style.whiteSpace,
            accessibleDescription: element.getAttribute("aria-label") || element.getAttribute("title") || ""
        };
    }));
    for (const metrics of descriptionMetrics) {
        expect(metrics.fontSize, JSON.stringify(metrics)).toBeLessThanOrEqual(11.5);
        expect(metrics.lineHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(15.5);
        expect(metrics.height, JSON.stringify(metrics)).toBeLessThanOrEqual(31);
        expect(metrics.accessibleDescription.length, JSON.stringify(metrics)).toBeGreaterThan(0);
        if (metrics.className.includes("diy-field-description--inline")) {
            expect(metrics.overflow).toBe("hidden");
            expect(metrics.whiteSpace).toBe("nowrap");
        }
    }
    await form.screenshot({ path: path.join(SCREENSHOT_DIR, "00b-api-engine-field-descriptions.png") });
});

test("本地员工表单：日期与普通文本输入等高", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/diy-employee");
    const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 45_000 });
    await firstRow.dblclick();

    const overlay = page.locator(".diy-form-container.el-dialog, .diy-form-container.el-drawer").last();
    await expect(overlay).toBeVisible({ timeout: 30_000 });
    const form = overlay.locator(".itdos-diy-form:visible").first();
    await expect(form).toBeVisible();

    const dateWrapper = form.locator(".el-date-editor .el-input__wrapper:visible").first();
    const textWrapper = form.locator(".el-form-item:visible:not(:has(.el-date-editor)) .el-input__wrapper:visible").first();
    await expect(dateWrapper).toBeVisible();
    await expect(textWrapper).toBeVisible();
    const [dateHeight, textHeight] = await Promise.all([
        dateWrapper.evaluate((element) => element.getBoundingClientRect().height),
        textWrapper.evaluate((element) => element.getBoundingClientRect().height)
    ]);
    expect(Math.abs(dateHeight - textHeight), JSON.stringify({ dateHeight, textHeight })).toBeLessThanOrEqual(1);
});

test("记录工作台：合并头部、表格弹层同构、跨模块通用、移动适配与页签去重", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/system-config");

    await expect(page.locator(".module-form-workbench")).toBeVisible({ timeout: 45_000 });
    await expect.poll(() => page.url(), { timeout: 30_000 }).toMatch(/#\/system-config\?[^#]*RecordId=[^&#]+/);
    await expectHealthyLogo(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".module-form-workbench")).toBeVisible({ timeout: 45_000 });
    await expectHealthyLogo(page);

    const systemTabs = page.locator("#tags-view-container-microi .parent-tabs > .el-tabs__header .el-tabs__item")
        .filter({ hasText: /系统设置|System Settings/i });
    await expect(systemTabs).toHaveCount(1);
    await expect(page.locator(".diy-form-embedded-workbench")).toBeVisible();
    await expect(page.locator(".module-form-workbench .workbench-toolbar")).toHaveCount(0);
    await expect(page.locator(".module-form-workbench").getByText(/切换到经典表格|返回表单工作台/)).toHaveCount(0);

    const embeddedHeader = page.locator(".diy-form-page-header--embedded").first();
    await expect(page.locator(".module-form-workbench .diy-form-page-header--embedded")).toHaveCount(1);
    await expect(embeddedHeader).toBeVisible();
    const embeddedRecordSearch = await expectRecordSearch(embeddedHeader);
    await embeddedRecordSearch.locator(".el-select").click();
    await expect(page.locator(".el-select-dropdown:visible .el-select-dropdown__item").first()).toBeVisible();
    await page.keyboard.press("Escape");
    const headerGeometry = await embeddedHeader.evaluate((root) => {
        const icon = root.querySelector(".diy-form-workbench-title-icon");
        const description = root.querySelector(".diy-form-dialog-title__description");
        const buttons = [...root.querySelectorAll(".form-actions .el-button")]
            .filter((element) => element.getBoundingClientRect().height > 0);
        const primary = buttons.find((element) => element.classList.contains("el-button--primary"));
        const parseRgb = (value) => (String(value || "").match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const luminance = (value) => {
            const channels = parseRgb(value).map((channel) => channel / 255).map((channel) => (
                channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
            ));
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const contrast = (foreground, background) => {
            const fg = luminance(foreground);
            const bg = luminance(background);
            return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        };
        const primaryStyle = primary ? getComputedStyle(primary) : null;
        return {
            iconWidth: icon?.getBoundingClientRect().width || 0,
            iconHeight: icon?.getBoundingClientRect().height || 0,
            iconClass: icon?.querySelector("svg, i")?.getAttribute("class") || "",
            description: description?.textContent?.trim() || "",
            buttonCount: buttons.length,
            buttonHeights: buttons.map((element) => element.getBoundingClientRect().height),
            primaryContrast: primaryStyle ? contrast(primaryStyle.color, primaryStyle.backgroundColor) : 0
        };
    });
    expect(headerGeometry.iconWidth, JSON.stringify(headerGeometry)).toBeGreaterThanOrEqual(40);
    expect(headerGeometry.iconHeight, JSON.stringify(headerGeometry)).toBeGreaterThanOrEqual(40);
    expect(headerGeometry.iconClass, JSON.stringify(headerGeometry)).not.toBe("");
    expect(headerGeometry.description).toContain("原有字段事件、表单事件与权限规则保持不变");
    expect(headerGeometry.buttonCount).toBeGreaterThan(0);
    expect(Math.min(...headerGeometry.buttonHeights), JSON.stringify(headerGeometry)).toBeGreaterThanOrEqual(39);
    expect(headerGeometry.primaryContrast, JSON.stringify(headerGeometry)).toBeGreaterThanOrEqual(4.5);

    const activeSection = page.locator(".diy-form-section-nav__item.active").first();
    await expect(activeSection).toBeVisible();
    const markerRadius = await activeSection.evaluate((element) => getComputedStyle(element, "::before").borderRadius);
    expect(Number.parseFloat(markerRadius)).toBeGreaterThan(0);

    const directWorkbench = page.locator(".module-form-workbench:visible").last();
    const subtitles = await directWorkbench.locator(".diy-form-section-nav__copy small").allTextContents();
    expect(subtitles.length).toBeGreaterThan(0);
    expect(subtitles.every((text) => text.trim().length > 0)).toBe(true);
    expect(subtitles.some((text) => /个字段/.test(text))).toBe(false);
    await expect(directWorkbench.locator(".diy-form-section-nav__count").first()).toBeVisible();
    await expect(directWorkbench.locator(".diy-form-section-nav script, .diy-form-section-head script")).toHaveCount(0);
    await expectSectionMetadata(directWorkbench);
    const directSignature = await readPresentationVisualSignature(directWorkbench);
    expect(directSignature.controlCenter, JSON.stringify(directSignature)).toBe(true);

    const configuredHtml = await directWorkbench.locator(".diy-form-section-nav").evaluate((nav) => ({
        subtitleWithMarkup: [...nav.querySelectorAll(".diy-form-section-nav__copy small")]
            .some((element) => element.children.length > 0),
        footerVisible: Boolean(nav.querySelector(".diy-form-section-nav__footer"))
    }));
    if (configuredHtml.subtitleWithMarkup) {
        await expect(directWorkbench.locator(".diy-form-section-nav__copy > small > *").first()).toBeVisible();
    }
    if (configuredHtml.footerVisible) {
        const footer = directWorkbench.locator(".diy-form-section-nav__footer").first();
        await expect(footer).toBeVisible();
        await expect(footer).not.toBeEmpty();
        await expect(footer.locator("script")).toHaveCount(0);
    }

    const search = page.locator('.diy-form-header-search input[aria-label="搜索当前表单字段"]').first();
    await expect(search).toBeVisible();
    await search.fill("Logo");
    await expect(page.locator(".diy-form-header-search .diy-form-field-search-count")).toContainText("项");
    await search.clear();
    await embeddedHeader.getByRole("button", { name: /^(?:More|更多)$/i }).click();
    const refresh = page.locator(".el-dropdown__popper:visible").last()
        .getByText("刷新当前记录", { exact: true });
    await expect(refresh).toBeVisible();
    await refresh.click();
    await expect(activeSection).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01b-system-config-workbench.png"), fullPage: false });

    const identityButton = page.getByRole("button", { name: /安全与服务接入|Security.*Service Access/i }).first();
    await expect(identityButton).toBeVisible();
    await identityButton.click();
    const settingsFrame = await waitForSystemSettingsFrame(page);
    await expect(settingsFrame.locator(".settings-hero")).toBeVisible({ timeout: 30_000 });
    await expect(settingsFrame.locator(".workspace")).toBeVisible();
    const appGeometry = await settingsFrame.locator(".system-settings").evaluate((root) => {
        const workspace = root.querySelector(".workspace");
        const settingsList = root.querySelector(".settings-list");
        const active = root.querySelector(".workspace > aside > button.active");
        const rootBox = root.getBoundingClientRect();
        const workspaceBox = workspace?.getBoundingClientRect();
        return {
            blankBelow: workspaceBox ? rootBox.bottom - workspaceBox.bottom : Number.POSITIVE_INFINITY,
            listMinHeight: settingsList ? getComputedStyle(settingsList).minHeight : "missing",
            markerRadius: active ? getComputedStyle(active, "::before").borderRadius : "missing",
            markerHeight: active ? Number.parseFloat(getComputedStyle(active, "::before").height) : 0,
            activeHeight: active?.getBoundingClientRect().height || 0
        };
    });
    expect(appGeometry.blankBelow).toBeLessThanOrEqual(80);
    expect(appGeometry.listMinHeight).toBe("0px");
    expect(Number.parseFloat(appGeometry.markerRadius)).toBeGreaterThan(0);
    expect(appGeometry.markerHeight / appGeometry.activeHeight).toBeLessThanOrEqual(0.6);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01c-system-private-settings.png"), fullPage: false });
    const settingsDrawer = page.locator(".el-overlay.is-drawer:visible").last();
    if (await settingsDrawer.count()) {
        const closeDrawer = settingsDrawer.getByRole("button", { name: /Close|关闭/i }).first();
        if (await closeDrawer.isVisible().catch(() => false)) await closeDrawer.click();
        else await page.keyboard.press("Escape");
        await expect(settingsDrawer).toBeHidden({ timeout: 15_000 });
    }

    const systemRecordId = await page.evaluate(() => new URLSearchParams(location.hash.split("?")[1] || "").get("RecordId"));
    expect(systemRecordId).toBeTruthy();
    await page.goto(`${tenantUrl("iTdos")}#/system-config?RecordId=${encodeURIComponent(systemRecordId)}&ViewMode=Table`, {
        waitUntil: "domcontentloaded"
    });
    await expect(page.locator(".module-form-workbench")).toHaveCount(0, { timeout: 45_000 });
    await expect(page.getByText(/返回表单工作台|切换到经典表格/)).toHaveCount(0);
    const tableRow = page.locator(".el-table__body-wrapper tbody tr").first();
    await expect(tableRow).toBeVisible({ timeout: 45_000 });
    await tableRow.dblclick();
    const modernForm = page.locator(".diy-form-container.diy-form-modern-dialog:visible, .diy-form-container.diy-form-modern-drawer:visible").last();
    await expect(modernForm).toBeVisible({ timeout: 30_000 });
    await expect(modernForm.locator(".diy-form-section-nav")).toBeVisible({ timeout: 30_000 });
    await expect(modernForm.locator(".diy-form--controlcenter")).toBeVisible();
    await expect(modernForm.locator(".el-dialog__header, .el-drawer__header")).not.toContainText("当前记录");
    await expectRecordSearch(modernForm, { dialog: true });
    const tableDialogSignature = await readPresentationVisualSignature(modernForm);
    expect(tableDialogSignature).toEqual(directSignature);
    await expect(page.locator(".el-notification:visible, .el-message:visible")
        .filter({ hasText: /404 Request failed/i })).toHaveCount(0, { timeout: 10_000 });
    await modernForm.screenshot({ path: path.join(SCREENSHOT_DIR, "01d-system-config-modern-form.png") });
    await expect(systemTabs).toHaveCount(1);
    const closeModernForm = modernForm.locator(".el-dialog__headerbtn, .el-drawer__close-btn").first();
    if (await closeModernForm.isVisible().catch(() => false)) await closeModernForm.click();
    else await page.keyboard.press("Escape");
    await expect(modernForm).toBeHidden({ timeout: 15_000 });

    const apiRecordId = "01M0E5HKF6E2XQ32P8X1QMH4X5";
    await page.goto(`${tenantUrl("iTdos")}#/api-engine?RecordId=${apiRecordId}`, { waitUntil: "domcontentloaded" });
    const apiWorkbench = page.locator(".module-form-workbench:visible").last();
    await expect(apiWorkbench).toBeVisible({ timeout: 45_000 });
    await expect(apiWorkbench.locator(".diy-form-embedded-workbench")).toBeVisible({ timeout: 45_000 });
    await expect(apiWorkbench.locator(".diy-form-section-nav")).toBeVisible({ timeout: 45_000 });
    await expect(apiWorkbench.locator(".workbench-toolbar")).toHaveCount(0);
    const apiHeader = apiWorkbench.locator(".diy-form-page-header--embedded").first();
    await expect(apiHeader).toBeVisible();
    await expectRecordSearch(apiHeader);
    const apiSignature = await readPresentationVisualSignature(apiWorkbench);
    expect(apiSignature).toEqual(directSignature);
    await expect(apiWorkbench.locator(".diy-form-dialog-title__heading")).not.toContainText(/^记录\s+01M0E5HK/i, {
        timeout: 15_000
    });
    await expect.poll(() => page.evaluate(() => (
        new URLSearchParams(location.hash.split("?")[1] || "").get("RecordId")
    )), { timeout: 15_000 }).toBe(apiRecordId);
    const apiRecordSelect = apiHeader.locator('.diy-form-record-selector .el-select').first();
    await apiRecordSelect.click();
    const nextApiRecord = page.locator('.el-select-dropdown:visible .el-select-dropdown__item:not(.is-selected)').first();
    await expect(nextApiRecord).toBeVisible({ timeout: 15_000 });
    await nextApiRecord.click();
    await expect.poll(() => page.evaluate(() => (
        new URLSearchParams(location.hash.split("?")[1] || "").get("RecordId")
    )), { timeout: 30_000 }).not.toBe(apiRecordId);
    await expect(apiWorkbench.locator(".diy-form-section-nav")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await expect(page.locator(".el-notification:visible, .el-message:visible")
        .filter({ hasText: /NoExistData|Sys_Config/i })).toHaveCount(0);
    await expect(page.locator(".el-notification:visible, .el-message:visible")
        .filter({ hasText: /404 Request failed/i })).toHaveCount(0, { timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01e-api-engine-record-workbench.png"), fullPage: false });

    await page.evaluate(() => {
        window.__microiApiPrintCalls = 0;
        window.print = () => {
            window.__microiApiPrintCalls += 1;
        };
    });
    const apiMore = apiHeader.getByRole("button", { name: /^(?:More|更多)$/i }).last();
    await apiMore.click();
    const apiPrintItem = page.getByRole("menuitem", { name: /^(?:Print|打印)$/i }).last();
    await expect(apiPrintItem).toBeVisible();
    await apiPrintItem.click();
    await expect.poll(() => page.evaluate(() => window.__microiApiPrintCalls), { timeout: 10_000 }).toBe(1);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("diy-form-print-mode"))).toBe(true);
    await page.emulateMedia({ media: "print" });
    const apiPrintGeometry = await apiWorkbench.evaluate((element) => {
        const row = element.querySelector(".page-mode-row");
        const main = row?.querySelector(":scope > .el-col:not(.page-right-col)");
        const right = row?.querySelector(":scope > .page-right-col");
        const printSource = element.querySelector(".diy-code-editor-print-source");
        const editor = element.querySelector(".diy-code-editor .editor-body");
        const rowBox = row?.getBoundingClientRect();
        const mainBox = main?.getBoundingClientRect();
        return {
            rowWidth: rowBox?.width || 0,
            mainWidth: mainBox?.width || 0,
            rightDisplay: right ? getComputedStyle(right).display : "none",
            printSourceDisplay: printSource ? getComputedStyle(printSource).display : "missing",
            printSourceLength: printSource?.textContent?.trim().length || 0,
            editorDisplay: editor ? getComputedStyle(editor).display : "missing"
        };
    });
    expect(apiPrintGeometry.rightDisplay, JSON.stringify(apiPrintGeometry)).toBe("none");
    expect(apiPrintGeometry.mainWidth, JSON.stringify(apiPrintGeometry)).toBeGreaterThanOrEqual(apiPrintGeometry.rowWidth - 2);
    expect(apiPrintGeometry.printSourceDisplay, JSON.stringify(apiPrintGeometry)).toBe("block");
    expect(apiPrintGeometry.printSourceLength, JSON.stringify(apiPrintGeometry)).toBeGreaterThan(20);
    expect(["none", "missing"], JSON.stringify(apiPrintGeometry)).toContain(apiPrintGeometry.editorDisplay);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01g-api-engine-print-preview.png"), fullPage: true });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.emulateMedia({ media: "screen" });
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("diy-form-print-mode"))).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${tenantUrl("iTdos")}#/system-config?RecordId=${encodeURIComponent(systemRecordId)}`, {
        waitUntil: "domcontentloaded"
    });
    const mobileWorkbench = page.locator(".module-form-workbench:visible").last();
    await expect(mobileWorkbench).toBeVisible({ timeout: 45_000 });
    const mobileRecordSearch = mobileWorkbench.locator(".diy-form-record-selector--mobile:visible").first();
    await expect(mobileRecordSearch).toBeVisible();
    await expect(mobileRecordSearch.locator('[aria-label="搜索并切换记录"]').first()).toBeVisible();
    await expect(mobileRecordSearch.locator(".el-select input").first()).toBeVisible();
    const mobileRecordGeometry = await mobileRecordSearch.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        selectWidth: element.querySelector('.el-select')?.getBoundingClientRect().width || 0
    }));
    expect(mobileRecordGeometry.width, JSON.stringify(mobileRecordGeometry)).toBeGreaterThanOrEqual(320);
    expect(mobileRecordGeometry.selectWidth, JSON.stringify(mobileRecordGeometry)).toBeGreaterThanOrEqual(240);
    await expect.poll(() => page.evaluate(() => (
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
        - document.documentElement.clientWidth
    )), { timeout: 15_000 }).toBeLessThanOrEqual(1);
    const mobileNav = mobileWorkbench.locator(".diy-form-section-nav:visible").first();
    await expect(mobileNav).toBeVisible();
    await expect(mobileWorkbench.locator(".mci-loading-skeleton:visible")).toHaveCount(0, { timeout: 30_000 });
    await expect(mobileWorkbench.locator(".diy-form-section-head h3:visible").first()).not.toBeEmpty();
    const mobileGeometry = await mobileNav.evaluate((element) => ({
        overflowX: getComputedStyle(element).overflowX,
        right: element.getBoundingClientRect().right,
        viewport: document.documentElement.clientWidth
    }));
    expect(["auto", "scroll"]).toContain(mobileGeometry.overflowX);
    expect(mobileGeometry.right, JSON.stringify(mobileGeometry)).toBeLessThanOrEqual(mobileGeometry.viewport + 1);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01f-system-config-mobile-workbench.png"), fullPage: true });
});

test("联系人弹层：单分组满宽、紧凑记录工具、原地切换与通用打印", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/contact");

    const table = page.locator(".el-table__body-wrapper").first();
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 45_000 });
    const routeBeforeOpen = new URL(page.url()).hash;
    await firstRow.dblclick();

    const overlay = page.locator(".diy-form-container.diy-form-modern-dialog:visible, .diy-form-container.diy-form-modern-drawer:visible").last();
    await expect(overlay).toBeVisible({ timeout: 30_000 });
    const layout = overlay.locator(".diy-form-presentation-layout.is-control-center:visible").first();
    await expect(layout).toBeVisible();
    const layoutGeometry = await layout.evaluate((element) => {
        const main = element.querySelector(".diy-form-presentation-main");
        const rootBox = element.getBoundingClientRect();
        const mainBox = main?.getBoundingClientRect();
        return {
            navCount: element.querySelectorAll(".diy-form-section-nav").length,
            leftGap: mainBox ? mainBox.left - rootBox.left : Number.POSITIVE_INFINITY,
            mainWidth: mainBox?.width || 0,
            rootWidth: rootBox.width,
            gridTemplateAreas: getComputedStyle(element).gridTemplateAreas
        };
    });
    expect(layoutGeometry.navCount, JSON.stringify(layoutGeometry)).toBe(0);
    expect(Math.abs(layoutGeometry.leftGap), JSON.stringify(layoutGeometry)).toBeLessThanOrEqual(2);
    expect(Math.abs(layoutGeometry.mainWidth - layoutGeometry.rootWidth), JSON.stringify(layoutGeometry)).toBeLessThanOrEqual(2);
    expect(layoutGeometry.gridTemplateAreas, JSON.stringify(layoutGeometry)).toContain("section-main");

    const actions = overlay.locator(".diy-form-dialog-actions:visible").first();
    const more = actions.getByRole("button", { name: /^(?:More|更多)$/i }).first();
    const selector = actions.locator(".diy-form-record-selector--dialog:visible").first();
    const search = actions.locator(".diy-form-header-search:visible").first();
    await expect(more).toBeVisible();
    await expect(selector).toBeVisible();
    await expect(search).toBeVisible();
    const toolGeometry = await actions.evaluate((element) => {
        const box = (selector) => {
            const rect = element.querySelector(selector)?.getBoundingClientRect();
            return rect ? { x: rect.x, width: rect.width, height: rect.height } : null;
        };
        return {
            more: box(".el-dropdown .el-button"),
            selector: box(".diy-form-record-selector--dialog .el-select__wrapper"),
            count: box(".diy-form-record-count"),
            search: box(".diy-form-header-search .el-input__wrapper")
        };
    });
    expect(toolGeometry.more.x, JSON.stringify(toolGeometry)).toBeLessThan(toolGeometry.selector.x);
    expect(toolGeometry.selector.x, JSON.stringify(toolGeometry)).toBeLessThan(toolGeometry.search.x);
    expect(toolGeometry.selector.width, JSON.stringify(toolGeometry)).toBeLessThanOrEqual(230);
    expect(toolGeometry.search.width, JSON.stringify(toolGeometry)).toBeLessThanOrEqual(170);
    for (const key of ["selector", "count", "search"]) {
        expect(Math.abs(toolGeometry[key].height - toolGeometry.more.height), JSON.stringify(toolGeometry)).toBeLessThanOrEqual(1);
    }

    const selectedRecordLabel = async () => (await selector.locator(".el-select__selected-item").allInnerTexts())
        .map((value) => value.trim())
        .find(Boolean) || "";
    const selectedBefore = await selectedRecordLabel();
    expect(selectedBefore).not.toBe("");
    await selector.locator(".el-select").click();
    const nextRecord = page.locator(".el-select-dropdown:visible .el-select-dropdown__item:not(.is-selected)").first();
    await expect(nextRecord).toBeVisible({ timeout: 15_000 });
    await nextRecord.click();
    await expect.poll(selectedRecordLabel, { timeout: 30_000 }).not.toBe(selectedBefore);
    expect(new URL(page.url()).hash).toBe(routeBeforeOpen);
    await expect(table).toBeVisible();
    await expect(overlay).toBeVisible();

    await page.evaluate(() => {
        window.__microiPrintCalls = 0;
        window.print = () => {
            window.__microiPrintCalls += 1;
        };
    });
    await more.click();
    const printItem = page.getByRole("menuitem", { name: /^(?:Print|打印)$/i }).last();
    await expect(printItem).toBeVisible();
    await printItem.click();
    await expect.poll(() => page.evaluate(() => window.__microiPrintCalls), { timeout: 10_000 }).toBe(1);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("diy-form-print-mode"))).toBe(true);
    await page.emulateMedia({ media: "print" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02b-contact-print-preview.png"), fullPage: true });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.emulateMedia({ media: "screen" });
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("diy-form-print-mode"))).toBe(false);
    expect(new URL(page.url()).hash).toBe(routeBeforeOpen);
    await overlay.screenshot({ path: path.join(SCREENSHOT_DIR, "02-contact-dialog-record-print.png") });
});

test("系统设置：安全与服务接入填满宿主可用高度", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/system-config");
    await expect(page.locator(".module-form-workbench")).toBeVisible({ timeout: 45_000 });

    const entry = page.getByRole("button", { name: /安全与服务接入|Security.*Service Access/i }).first();
    await expect(entry).toBeVisible({ timeout: 30_000 });
    await entry.click();
    const settingsFrame = await waitForSystemSettingsFrame(page);
    const settings = settingsFrame.locator(".system-settings");
    await expect(settings).toBeVisible({ timeout: 30_000 });
    await expect(settingsFrame.getByText("安全与服务接入", { exact: true }).first()).toBeVisible();

    const hostBody = page.locator(".diy-custom-dialog__body--micro-app:visible").last();
    const hostApp = hostBody.locator(".micro-app-dialog:visible").first();
    await expect(hostBody).toBeVisible();
    await expect(hostApp).toBeVisible();
    const hostGeometry = await hostBody.evaluate((body) => {
        const app = body.querySelector(".micro-app-dialog");
        const bodyBox = body.getBoundingClientRect();
        const appBox = app?.getBoundingClientRect();
        return {
            bodyHeight: bodyBox.height,
            appHeight: appBox?.height || 0,
            viewportHeight: window.innerHeight,
            blankBelowApp: appBox ? bodyBox.bottom - appBox.bottom : Number.POSITIVE_INFINITY
        };
    });
    expect(hostGeometry.bodyHeight, JSON.stringify(hostGeometry)).toBeGreaterThanOrEqual(hostGeometry.viewportHeight - 162);
    expect(Math.abs(hostGeometry.appHeight - hostGeometry.bodyHeight), JSON.stringify(hostGeometry)).toBeLessThanOrEqual(2);
    expect(hostGeometry.blankBelowApp, JSON.stringify(hostGeometry)).toBeLessThanOrEqual(2);

    const geometry = await settings.evaluate((root) => {
        const workspace = root.querySelector(".workspace");
        const list = root.querySelector(".settings-list");
        const rootBox = root.getBoundingClientRect();
        const workspaceBox = workspace?.getBoundingClientRect();
        return {
            rootTop: rootBox.top,
            rootBottom: rootBox.bottom,
            viewportHeight: document.documentElement.clientHeight,
            blankBelow: workspaceBox ? rootBox.bottom - workspaceBox.bottom : Number.POSITIVE_INFINITY,
            listMinHeight: list ? getComputedStyle(list).minHeight : "missing"
        };
    });
    expect(geometry.rootBottom, JSON.stringify(geometry)).toBeGreaterThanOrEqual(geometry.viewportHeight - 2);
    expect(geometry.blankBelow, JSON.stringify(geometry)).toBeLessThanOrEqual(80);
    expect(geometry.listMinHeight).toBe("0px");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-system-security-service-access.png"), fullPage: false });
});

test("本地员工详情：通用搜索工具栏与日期、单选对齐", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/diy-employee");
    const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 45_000 });
    await firstRow.dblclick();

    const overlay = page.locator(".diy-form-container.el-dialog, .diy-form-container.el-drawer").last();
    await expect(overlay).toBeVisible({ timeout: 30_000 });
    const mask = page.locator(".diy-form-modern-overlay.mci-unified-overlay:visible").last();
    await expect(mask).toBeVisible();
    const maskStyle = await mask.evaluate((element) => ({
        classes: element.className,
        filter: getComputedStyle(element).backdropFilter || getComputedStyle(element).webkitBackdropFilter,
        background: getComputedStyle(element).backgroundColor
    }));
    expect(maskStyle.classes).not.toContain("--plain");
    expect(maskStyle.filter, JSON.stringify(maskStyle)).toMatch(/blur\(/i);
    expect(maskStyle.filter).not.toBe("none");
    const leftTabs = overlay.locator(".field-form-tabs.mci-tabs.el-tabs--left").first();
    await expect(leftTabs).toBeVisible();
    const leftTabStyle = await leftTabs.locator(".el-tabs__item.is-active").first().evaluate((element) => {
        const marker = getComputedStyle(element, "::before");
        const nav = element.closest(".el-tabs__nav-wrap");
        return {
            markerHeight: Number.parseFloat(marker.height),
            markerRadius: Number.parseFloat(marker.borderRadius),
            itemHeight: element.getBoundingClientRect().height,
            activeBackground: getComputedStyle(element).backgroundColor,
            navBackground: nav ? getComputedStyle(nav).backgroundColor : ""
        };
    });
    expect(leftTabStyle.markerHeight / leftTabStyle.itemHeight).toBeLessThanOrEqual(0.6);
    expect(leftTabStyle.markerRadius).toBeGreaterThan(0);
    expect(["transparent", "rgba(0, 0, 0, 0)"]).not.toContain(leftTabStyle.activeBackground);
    expect(["transparent", "rgba(0, 0, 0, 0)"]).not.toContain(leftTabStyle.navBackground);
    const toolbar = overlay.locator(".diy-form-field-search-toolbar");
    await expect(toolbar).toBeVisible();
    const birthField = overlay.locator(".el-form-item").filter({ hasText: /出生日期|Date of birth/i }).first();
    const regularField = overlay.locator(".el-form-item").filter({ hasText: /是否转正|Changed/i }).first();
    await expect(birthField).toBeVisible();
    await expect(regularField).toBeVisible();
    const searchKeyword = (await birthField.locator(".el-form-item__label").innerText()).trim();
    await toolbar.locator("input").fill(searchKeyword);
    await expect(toolbar.locator(".diy-form-field-search-count")).toContainText("项匹配");
    await expect(toolbar.locator(".diy-form-field-search-count")).not.toContainText(/^0\s*项匹配$/);
    await toolbar.locator("input").clear();
    await expect(birthField).toBeVisible();

    for (const [labelText, item] of [["出生日期 / Date of birth", birthField], ["是否转正 / Changed", regularField]]) {
        const alignment = await item.evaluate((element) => {
            const label = element.querySelector(".el-form-item__label");
            const control = element.querySelector(".el-form-item__content");
            if (!label || !control) return null;
            const left = label.getBoundingClientRect();
            const right = control.getBoundingClientRect();
            return Math.abs((left.top + left.height / 2) - (right.top + right.height / 2));
        });
        expect(alignment, `${labelText} label/control center alignment`).not.toBeNull();
        expect(alignment).toBeLessThanOrEqual(1.5);
    }

    const dateAlignment = await birthField.evaluate((element) => {
        const label = element.querySelector(".el-form-item__label");
        const wrapper = element.querySelector(".el-date-editor .el-input__wrapper");
        const icon = element.querySelector(".el-date-editor .el-input__prefix .el-input__icon, .el-date-editor .el-input__prefix-inner");
        const center = (node) => {
            const box = node?.getBoundingClientRect();
            return box ? box.top + box.height / 2 : null;
        };
        return { label: center(label), control: center(wrapper), icon: center(icon) };
    });
    expect(dateAlignment.label).not.toBeNull();
    expect(dateAlignment.control).not.toBeNull();
    expect(dateAlignment.icon).not.toBeNull();
    expect(Math.abs(dateAlignment.label - dateAlignment.control)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(dateAlignment.icon - dateAlignment.control)).toBeLessThanOrEqual(1.5);

    const notifications = page.locator(".el-notification__closeBtn");
    for (let attempt = 0; attempt < 8 && await notifications.count(); attempt += 1) {
        await notifications.first().click({ force: true, timeout: 500 }).catch(() => {});
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-employee-detail.png"), fullPage: false });
});

test("本地表单设计器：开关双击只打开开关专项配置", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(
        page,
        { osClient: "iTdos", password: LOCAL_PASSWORD },
        "#/diy/diy-design/c8570fa6-c10f-4014-8cb4-4b046e7ba69c?PageType="
    );

    const switchField = page.locator(".field-drag-handle").filter({ has: page.locator(".el-switch") }).first();
    await expect(switchField).toBeVisible({ timeout: 45_000 });
    await switchField.dblclick();

    const dialog = page.locator(".el-dialog.mci-unified-dialog.mci-field-config-dialog").filter({ hasText: "开关控件配置" }).last();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText("显示方式", { exact: true })).toBeVisible();
    await expect(dialog.getByText("视觉风格", { exact: true })).toBeVisible();
    await expect(dialog.getByText("开启文案", { exact: true })).toBeVisible();
    await expect(dialog.getByText("关闭文案", { exact: true })).toBeVisible();
    await expect(page.getByText("组件专项配置", { exact: true })).toHaveCount(0);

    const geometry = await dialog.evaluate((element) => {
        const style = getComputedStyle(element);
        const header = element.querySelector(":scope > .el-dialog__header");
        return {
            className: element.className,
            radius: Number.parseFloat(style.borderTopLeftRadius),
            radiusText: style.borderTopLeftRadius,
            headerCursor: header ? getComputedStyle(header).cursor : ""
        };
    });
    expect(geometry.radius, JSON.stringify(geometry)).toBeGreaterThanOrEqual(20);
    expect(["move", "grab"]).toContain(geometry.headerCursor);

    const header = dialog.locator(":scope > .el-dialog__header");
    const headerBox = await header.boundingBox();
    if (headerBox) {
        await page.mouse.move(headerBox.x + 110, headerBox.y + headerBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(headerBox.x + 190, headerBox.y + headerBox.height / 2 + 45, { steps: 8 });
        await page.mouse.up();
    }
    const draggedGeometry = await dialog.evaluate((element) => {
        const style = getComputedStyle(element);
        const title = element.querySelector(":scope > .el-dialog__header > .el-dialog__title");
        return {
            className: element.className,
            radius: Number.parseFloat(style.borderTopLeftRadius),
            width: element.getBoundingClientRect().width,
            eyebrow: title ? getComputedStyle(title, "::before").content : ""
        };
    });
    expect(draggedGeometry.className).toContain("mci-field-config-dialog");
    expect(draggedGeometry.radius, JSON.stringify(draggedGeometry)).toBeGreaterThanOrEqual(20);
    expect(draggedGeometry.width, JSON.stringify(draggedGeometry)).toBeLessThanOrEqual(980);
    expect(draggedGeometry.eyebrow).toContain("FIELD SETTINGS");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02b-switch-field-config.png"), fullPage: false });
});

test("指定表单设计器：单行文本、Tabs276 与 FileUpload20 拖动后保持统一居中大圆角", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(
        page,
        { osClient: "iTdos", password: LOCAL_PASSWORD },
        "#/diy/diy-design/4232ebac-abb7-4981-b0de-a8bdad5dc53a?PageType="
    );

    const checkDialog = async (fieldName, revealTabName = "") => {
        const field = await chooseDesignerField(page, fieldName);
        if (revealTabName) {
            await page.getByRole("tab", { name: revealTabName, exact: false }).last().click();
        }
        await expect(field, `designer field ${fieldName}`).toBeVisible({ timeout: 45_000 });
        await field.scrollIntoViewIfNeeded();
        await field.dblclick();

        // Element Plus rewrites the root class while dragging. The data
        // contract is deliberately outside that computed class list and must
        // remain a stable locator and styling anchor throughout the gesture.
        const dialog = page.locator('.el-dialog[data-mci-dialog-contract="field"]').filter({ hasText: fieldName }).last();
        await expect(dialog, `config dialog ${fieldName}`).toBeVisible({ timeout: 20_000 });
        await expect(dialog.getByText("FIELD SETTINGS", { exact: true })).toBeVisible();
        const before = await dialog.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const body = element.querySelector(":scope > .el-dialog__body");
            const footerButtons = [...element.querySelectorAll(":scope > .el-dialog__footer .el-button")];
            const close = element.querySelector(":scope > .el-dialog__header .el-dialog__headerbtn, :scope > .el-dialog__header .mci-field-config-heading__close");
            const header = element.querySelector(":scope > .el-dialog__header");
            const buttonStyles = footerButtons.map((button) => {
                const buttonStyle = getComputedStyle(button);
                return { height: button.getBoundingClientRect().height, shadow: buttonStyle.boxShadow };
            });
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                radius: Number.parseFloat(style.borderTopLeftRadius),
                className: element.className,
                contract: element.dataset.mciDialogContract,
                bodyBackground: body ? getComputedStyle(body).backgroundColor : "",
                buttonStyles,
                headerCenter: header ? header.getBoundingClientRect().top + header.getBoundingClientRect().height / 2 : 0,
                closeCenter: close ? close.getBoundingClientRect().top + close.getBoundingClientRect().height / 2 : 0
            };
        });
        expect(before.radius, JSON.stringify(before)).toBeGreaterThanOrEqual(20);
        expect(before.contract).toBe("field");
        expect(Math.abs(before.left + before.width / 2 - before.viewportWidth / 2), JSON.stringify(before)).toBeLessThanOrEqual(2);
        expect(Math.abs(before.top + before.height / 2 - before.viewportHeight / 2), JSON.stringify(before)).toBeLessThanOrEqual(2);
        expect(Math.abs(before.headerCenter - before.closeCenter), JSON.stringify(before)).toBeLessThanOrEqual(2);
        expect(before.buttonStyles.length, JSON.stringify(before)).toBeGreaterThanOrEqual(2);
        before.buttonStyles.forEach((button) => {
            expect(button.height, JSON.stringify(before)).toBeGreaterThanOrEqual(40);
            expect(button.shadow, JSON.stringify(before)).not.toBe("none");
        });

        const header = dialog.locator(":scope > .el-dialog__header");
        const headerBox = await header.boundingBox();
        expect(headerBox).not.toBeNull();
        await page.mouse.move(headerBox.x + Math.min(180, headerBox.width / 3), headerBox.y + headerBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(headerBox.x + Math.min(260, headerBox.width / 2), headerBox.y + headerBox.height / 2 + 55, { steps: 10 });
        await page.mouse.up();
        await expect(dialog).toHaveClass(/mci-field-config-dialog/);

        const after = await dialog.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
                left: rect.left,
                top: rect.top,
                radius: Number.parseFloat(style.borderTopLeftRadius),
                borderTopWidth: Number.parseFloat(style.borderTopWidth),
                className: element.className,
                contract: element.dataset.mciDialogContract,
                bodyBackground: getComputedStyle(element.querySelector(":scope > .el-dialog__body")).backgroundColor,
                heading: element.querySelector(":scope > .el-dialog__header .mci-field-config-heading")?.textContent || ""
            };
        });
        expect(Math.abs(after.left - before.left) + Math.abs(after.top - before.top), JSON.stringify({ before, after })).toBeGreaterThan(20);
        expect(after.radius, JSON.stringify(after)).toBeGreaterThanOrEqual(20);
        expect(after.borderTopWidth, JSON.stringify(after)).toBeLessThanOrEqual(1);
        expect(after.className).toContain("mci-field-config-dialog");
        expect(after.contract).toBe("field");
        expect(after.bodyBackground).toBe(before.bodyBackground);
        expect(after.heading).toContain("FIELD SETTINGS");
        expect(after.heading).toContain(fieldName);
        expect(after.heading).toContain("表名：");
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `02c-${fieldName}-after-drag.png`), fullPage: false });
        await dialog.locator(".el-dialog__headerbtn").click();
        await expect(dialog).toBeHidden({ timeout: 10_000 });
    };

    await checkDialog("单行文本", "折叠/Tab分组");
    await checkDialog("Tabs276", "基础控件");
    await checkDialog("FileUpload20", "基础控件");
});

test("指定表单设计器：Autocomplete43 值变更事件保存后刷新仍可回读", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    const routeHash = "#/diy/diy-design/4232ebac-abb7-4981-b0de-a8bdad5dc53a?PageType=";
    const sentinel = `// E2E field V8 round-trip ${Date.now()}\nV8.Form.Autocomplete43Verified = V8.ThisValue;`;
    let originalCode = "";
    let sentinelSaved = false;

    const isTargetFieldListResponse = (response) => {
        if (!/\/api\/FormEngine\/GetDiyFieldList(?:\?|$)/i.test(response.url())) return false;
        try {
            return response.request().postDataJSON()?.TableId === "4232ebac-abb7-4981-b0de-a8bdad5dc53a";
        } catch (error) {
            return false;
        }
    };

    const selectField = async () => {
        await chooseDesignerField(page, "Autocomplete43");
    };
    const openValueChangeEditor = async () => {
        const eventItem = page.locator(".el-form-item").filter({ hasText: "值变更V8事件" }).last();
        await expect(eventItem).toBeVisible({ timeout: 20_000 });
        await eventItem.getByRole("button", { name: /编辑代码|代码设计器/ }).first().click();
        const dialog = page.getByRole("dialog", { name: "编辑代码", exact: true })
            .filter({ has: page.getByRole("button", { name: "确定", exact: true }) })
            .last();
        await expect(dialog).toBeVisible({ timeout: 20_000 });
        const editor = dialog.locator(".monaco-editor").first();
        await expect(editor).toBeVisible({ timeout: 20_000 });
        return { dialog, editor };
    };
    const readMonaco = async (openedEditor) => {
        await expect(openedEditor.editor).toBeVisible({ timeout: 20_000 });
        return page.evaluate(() => {
            const models = window.__monacoEditorInstance?.editor?.getModels?.() || [];
            return models.length ? models[models.length - 1].getValue() : null;
        });
    };
    const writeMonaco = async (openedEditor, code) => {
        await expect(openedEditor.editor).toBeVisible({ timeout: 20_000 });
        await page.evaluate((nextCode) => {
            const models = window.__monacoEditorInstance?.editor?.getModels?.() || [];
            if (!models.length) throw new Error("Rendered Monaco model was not found");
            models[models.length - 1].setValue(nextCode);
        }, code);
        await expect.poll(() => readMonaco(openedEditor), { timeout: 10_000 }).toBe(code);
    };
    const applyCode = async (code) => {
        const openedEditor = await openValueChangeEditor();
        await writeMonaco(openedEditor, code);
        const { dialog } = openedEditor;
        await dialog.getByRole("button", { name: "确定", exact: true }).click();
        await expect(dialog).toBeHidden({ timeout: 10_000 });
    };
    const saveDesigner = async (expectedCode) => {
        const responsePromise = page.waitForResponse(
            (response) => /\/api\/FormEngine\/UptDiyFieldList(?:\?|$)/i.test(response.url()),
            { timeout: 45_000 }
        );
        await page.getByRole("button", { name: /^(保存|Save)$/i }).first().click();
        const response = await responsePromise;
        const requestPayload = response.request().postDataJSON();
        const savedField = requestPayload.FieldList.find((item) => item.Name === "Autocomplete43");
        expect(savedField, "Autocomplete43 must be present in batch save payload").toBeTruthy();
        const config = typeof savedField.Config === "string" ? JSON.parse(savedField.Config) : savedField.Config;
        expect(config.V8Code).toBe(expectedCode);
        const result = await response.json();
        expect(Number(result.Code), result.Msg || "UptDiyFieldList failed").toBe(1);
    };
    const reloadAndReadEditor = async () => {
        // Parse the body as soon as the response completes. Chromium may release
        // the DevTools response resource immediately after a full navigation.
        const resultPromise = page
            .waitForResponse(isTargetFieldListResponse, { timeout: 45_000 })
            .then((response) => response.json());
        await page.reload({ waitUntil: "domcontentloaded" });
        const result = await resultPromise;
        const field = result.Data.find((item) => item.Name === "Autocomplete43");
        expect(field, "Autocomplete43 backend readback").toBeTruthy();
        const config = typeof field.Config === "string" ? JSON.parse(field.Config || "{}") : (field.Config || {});
        await selectField();
        const openedEditor = await openValueChangeEditor();
        const editorValue = await readMonaco(openedEditor);
        await openedEditor.dialog.getByRole("button", { name: "取消", exact: true }).click();
        return { backendCode: config.V8Code || "", editorValue };
    };

    const initialResultPromise = page
        .waitForResponse(isTargetFieldListResponse, { timeout: 45_000 })
        .then((response) => response.json());
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, routeHash);
    const initialResult = await initialResultPromise;
    const initialField = initialResult.Data.find((item) => item.Name === "Autocomplete43");
    expect(initialField, "Autocomplete43 initial backend readback").toBeTruthy();
    const initialConfig = typeof initialField.Config === "string"
        ? JSON.parse(initialField.Config || "{}")
        : (initialField.Config || {});
    originalCode = initialConfig.V8Code || "";
    await selectField();
    const initialEditor = await openValueChangeEditor();
    expect(await readMonaco(initialEditor)).toBe(originalCode);
    await initialEditor.dialog.getByRole("button", { name: "取消", exact: true }).click();

    try {
        await applyCode(sentinel);
        // 只要已经尝试落库，finally 就必须执行原值恢复；即使载荷断言或
        // 响应解析失败，也不能把 E2E 哨兵代码留在共享租户数据中。
        sentinelSaved = true;
        await saveDesigner(sentinel);
        const readback = await reloadAndReadEditor();
        expect(readback.backendCode).toBe(sentinel);
        expect(readback.editorValue).toBe(sentinel);
    } finally {
        if (sentinelSaved) {
            await selectField();
            await applyCode(originalCode);
            await saveDesigner(originalCode);
            const restored = await reloadAndReadEditor();
            expect(restored.backendCode).toBe(originalCode);
            expect(restored.editorValue).toBe(originalCode);
        }
    }
});

test("平台通用 Dialog：代码编辑器具备统一标题、圆角与拖动能力", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(
        page,
        { osClient: "iTdos", password: LOCAL_PASSWORD },
        "#/diy/diy-design/4232ebac-abb7-4981-b0de-a8bdad5dc53a?PageType="
    );
    await chooseDesignerField(page, "Autocomplete43");
    const eventItem = page.locator(".el-form-item").filter({ hasText: "值变更V8事件" }).last();
    await eventItem.getByRole("button", { name: /编辑代码|代码设计器/ }).first().click();
    // Element Plus assigns role=dialog to the overlay container.  The visual
    // contract (radius/header/drag offset) belongs to its inner .el-dialog.
    const dialog = page.locator(".el-dialog.mci-unified-dialog:visible")
        .filter({ hasText: "编辑代码" })
        .last();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const header = dialog.locator(":scope > .el-dialog__header");
    const title = header.locator(":scope > .el-dialog__title");
    const before = await dialog.boundingBox();
    const headerBox = await header.boundingBox();
    expect(before).not.toBeNull();
    expect(headerBox).not.toBeNull();
    await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(headerBox.x + headerBox.width / 2 + 90, headerBox.y + headerBox.height / 2 + 45, { steps: 8 });
    await page.mouse.up();
    const after = await dialog.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(20);
    const contract = await dialog.evaluate((element) => {
        const dialogStyle = getComputedStyle(element);
        const dialogHeader = element.querySelector(":scope > .el-dialog__header");
        const dialogTitle = dialogHeader?.querySelector(":scope > .el-dialog__title");
        return {
            unified: element.classList.contains("mci-unified-dialog"),
            radius: parseFloat(dialogStyle.borderTopLeftRadius),
            icon: dialogHeader ? getComputedStyle(dialogHeader, "::before").content : "none",
            eyebrow: dialogTitle ? getComputedStyle(dialogTitle, "::before").content : "none"
        };
    });
    expect(contract.unified).toBe(true);
    expect(contract.radius).toBeGreaterThanOrEqual(20);
    expect(contract.icon).not.toBe("none");
    expect(contract.eyebrow).toContain("MICROI DIALOG");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02d-generic-code-dialog-after-drag.png"), fullPage: false });
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
});

test("指定表单设计器：复制字段发送完整且字符串化的新增载荷", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    let capturedPayload = null;
    await page.route("**/api/FormEngine/AddDiyField**", async (route) => {
        capturedPayload = route.request().postDataJSON();
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ Code: 0, Msg: "E2E intercepted without writing shared tenant data" })
        });
    });
    await openTenantRoute(
        page,
        { osClient: "iTdos", password: LOCAL_PASSWORD },
        "#/diy/diy-design/4232ebac-abb7-4981-b0de-a8bdad5dc53a?PageType="
    );

    const field = page.locator(".field-drag-handle").filter({ visible: true }).first();
    await expect(field).toBeVisible({ timeout: 45_000 });
    await field.click();
    const duplicate = field.getByTestId("duplicate-field-button");
    await expect(duplicate).toBeVisible({ timeout: 10_000 });
    await duplicate.click();
    await expect.poll(() => capturedPayload, { timeout: 15_000 }).not.toBeNull();

    expect(capturedPayload.TableId).toBe("4232ebac-abb7-4981-b0de-a8bdad5dc53a");
    expect(capturedPayload.Id).toBeUndefined();
    expect(capturedPayload.Name).toMatch(/_Copy\d*$/);
    expect(typeof capturedPayload.Config).toBe("string");
    expect(() => JSON.parse(capturedPayload.Config || "{}")).not.toThrow();
    expect(JSON.stringify(capturedPayload)).not.toContain("[object Object]");
});

test("君驰项目表单：必填内联提示、数字步进无断层、紧凑分组随主题", async ({ page }) => {
    test.skip(!JUNCHI_PASSWORD, "PW_JUNCHI_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const tenant = { osClient: "junchi", apiBase: "https://api.chongstech.com", password: JUNCHI_PASSWORD };
    await openTenantRoute(page, tenant, "#/xiangmuguanli1");
    const addButton = page.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 45_000 });
    await addButton.click();

    const overlay = page.locator(".diy-form-container.el-dialog, .diy-form-container.el-drawer").last();
    await expect(overlay).toBeVisible({ timeout: 30_000 });
    const partyB = overlay.locator(".el-form-item").filter({ hasText: /乙方|Contractor/i }).first();
    await expect(partyB).toBeVisible();
    const partyBInput = partyB.locator("input, textarea").first();
    if (await partyBInput.count()) await partyBInput.fill("");

    await overlay.getByRole("button", { name: /^(?:保存|Save)$/i }).first().click();
    const requiredError = partyB.locator(".el-form-item__error");
    await expect(requiredError).toBeVisible({ timeout: 15_000 });
    const errorGeometry = await partyB.evaluate((element) => {
        const error = element.querySelector(".el-form-item__error");
        const content = element.querySelector(".el-form-item__content");
        if (!error || !content) return null;
        const errorBox = error.getBoundingClientRect();
        const contentBox = content.getBoundingClientRect();
        return {
            insideX: errorBox.left >= contentBox.left && errorBox.right <= contentBox.right + 1,
            insideY: errorBox.top >= contentBox.top && errorBox.bottom <= contentBox.bottom + 1
        };
    });
    expect(errorGeometry).toEqual({ insideX: true, insideY: true });

    const number = overlay.locator(".el-input-number").first();
    await expect(number).toBeVisible();
    const stepperGeometry = await number.evaluate((element) => {
        const up = element.querySelector(".el-input-number__increase");
        const down = element.querySelector(".el-input-number__decrease");
        if (!up || !down) return null;
        const upBox = up.getBoundingClientRect();
        const downBox = down.getBoundingClientRect();
        return {
            seam: Math.abs(upBox.bottom - downBox.top),
            sameLeft: Math.abs(upBox.left - downBox.left),
            sameWidth: Math.abs(upBox.width - downBox.width)
        };
    });
    expect(stepperGeometry).not.toBeNull();
    expect(stepperGeometry.seam).toBeLessThanOrEqual(1);
    expect(stepperGeometry.sameLeft).toBeLessThanOrEqual(1);
    expect(stepperGeometry.sameWidth).toBeLessThanOrEqual(1);

    const collapse = overlay.locator(".diy-collapse-group").first();
    await expect(collapse).toBeVisible();
    const collapseStyle = await collapse.evaluate((element) => ({
        backgroundColor: getComputedStyle(element.querySelector(".diy-collapse-group__header")).backgroundColor,
        borderTopWidth: getComputedStyle(element).borderTopWidth,
        borderRightWidth: getComputedStyle(element).borderRightWidth,
        borderBottomWidth: getComputedStyle(element).borderBottomWidth,
        borderLeftWidth: getComputedStyle(element).borderLeftWidth,
        accentCount: element.querySelectorAll(".diy-collapse-group__accent").length
    }));
    expect(collapseStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(collapseStyle.borderTopWidth).toBe("0px");
    expect(collapseStyle.borderRightWidth).toBe("0px");
    expect(collapseStyle.borderBottomWidth).toBe("0px");
    expect(collapseStyle.borderLeftWidth).toBe("0px");
    expect(collapseStyle.accentCount).toBe(1);

    const firstCollapseChild = overlay.locator(".collapse-group-item:visible").first();
    await expect(firstCollapseChild).toBeVisible();
    const childGeometry = await firstCollapseChild.evaluate((element) => {
        const container = element.querySelector(".container-form-item");
        const item = element.querySelector(".container-form-item > .el-form-item");
        const row = element.closest(".el-row");
        if (!container || !item || !row) return null;
        return {
            className: element.className,
            paddingLeft: getComputedStyle(container).paddingLeft,
            inset: item.getBoundingClientRect().left - row.getBoundingClientRect().left
        };
    });
    expect(childGeometry, "折叠分组内首个字段与分组左侧的间距").not.toBeNull();
    expect(childGeometry.inset, JSON.stringify(childGeometry)).toBeGreaterThanOrEqual(12);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-junchi-project-validation.png"), fullPage: false });
    await collapse.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03b-junchi-collapse-group.png"), fullPage: false });
});

test("君驰托码表单：折叠分组保留装饰短线、无外框且字段间隙为纯白", async ({ page }) => {
    test.skip(!JUNCHI_PASSWORD, "PW_JUNCHI_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const tenant = { osClient: "junchi", apiBase: "https://api.chongstech.com", password: JUNCHI_PASSWORD };
    await openTenantRoute(page, tenant, "#/diy-tuoma");
    const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 60_000 });
    await firstRow.dblclick();

    const overlay = page.locator(".diy-form-container.el-dialog, .diy-form-container.el-drawer").last();
    await expect(overlay).toBeVisible({ timeout: 45_000 });
    const collapse = overlay.locator(".diy-collapse-group").first();
    await expect(collapse).toBeVisible({ timeout: 45_000 });
    await collapse.scrollIntoViewIfNeeded();

    const groups = await overlay.evaluate((root) => {
        const px = (value) => Number.parseFloat(value || "0") || 0;
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const rgb = (value) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = value;
            context.fillRect(0, 0, 1, 1);
            return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
        };
        const luminance = (value) => {
            const channels = rgb(value).map((channel) => channel / 255).map((channel) => (
                channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
            ));
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const contrast = (foreground, background) => {
            const fg = luminance(foreground);
            const bg = luminance(background);
            return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        };
        return Array.from(root.querySelectorAll(".collapse-group-header")).map((headerColumn) => {
            const header = headerColumn.querySelector(".diy-collapse-group");
            const children = [];
            let sibling = headerColumn.nextElementSibling;
            while (sibling && !sibling.classList.contains("collapse-group-header") && !sibling.classList.contains("field-tabs-header")) {
                if (sibling.classList.contains("collapse-group-item")) children.push(sibling);
                sibling = sibling.nextElementSibling;
            }
            const first = children.find((item) => item.classList.contains("collapse-group-row-first") && item.classList.contains("collapse-group-row-start"));
            const last = children.find((item) => item.classList.contains("collapse-group-row-last") && item.classList.contains("collapse-group-row-start"));
            if (!header || !first || !last) {
                return {
                    title: header?.querySelector(".diy-collapse-group__title")?.textContent?.trim() || "",
                    childCount: children.length,
                    firstClass: first?.className || "",
                    lastClass: last?.className || ""
                };
            }
            const headerBox = header.getBoundingClientRect();
            const firstBox = first.getBoundingClientRect();
            const firstBefore = getComputedStyle(first, "::before");
            const lastBefore = getComputedStyle(last, "::before");
            const wrapperLeft = firstBox.left + px(firstBefore.left);
            const wrapperRight = wrapperLeft + px(firstBefore.width);
            const fieldSurface = first.querySelector(".container-form-item");
            const fieldSurfaceBox = fieldSurface?.getBoundingClientRect();
            const horizontalGapElement = fieldSurfaceBox
                ? document.elementFromPoint(firstBox.left + 2, Math.min(firstBox.bottom - 2, fieldSurfaceBox.top + 2))
                : null;
            const verticalGapElement = fieldSurfaceBox
                ? document.elementFromPoint(
                    fieldSurfaceBox.left + Math.min(12, fieldSurfaceBox.width / 2),
                    Math.min(firstBox.bottom - 1, fieldSurfaceBox.bottom + 1)
                )
                : null;
            const headerSurface = header.querySelector(".diy-collapse-group__header");
            const headerTitle = header.querySelector(".diy-collapse-group__title");
            const headerDescription = header.querySelector(".diy-collapse-group__desc");
            const headerBackground = getComputedStyle(headerSurface).backgroundColor;
            const headerStyle = getComputedStyle(header);
            return {
                title: header.querySelector(".diy-collapse-group__title")?.textContent?.trim() || "",
                childCount: children.length,
                firstClass: first.className,
                lastClass: last.className,
                left: Math.abs(headerBox.left - wrapperLeft),
                right: Math.abs(headerBox.right - wrapperRight),
                wrapperBackground: firstBefore.backgroundColor,
                fieldBackground: fieldSurface ? getComputedStyle(fieldSurface).backgroundColor : "",
                itemBackgrounds: Array.from(new Set(children.map((item) => getComputedStyle(item).backgroundColor))),
                fieldBackgrounds: Array.from(new Set(children.map((item) => {
                    const surface = item.querySelector(".container-form-item");
                    return surface ? getComputedStyle(surface).backgroundColor : "";
                }))),
                horizontalGapBackground: horizontalGapElement ? getComputedStyle(horizontalGapElement).backgroundColor : "",
                verticalGapBackground: verticalGapElement ? getComputedStyle(verticalGapElement).backgroundColor : "",
                accentCount: header.querySelectorAll(".diy-collapse-group__accent").length,
                headerBorderTop: headerStyle.borderTopWidth,
                headerBorderRight: headerStyle.borderRightWidth,
                headerBorderBottom: headerStyle.borderBottomWidth,
                headerBorderLeft: headerStyle.borderLeftWidth,
                firstBorderLeft: firstBefore.borderLeftWidth,
                firstBorderRight: firstBefore.borderRightWidth,
                lastBorderBottom: lastBefore.borderBottomWidth,
                lastRadiusLeft: lastBefore.borderBottomLeftRadius,
                lastRadiusRight: lastBefore.borderBottomRightRadius,
                titleContrast: contrast(getComputedStyle(headerTitle).color, headerBackground),
                descriptionContrast: headerDescription ? contrast(getComputedStyle(headerDescription).color, headerBackground) : null
            };
        });
    });
    expect(groups.length, JSON.stringify(groups)).toBeGreaterThanOrEqual(3);
    for (const group of groups) {
        expect(group.childCount, JSON.stringify(groups)).toBeGreaterThan(0);
        expect(group.firstClass, JSON.stringify(groups)).toContain("collapse-group-row-first");
        expect(group.lastClass, JSON.stringify(groups)).toContain("collapse-group-row-last");
        expect(group.left, JSON.stringify(groups)).toBeLessThanOrEqual(1);
        expect(group.right, JSON.stringify(groups)).toBeLessThanOrEqual(1);
        expect(group.wrapperBackground, JSON.stringify(groups)).toBe("rgb(255, 255, 255)");
        expect(group.fieldBackground, JSON.stringify(groups)).toBe("rgb(255, 255, 255)");
        expect(group.itemBackgrounds, JSON.stringify(groups)).toEqual(["rgb(255, 255, 255)"]);
        expect(group.fieldBackgrounds, JSON.stringify(groups)).toEqual(["rgb(255, 255, 255)"]);
        // elementFromPoint only returns a node for groups currently inside the viewport.
        // Off-screen and single-field groups are still covered by the wrapper/item/surface
        // background assertions above; validate actual gap pixels whenever a sample exists.
        if (group.horizontalGapBackground) {
            expect(group.horizontalGapBackground, JSON.stringify(groups)).toBe("rgb(255, 255, 255)");
        }
        if (group.verticalGapBackground) {
            expect(group.verticalGapBackground, JSON.stringify(groups)).toBe("rgb(255, 255, 255)");
        }
        expect(group.accentCount, JSON.stringify(groups)).toBe(1);
        expect(group.headerBorderTop, JSON.stringify(groups)).toBe("0px");
        expect(group.headerBorderRight, JSON.stringify(groups)).toBe("0px");
        expect(group.headerBorderBottom, JSON.stringify(groups)).toBe("0px");
        expect(group.headerBorderLeft, JSON.stringify(groups)).toBe("0px");
        expect(group.firstBorderLeft, JSON.stringify(groups)).toBe("0px");
        expect(group.firstBorderRight, JSON.stringify(groups)).toBe("0px");
        expect(group.lastBorderBottom, JSON.stringify(groups)).toBe("0px");
        expect(group.lastRadiusLeft, JSON.stringify(groups)).not.toBe("0px");
        expect(group.lastRadiusRight, JSON.stringify(groups)).not.toBe("0px");
        expect(group.titleContrast, JSON.stringify(groups)).toBeGreaterThanOrEqual(4.5);
        if (group.descriptionContrast !== null) {
            expect(group.descriptionContrast, JSON.stringify(groups)).toBeGreaterThanOrEqual(4.5);
        }
    }
    expect(
        groups.filter((group) => (
            group.horizontalGapBackground === "rgb(255, 255, 255)"
            && group.verticalGapBackground === "rgb(255, 255, 255)"
        )).length,
        JSON.stringify(groups)
    ).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03c-junchi-tuoma-collapse-white.png"), fullPage: false });
});

test("君驰设计器：双击折叠分组保留图标与视觉风格专项配置", async ({ page }) => {
    test.skip(!JUNCHI_PASSWORD, "PW_JUNCHI_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const tenant = { osClient: "junchi", apiBase: "https://api.chongstech.com", password: JUNCHI_PASSWORD };
    await openTenantRoute(page, tenant, "#/diy/diy-design/970c8ce5-d1c0-481a-8047-dd97e36361a8?PageType=");

    const groupField = page.locator(".field-drag-handle").filter({ has: page.locator(".diy-collapse-group") }).first();
    await expect(groupField).toBeVisible({ timeout: 45_000 });
    await groupField.dblclick();
    const dialog = page.getByRole("dialog").filter({ hasText: "折叠分组配置" }).last();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.locator(".el-form-item").filter({ hasText: /^\s*图标/ })).toBeVisible();
    await expect(dialog.locator(".el-form-item").filter({ hasText: /^\s*视觉风格/ })).toBeVisible();
    await expect(dialog.getByText("显示字段数量", { exact: true })).toBeVisible();
    await expect(page.getByText("组件专项配置", { exact: true })).toHaveCount(0);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-junchi-designer-collapse-config.png"), fullPage: false });
});
