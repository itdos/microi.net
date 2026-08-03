import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const API_BASE = process.env.PW_API_BASE || "https://localhost:61501";
const OS_CLIENT = process.env.PW_OS_CLIENT || "iTdos";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "admin";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/screenshots/user-access-key-dynamic"
);

test.use({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});

test.setTimeout(150_000);

async function loginThroughUi(page) {
    await page.goto(`${FRONTEND}/?OsClient=${encodeURIComponent(OS_CLIENT)}`, {
        waitUntil: "domcontentloaded"
    });

    const accountInput = page.locator(
        [
            'input[placeholder*="用户名"]',
            'input[placeholder*="账号"]',
            'input[placeholder*="帐号"]',
            'input[placeholder*="user name" i]',
            'input[placeholder*="username" i]'
        ].join(", ")
    ).first();
    const passwordInput = page.locator('input[type="password"]').first();

    await expect(accountInput).toBeVisible({ timeout: 30_000 });
    await accountInput.fill(ACCOUNT);
    await passwordInput.fill(PASSWORD);

    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate((element) => (
            element.classList.contains("is-checked") ||
            Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!checked) await privacy.click();
    }

    const responsePromise = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /登\s*录/ }).click();
    const response = await responsePromise;
    const result = await response.json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({
        timeout: 30_000
    });
    // 登录响应早于路由回首页的回调完成，需等该回调稳定后再切换目标模块。
    await page.waitForTimeout(1_500);
}

async function gotoModule(page, route) {
    await page.goto(
        `${FRONTEND}/?OsClient=${encodeURIComponent(OS_CLIENT)}#${route}`,
        { waitUntil: "domcontentloaded" }
    );
    await expect(page).toHaveURL(new RegExp(`#${route.replaceAll("/", "\\/")}(?:[?&]|$)`), {
        timeout: 20_000
    });
    await expect(page.locator(".el-loading-mask")).toHaveCount(0, { timeout: 40_000 });
}

async function waitForAccessKeyRowButton(page) {
    const button = page.getByRole("button", { name: "访问密钥", exact: true }).first();
    await expect(button).toBeVisible({ timeout: 40_000 });
    return button;
}

test("系统账号访问密钥由模块 MoreBtns 配置驱动，并在 PC/移动端可用", async ({ page }, testInfo) => {
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    const pageErrors = [];
    const failedPlatformRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
        if (request.url().startsWith(API_BASE)) {
            failedPlatformRequests.push({
                method: request.method(),
                url: request.url(),
                error: request.failure()?.errorText || ""
            });
        }
    });

    await loginThroughUi(page);

    // 1. PC 运行页：尊重菜单的 Table/Card 展示配置，按钮只来自通用 MoreBtns 渲染通道。
    await gotoModule(page, "/mic-sys-user");
    const pcButton = await waitForAccessKeyRowButton(page);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "system-account-pc-dynamic-button.png"),
        fullPage: false
    });
    await pcButton.click();
    const pcDialog = page.locator(".el-dialog").filter({ hasText: "访问密钥只能使用该帐号本来就有的权限" }).first();
    await expect(pcDialog).toBeVisible({ timeout: 30_000 });
    await expect(pcDialog.locator(".diy-custom-dialog__title")).toContainText("访问密钥 -");
    await expect(pcDialog.getByRole("button", { name: "创建访问密钥" })).toBeVisible();
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "access-key-dialog-pc.png"),
        fullPage: false
    });
    await pcDialog.getByRole("button", { name: /^(Close|关闭)$/i }).click();
    await expect(pcDialog).toBeHidden();

    // 2. 模块引擎：真实编辑系统账号模块，确认可维护的行更多 V8 配置中存在该按钮。
    await gotoModule(page, "/mic-module-engine");
    const keyword = page.locator(".keyword-input input").first();
    await expect(keyword).toBeVisible({ timeout: 30_000 });
    await keyword.fill("系统账号");
    // 名称可能被当前语言包翻译为 System Accounts，稳定身份使用唯一模块路由。
    const moduleRow = page.locator(".el-table__body tr").filter({ hasText: "/mic-sys-user" }).first();
    await expect(moduleRow).toBeVisible({ timeout: 40_000 });
    await moduleRow.getByRole("button", { name: /更多|More/ }).click();
    const editAction = page.locator(".global-more-menu:visible .global-more-menu-item").filter({ hasText: /^\s*(编辑|Edit)\s*$/ }).first();
    await expect(editAction).toBeVisible();
    await editAction.click();

    const moduleEditor = page.getByRole("dialog").filter({ hasText: /Edit\s*-\s*Module Engine|编辑.*模块引擎/i }).first();
    await expect(moduleEditor).toBeVisible({ timeout: 40_000 });
    await moduleEditor.getByRole("tab", { name: /^(button|按钮)$/i }).click();
    // 按钮名称是 input 的 value，不属于 tr.textContent，需先按表单值定位再回溯配置行。
    const editorInputs = moduleEditor.locator("input");
    await expect.poll(
        () => editorInputs.evaluateAll((inputs) => inputs.findIndex((input) => input.value === "访问密钥")),
        { timeout: 40_000 }
    ).toBeGreaterThanOrEqual(0);
    const accessKeyInputIndex = await editorInputs.evaluateAll(
        (inputs) => inputs.findIndex((input) => input.value === "访问密钥")
    );
    const accessKeyName = editorInputs.nth(accessKeyInputIndex);
    await expect(accessKeyName).toBeVisible();
    const accessKeyConfigRow = accessKeyName.locator("xpath=ancestor::tr");
    await expect(accessKeyConfigRow).toBeVisible();
    await expect(accessKeyConfigRow.getByRole("button", { name: /编辑\(\d+\)/ })).toHaveCount(2);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "module-engine-access-key-morebtn.png"),
        fullPage: false
    });
    await moduleEditor.getByRole("button", { name: /^(Close|关闭)$/i }).click();
    const leaveConfirm = page.getByRole("dialog", { name: /^(Tips|提示)$/i });
    if (await leaveConfirm.isVisible().catch(() => false)) {
        await leaveConfirm.getByRole("button", { name: /^(OK|Confirm|确定|确认)$/i }).click();
        await expect(leaveConfirm).toBeHidden();
    }

    // 3. 390x844 移动端：同一 MoreBtns 配置由卡片动作区渲染，并打开同一弹窗。
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoModule(page, "/mic-sys-user");
    const mobileButton = await waitForAccessKeyRowButton(page);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "system-account-mobile-dynamic-button-390x844.png"),
        fullPage: false
    });
    await mobileButton.click();
    const mobileDialog = page.locator(".el-dialog").filter({ hasText: "访问密钥只能使用该帐号本来就有的权限" }).first();
    await expect(mobileDialog).toBeVisible({ timeout: 30_000 });
    await expect(mobileDialog.getByRole("button", { name: "创建访问密钥" })).toBeVisible();
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "access-key-dialog-mobile-390x844.png"),
        fullPage: false
    });

    await testInfo.attach("browser-audit", {
        body: Buffer.from(JSON.stringify({ pageErrors, failedPlatformRequests }, null, 2)),
        contentType: "application/json"
    });
    expect(pageErrors, "unexpected browser page errors").toEqual([]);
    expect(failedPlatformRequests, "unexpected failed platform requests").toEqual([]);
});
