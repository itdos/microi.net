import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const EXPECTED_MODE = process.env.PW_EXPECT_MENU_CHILD_MODE || "";
const EXPECTED_STORE_VERSION = process.env.PW_EXPECT_SYS_CONFIG_STORE_VERSION || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/menu-child-expand-mode"
);

test.use({
    viewport: { width: 1600, height: 960 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
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

async function waitForFrame(page, selector) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
        for (const frame of page.frames()) {
            if (await frame.locator(selector).count().catch(() => 0)) return frame;
        }
        await page.waitForTimeout(250);
    }
    throw new Error(`MicroApp selector did not mount: ${selector}`);
}

test("系统设置展示子菜单展开方式，并按配置向下或逐级向右展开", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page);

    const sidebar = page.locator("[data-menu-child-expand-mode]").first();
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
    if (EXPECTED_MODE) {
        await expect(sidebar).toHaveAttribute("data-menu-child-expand-mode", EXPECTED_MODE);
    }

    await page.goto(tenantUrl("#/system-config?RecordId=a5fabe90-995f-45a0-adb4-606cdb98cdcd"), {
        waitUntil: "domcontentloaded"
    });
    await expect(page.locator(".module-form-workbench")).toBeVisible({ timeout: 45_000 });
    await page.locator(".diy-form-section-nav__item")
        .filter({ hasText: /界面风格|Interface Style/i })
        .first()
        .click();

    const setting = page.locator(".el-form-item")
        .filter({ hasText: /菜单子级展开方式/ })
        .first();
    await expect(setting).toBeVisible({ timeout: 30_000 });
    await expect(setting.getByText("向下展开", { exact: true })).toBeVisible();
    await expect(setting.getByText("向右展开", { exact: true })).toBeVisible();
    if (EXPECTED_MODE) {
        const expectedLabel = EXPECTED_MODE === "Right" ? "向右展开" : "向下展开";
        await expect(setting.locator(".el-radio.is-checked").filter({ hasText: expectedLabel })).toBeVisible();
    }
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "system-setting-menu-child-expand-mode.png"),
        fullPage: false
    });

    if (EXPECTED_MODE !== "Right") {
        await expect(page.locator(".sidebar-flyout-root-item:visible")).toHaveCount(0);
        const downwardSubMenu = page.locator(
            '.sidebar-menu-node[data-menu-level="0"] > .el-sub-menu:not(.is-opened)'
        ).first();
        const downwardTitle = downwardSubMenu.locator(":scope > .el-sub-menu__title");
        await expect(downwardTitle).toBeVisible();
        await downwardTitle.click();
        const openedSubMenu = page.locator(
            '.sidebar-menu-node[data-menu-level="0"] > .el-sub-menu.is-opened'
        ).first();
        const openedTitle = openedSubMenu.locator(":scope > .el-sub-menu__title");
        const inlineChildren = openedSubMenu.locator(":scope > .el-menu");
        await expect(inlineChildren).toBeVisible();
        const downwardGeometry = await Promise.all([
            openedTitle.boundingBox(),
            inlineChildren.boundingBox()
        ]);
        expect(downwardGeometry[0]).not.toBeNull();
        expect(downwardGeometry[1]).not.toBeNull();
        expect(downwardGeometry[1].y, JSON.stringify(downwardGeometry)).toBeGreaterThanOrEqual(
            downwardGeometry[0].y + downwardGeometry[0].height - 2
        );
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, "sidebar-menu-downward.png"),
            fullPage: false
        });
        return;
    }

    const flyoutRoot = page.locator(".sidebar-flyout-root-item:visible").first();
    await expect(flyoutRoot).toBeVisible({ timeout: 30_000 });
    await flyoutRoot.hover();
    const panel = page.locator(".mci-sidebar-compact-flyout:visible").first();
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const geometry = await Promise.all([flyoutRoot.boundingBox(), panel.boundingBox()]);
    expect(geometry[0]).not.toBeNull();
    expect(geometry[1]).not.toBeNull();
    expect(geometry[1].x, JSON.stringify(geometry)).toBeGreaterThanOrEqual(
        geometry[0].x + geometry[0].width
    );

    const nestedItem = panel.locator('[aria-haspopup="menu"]').first();
    await expect(nestedItem).toBeVisible();
    await nestedItem.hover();
    const nestedPanel = page.locator(".mci-sidebar-compact-flyout:visible").nth(1);
    await expect(nestedPanel).toBeVisible({ timeout: 10_000 });
    const nestedGeometry = await Promise.all([panel.boundingBox(), nestedPanel.boundingBox()]);
    expect(nestedGeometry[0]).not.toBeNull();
    expect(nestedGeometry[1]).not.toBeNull();
    expect(nestedGeometry[1].x, JSON.stringify(nestedGeometry)).toBeGreaterThanOrEqual(
        nestedGeometry[0].x + nestedGeometry[0].width - 8
    );
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "sidebar-menu-right-flyout.png"),
        fullPage: false
    });
});

test("官方商城回读系统设置应用版本", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD || !EXPECTED_STORE_VERSION, "Password and expected store version are required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page);
    await page.goto(tenantUrl("#/microi-store"), { waitUntil: "domcontentloaded" });
    const store = await waitForFrame(page, ".marketplace");
    const keyword = store.getByPlaceholder("搜索名称、介绍、作者或 Key");
    await expect(keyword).toBeVisible({ timeout: 45_000 });
    await keyword.fill("系统设置");
    await keyword.press("Enter");

    const card = store.locator(".app-card").filter({ hasText: "系统设置" }).first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await expect(card).toContainText("app.microi.sys-config");
    await expect(card.locator(".version-line")).toContainText(`商城版本 ${EXPECTED_STORE_VERSION}`);
    await card.screenshot({
        path: path.join(SCREENSHOT_DIR, "official-store-system-settings-version-card.png")
    });
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "official-store-system-settings-version.png"),
        fullPage: false
    });
});
