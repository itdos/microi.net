import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const JUNCHI_PASSWORD = process.env.PW_JUNCHI_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/form-ui-acceptance"
);

test.use({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
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

test("本地系统设置：Logo、直线分组、项数、字段搜索与当前记录刷新", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await openTenantRoute(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, "#/system-config?RecordId=a5fabe90-995f-45a0-adb4-606cdb98cdcd");

    await expect(page.locator(".module-form-workbench")).toBeVisible({ timeout: 45_000 });
    await expectHealthyLogo(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".module-form-workbench")).toBeVisible({ timeout: 45_000 });
    await expectHealthyLogo(page);

    const activeSection = page.locator(".diy-form-section-nav__item.active").first();
    await expect(activeSection).toBeVisible();
    const markerRadius = await activeSection.evaluate((element) => getComputedStyle(element, "::before").borderRadius);
    expect(Number.parseFloat(markerRadius)).toBeGreaterThan(0);

    const subtitles = await page.locator(".diy-form-section-nav__copy small").allTextContents();
    expect(subtitles.length).toBeGreaterThan(0);
    expect(subtitles.every((text) => /\d+\s*项/.test(text))).toBe(true);
    expect(subtitles.some((text) => /个字段/.test(text))).toBe(false);
    await expect(page.locator(".diy-form-section-nav__count").first()).toBeVisible();

    const search = page.locator('.form-field-toolbar input[aria-label="搜索当前表单字段"]').first();
    await expect(search).toBeVisible();
    await search.fill("Logo");
    await expect(page.locator(".field-match-count")).toContainText("项匹配");
    await search.clear();
    const refresh = page.getByRole("button", { name: "刷新当前记录", exact: true }).first();
    await refresh.click();
    const skeleton = page.locator(".workbench-skeleton");
    const skeletonShown = await skeleton.waitFor({ state: "visible", timeout: 2_000 }).then(() => true).catch(() => false);
    if (skeletonShown) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01a-system-config-skeleton.png"), fullPage: false });
    }
    await expect(skeleton).toHaveCount(0, { timeout: 30_000 });
    await expect(activeSection).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01b-system-config-workbench.png"), fullPage: false });

    const identityButton = page.getByRole("button", { name: /登录与身份|Login.*Identity/i }).first();
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
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02b-switch-field-config.png"), fullPage: false });
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
    const collapseStyle = await collapse.locator(".diy-collapse-group__header").evaluate((element) => ({
        backgroundColor: getComputedStyle(element).backgroundColor,
        borderColor: getComputedStyle(element).borderColor
    }));
    expect(collapseStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(collapseStyle.borderColor).not.toBe("rgba(0, 0, 0, 0)");

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
    expect(childGeometry, "折叠分组内首个字段与左侧分组线的间距").not.toBeNull();
    expect(childGeometry.inset, JSON.stringify(childGeometry)).toBeGreaterThanOrEqual(12);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-junchi-project-validation.png"), fullPage: false });
    await collapse.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03b-junchi-collapse-group.png"), fullPage: false });
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
