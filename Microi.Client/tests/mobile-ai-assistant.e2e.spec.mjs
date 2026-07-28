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
    process.env.PW_SCREENSHOT_DIR || "../.tmp/screenshots"
);

test.use({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});

test.setTimeout(90_000);

function enableAiAssistant(json) {
    if (!json || typeof json !== "object") return json;

    if (json.Data && typeof json.Data === "object" && !Array.isArray(json.Data)) {
        json.Data.IsShowAiAssistant = 1;
    }

    if (json.DataAppend?.SysConfig && typeof json.DataAppend.SysConfig === "object") {
        json.DataAppend.SysConfig.IsShowAiAssistant = 1;
    }

    return json;
}

async function fulfillWithEnabledAi(route) {
    const response = await route.fetch();
    let json;
    try {
        json = enableAiAssistant(await response.json());
    } catch {
        await route.fulfill({ response });
        return;
    }
    await route.fulfill({ response, json });
}

function isAiActionResponse(response, action) {
    if (!/\/api\/ApiEngine\/Run(?:\?|$)/i.test(response.url())) return false;
    try {
        const data = response.request().postDataJSON();
        return (
            data?.ApiEngineKey === "mci_ai_data_assistant" &&
            data?.Action === action
        );
    } catch {
        return false;
    }
}

const isAiBootstrapResponse = (response) => isAiActionResponse(response, "Bootstrap");

test("真实登录后展示独立 AI 槽并打开同协议移动助手", async ({ page }, testInfo) => {
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    const pageErrors = [];
    const failedPlatformRequests = [];
    const consoleErrors = [];
    const semanticAuthFailures = [];
    const responseAudits = [];
    let authPhase = "pre-login";

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
        if (request.url().startsWith(API_BASE)) {
            failedPlatformRequests.push({
                url: request.url(),
                method: request.method(),
                error: request.failure()?.errorText || ""
            });
        }
    });
    page.on("response", (response) => {
        if (!/\/api\//i.test(response.url())) return;
        const audit = response.json().then((json) => {
            const candidates = [json, json?.Data].filter((item) => item && typeof item === "object");
            const denied = candidates.find((item) => (
                [1001, 1002].includes(Number(item.Code)) ||
                /未携带\s*Token|Token\s*失效|身份验证失败/i.test(String(item.Msg || ""))
            ));
            if (denied) {
                semanticAuthFailures.push({
                    phase: authPhase,
                    url: response.url(),
                    status: response.status(),
                    code: Number(denied.Code),
                    msg: String(denied.Msg || "")
                });
            }
        }).catch(() => {});
        responseAudits.push(audit);
    });

    // iTdos 当前配置可保持默认关闭；本用例只在浏览器响应副本中开启，
    // 既验证 feature-on 分支，也不改写远端 Sys_Config。
    await page.route(/\/api\/FormEngine\/GetSysConfig(?:\?|$)/i, fulfillWithEnabledAi);
    await page.route(/\/api\/SysUser\/Login(?:\?|$)/i, fulfillWithEnabledAi);

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
    await expect(passwordInput).toBeVisible();
    await accountInput.fill(ACCOUNT);
    await passwordInput.fill(PASSWORD);

    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const privacyChecked = await privacy.evaluate((element) => (
            element.classList.contains("is-checked") ||
            Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!privacyChecked) await privacy.click();
    }

    const loginResponsePromise = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /登\s*录/ }).click();
    const loginResponse = await loginResponsePromise;
    const loginResult = await loginResponse.json();
    expect(Number(loginResult.Code), loginResult.Msg || "UI login failed").toBe(1);
    authPhase = "post-login";

    const shell = page.locator(".mobile-tabbar-shell");
    const nav = page.locator(".mobile-tabbar");
    const aiEntry = page.locator(".mobile-ai-entry");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(nav).toBeVisible();
    await expect(aiEntry).toBeVisible();
    await expect(page.locator(".el-message, .el-notification")).toHaveCount(0, {
        timeout: 15_000
    });

    const [navBox, aiBox] = await Promise.all([nav.boundingBox(), aiEntry.boundingBox()]);
    expect(navBox).not.toBeNull();
    expect(aiBox).not.toBeNull();
    expect(aiBox.width).toBeGreaterThanOrEqual(54);
    expect(aiBox.height).toBeGreaterThanOrEqual(54);
    expect(aiBox.x - (navBox.x + navBox.width)).toBeGreaterThanOrEqual(6);
    expect(Math.abs(navBox.y + navBox.height - (aiBox.y + aiBox.height))).toBeLessThanOrEqual(4);

    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "mobile-ai-bottom-dock-390x844.png"),
        fullPage: false
    });

    const bootstrapResponsePromise = page.waitForResponse(isAiBootstrapResponse, {
        timeout: 30_000
    });
    await aiEntry.click();
    await expect(page).toHaveURL(/\/mobile\/ai-assistant(?:\?|$)/, { timeout: 20_000 });
    await expect(page.getByTestId("mobile-ai-assistant")).toBeVisible();
    await expect(page.getByText("AI助手", { exact: true })).toBeVisible();

    const bootstrapResponse = await bootstrapResponsePromise;
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrapResult = await bootstrapResponse.json();
    expect(Number(bootstrapResult.Code)).toBe(1);

    await expect(page.getByTestId("mobile-ai-model")).toBeVisible();
    await expect(page.getByTestId("mobile-ai-reasoning")).toBeVisible();
    await expect(page.getByTestId("mobile-ai-new-conversation")).toBeVisible();
    await expect(page.getByTestId("mobile-ai-history")).toBeVisible();
    await expect(page.getByTestId("mobile-ai-input")).toBeVisible();
    await expect(page.getByTestId("mobile-ai-send")).toBeVisible();
    await expect(page.getByText("内容由人工智能生成，请注意甄别")).toBeVisible();

    const historyResponsePromise = page.waitForResponse(
        (response) => isAiActionResponse(response, "History"),
        { timeout: 30_000 }
    );
    await page.getByTestId("mobile-ai-history").click();
    const historyResponse = await historyResponsePromise;
    expect(historyResponse.status()).toBe(200);
    await expect(page.getByRole("complementary", { name: "AI对话记录" })).toBeVisible();
    await page.getByRole("button", { name: "关闭对话记录" }).click();
    await expect(page.getByRole("complementary", { name: "AI对话记录" })).toBeHidden();
    await expect(page.locator(".el-message, .el-notification")).toHaveCount(0, {
        timeout: 15_000
    });

    const viewportFit = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
    }));
    expect(viewportFit.scrollWidth).toBeLessThanOrEqual(viewportFit.innerWidth + 1);

    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "mobile-ai-assistant-390x844.png"),
        fullPage: false
    });

    await Promise.allSettled(responseAudits);
    await testInfo.attach("mobile-ai-browser-events.json", {
        body: JSON.stringify({
            pageErrors,
            failedPlatformRequests,
            semanticAuthFailures,
            consoleErrors
        }, null, 2),
        contentType: "application/json"
    });

    expect(pageErrors).toEqual([]);
    expect(failedPlatformRequests).toEqual([]);
    expect(semanticAuthFailures.filter((item) => item.phase === "post-login")).toEqual([]);
});

test("PC 顶栏机器人打开并拖动完整 AI 助手弹窗", async ({ page }, testInfo) => {
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    const pageErrors = [];
    const failedPlatformRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
        if (request.url().startsWith(API_BASE)) {
            failedPlatformRequests.push({
                url: request.url(),
                method: request.method(),
                error: request.failure()?.errorText || ""
            });
        }
    });

    await page.route(/\/api\/FormEngine\/GetSysConfig(?:\?|$)/i, fulfillWithEnabledAi);
    await page.route(/\/api\/SysUser\/Login(?:\?|$)/i, fulfillWithEnabledAi);
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
    await expect(accountInput).toBeVisible({ timeout: 30_000 });
    await accountInput.fill(ACCOUNT);
    await page.locator('input[type="password"]').first().fill(PASSWORD);

    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const privacyChecked = await privacy.evaluate((element) => (
            element.classList.contains("is-checked") ||
            Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!privacyChecked) await privacy.click();
    }

    const loginResponsePromise = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /登\s*录/ }).click();
    const loginResult = await (await loginResponsePromise).json();
    expect(Number(loginResult.Code), loginResult.Msg || "UI login failed").toBe(1);

    const desktopEntry = page.getByTestId("desktop-ai-entry");
    await expect(page.locator(".navbar-microi")).toBeVisible({ timeout: 30_000 });
    await expect(desktopEntry).toBeVisible();
    await expect(page.locator(".el-message, .el-notification")).toHaveCount(0, {
        timeout: 15_000
    });

    const entryBox = await desktopEntry.boundingBox();
    expect(entryBox).not.toBeNull();
    expect(entryBox.x).toBeGreaterThan(1000);
    expect(entryBox.y).toBeLessThan(60);
    const robotSize = await desktopEntry.locator("img").evaluate((image) => ({
        width: image.naturalWidth,
        height: image.naturalHeight
    }));
    expect(robotSize).toEqual({ width: 256, height: 256 });

    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "desktop-ai-navbar-entry-1440x900.png"),
        fullPage: false
    });

    const bootstrapResponsePromise = page.waitForResponse(isAiBootstrapResponse, {
        timeout: 30_000
    });
    await desktopEntry.click();

    const dialog = page.locator(".desktop-ai-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("AI助手", { exact: true })).toBeVisible();
    await expect(page.getByTestId("mobile-ai-assistant")).toBeVisible();
    await expect(page.getByTestId("mobile-ai-model")).toBeVisible({ timeout: 30_000 });
    expect((await bootstrapResponsePromise).status()).toBe(200);

    const dragHandle = page.getByTestId("desktop-ai-dialog-drag-handle");
    const [beforeDrag, handleBox] = await Promise.all([dialog.boundingBox(), dragHandle.boundingBox()]);
    expect(beforeDrag).not.toBeNull();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
        handleBox.x + handleBox.width / 2 + 90,
        handleBox.y + handleBox.height / 2 + 50,
        { steps: 8 }
    );
    await page.mouse.up();
    const afterDrag = await dialog.boundingBox();
    expect(afterDrag).not.toBeNull();
    expect(Math.abs(afterDrag.x - beforeDrag.x) + Math.abs(afterDrag.y - beforeDrag.y)).toBeGreaterThan(40);

    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "desktop-ai-draggable-dialog-1440x900.png"),
        fullPage: false
    });

    await dialog.locator(".el-dialog__headerbtn").click();
    await expect(dialog).toBeHidden();

    await testInfo.attach("desktop-ai-browser-events.json", {
        body: JSON.stringify({ pageErrors, failedPlatformRequests }, null, 2),
        contentType: "application/json"
    });
    expect(pageErrors).toEqual([]);
    expect(failedPlatformRequests).toEqual([]);
});
