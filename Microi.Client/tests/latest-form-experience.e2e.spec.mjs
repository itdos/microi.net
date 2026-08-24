import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const XJY_PASSWORD = process.env.PW_XJY_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(process.cwd(), process.env.PW_SCREENSHOT_DIR || "../.tmp/latest-form-experience");

test.use({
    viewport: { width: 1366, height: 768 },
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

async function login(page, { osClient, password, apiBase = "" }, captureStates = false) {
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

    if (captureStates) {
        await page.evaluate(() => {
            window.__microiLoginButtonStates = [];
            const read = () => {
                const button = [...document.querySelectorAll("button")]
                    .find((item) => /登录|正在/.test(String(item.textContent || "")));
                const text = String(button?.textContent || "").replace(/\s+/g, "").trim();
                if (text && window.__microiLoginButtonStates.at(-1) !== text) {
                    window.__microiLoginButtonStates.push(text);
                }
            };
            read();
            window.__microiLoginStateObserver = new MutationObserver(read);
            window.__microiLoginStateObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        });
    }

    const responsePromise = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const response = await responsePromise;
    const result = await response.json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.locator(".avatar-container").first()).toBeVisible({ timeout: 45_000 });
    if (!captureStates) return [];
    return page.evaluate(() => {
        window.__microiLoginStateObserver?.disconnect();
        return window.__microiLoginButtonStates || [];
    });
}

async function openTenantRoute(page, tenant, hash) {
    await login(page, tenant);
    await page.goto(`${tenantUrl(tenant.osClient, tenant.apiBase)}${hash}`, { waitUntil: "domcontentloaded" });
}

test("登录完成态保持到工作台接管，退出确认统一为大圆角弹窗", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const states = await login(page, { osClient: "iTdos", password: LOCAL_PASSWORD }, true);
    const busyIndex = states.findIndex((text) => text.includes("正在安全接入"));
    expect(busyIndex, JSON.stringify(states)).toBeGreaterThanOrEqual(0);
    expect(states.slice(busyIndex + 1), JSON.stringify(states)).not.toContain("登录");
    expect(states.some((text) => text.includes("正在加载工作台") || text.includes("正在进入系统")), JSON.stringify(states)).toBeTruthy();

    await page.locator(".avatar-container").first().hover();
    const logout = page.getByRole("menuitem", { name: /退出登录|Log Out/i }).last();
    await expect(logout).toBeVisible({ timeout: 10_000 });
    await logout.click();

    const confirm = page.locator(".el-message-box.mci-unified-message-box").last();
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    const metrics = await confirm.evaluate((element) => {
        const style = getComputedStyle(element);
        const header = element.querySelector(".el-message-box__header");
        const buttons = [...element.querySelectorAll(".el-message-box__btns .el-button")];
        return {
            borderRadius: Number.parseFloat(style.borderRadius),
            width: element.getBoundingClientRect().width,
            headerHeight: header?.getBoundingClientRect().height || 0,
            iconContent: header ? getComputedStyle(header, "::before").content : "",
            buttonHeights: buttons.map((button) => button.getBoundingClientRect().height)
        };
    });
    expect(metrics.borderRadius, JSON.stringify(metrics)).toBeGreaterThanOrEqual(20);
    expect(metrics.width, JSON.stringify(metrics)).toBeGreaterThanOrEqual(480);
    expect(metrics.headerHeight, JSON.stringify(metrics)).toBeGreaterThanOrEqual(78);
    expect(metrics.iconContent, JSON.stringify(metrics)).not.toBe("none");
    expect(metrics.buttonHeights.length, JSON.stringify(metrics)).toBeGreaterThanOrEqual(2);
    expect(Math.min(...metrics.buttonHeights), JSON.stringify(metrics)).toBeGreaterThanOrEqual(42);
    await confirm.screenshot({ path: path.join(SCREENSHOT_DIR, "01-unified-confirm.png") });
    await confirm.getByRole("button", { name: /^(取消|Cancel)$/i }).click();
});

test("表单设计器切到 left 后主区域宽度保持稳定", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await openTenantRoute(
        page,
        { osClient: "iTdos", password: LOCAL_PASSWORD },
        "#/diy/diy-design/cf389aef-72cc-4980-9c5b-143123561ac0?PageType="
    );
    const designerForm = page.locator(".itdos-diy-form").first();
    await expect(designerForm).toBeVisible({ timeout: 60_000 });

    const workbenchGroup = page.getByRole("button", { name: /工作台与分组/ }).last();
    await expect(workbenchGroup).toBeVisible({ timeout: 30_000 });
    await workbenchGroup.click();
    const positionTitle = page.getByText("分组标签位置", { exact: true }).last();
    await expect(positionTitle).toBeVisible({ timeout: 30_000 });
    const positionField = positionTitle.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' el-form-item ')][1]");
    const left = positionField.getByText("left", { exact: true });
    await expect(left).toBeVisible();
    await left.click();

    const main = page.locator(".diy-form-presentation-main").first();
    await expect(main).toBeVisible();
    const widths = [];
    for (let index = 0; index < 8; index += 1) {
        widths.push(await main.evaluate((element) => element.getBoundingClientRect().width));
        await page.waitForTimeout(180);
    }
    const geometry = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
    }));
    expect(Math.max(...widths) - Math.min(...widths), JSON.stringify({ widths, geometry })).toBeLessThanOrEqual(2);
    expect(geometry.scrollWidth, JSON.stringify({ widths, geometry })).toBeLessThanOrEqual(geometry.viewport + 4);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-designer-left-stable.png"), fullPage: false });
});

test("xjy 订单使用标准表单 Banner、只读业务值和单一纵向滚动容器", async ({ page }) => {
    test.skip(!XJY_PASSWORD, "PW_XJY_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const tenant = { osClient: "xjy", apiBase: "https://api.jifulii.com", password: XJY_PASSWORD };
    await openTenantRoute(page, tenant, "#/dingdan");
    const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 60_000 });
    await firstRow.dblclick();

    const overlay = page.locator(".diy-form-container.el-dialog, .diy-form-container.el-drawer").last();
    await expect(overlay).toBeVisible({ timeout: 45_000 });
    await expect(overlay.locator(".diy-standard-form-banner")).toBeVisible({ timeout: 45_000 });
    await expect(overlay.locator(".form-view-renderer")).toHaveCount(0);
    await expect(overlay.getByText("查看记录", { exact: true })).toHaveCount(0);
    await expect(overlay.getByText("收起记录", { exact: true })).toHaveCount(0);

    const readonlyValues = overlay.locator('[data-testid="diy-readonly-value"]:visible');
    await expect(readonlyValues.first()).toBeVisible({ timeout: 30_000 });
    expect(await readonlyValues.count()).toBeGreaterThanOrEqual(5);
    const optionValues = await readonlyValues.evaluateAll((elements) => elements
        .filter((element) => ["Select", "MultipleSelect", "Radio", "Checkbox", "Cascader", "SelectTree", "Department"].includes(element.dataset.component || ""))
        .map((element) => ({ component: element.dataset.component, text: String(element.textContent || "").trim() })));
    expect(optionValues.length, JSON.stringify(optionValues)).toBeGreaterThan(0);
    for (const item of optionValues) {
        expect(item.text, JSON.stringify(optionValues)).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
    }

    const nestedScrollers = await overlay.locator([
        ".diy-form-dialog-scroll-content",
        ".itdos-diy-form",
        ".diy-form-presentation-layout",
        ".field-form-tabs",
        ".field-form-tabs > .el-tabs__content"
    ].join(", ")).evaluateAll((elements) => elements.filter((element) => {
        const style = getComputedStyle(element);
        return ["auto", "scroll"].includes(style.overflowY)
            && element.scrollHeight > element.clientHeight + 2;
    }).map((element) => ({ className: element.className, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight })));
    expect(nestedScrollers, JSON.stringify(nestedScrollers)).toEqual([]);

    const title = overlay.locator(".diy-form-dialog-title__heading > span").first();
    await expect(title).toBeVisible();
    const titleStyle = await title.evaluate((element) => {
        element.textContent = "查看 - 访客预约申请主单，覆盖提交、审批、签到、签离、取消、过期与爽约全生命周期";
        const style = getComputedStyle(element);
        return { whiteSpace: style.whiteSpace, overflow: style.overflow, textOverflow: style.textOverflow };
    });
    expect(titleStyle).toEqual({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-xjy-standard-form.png"), fullPage: false });
});
