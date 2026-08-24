import { expect, test } from "@playwright/test";

const WEB_BASE = process.env.PW_PERSONAL_SETTINGS_WEB_BASE || "http://127.0.0.1:5180";
const API_BASE = process.env.PW_PERSONAL_SETTINGS_API_BASE || "https://api.chongstech.com";
const OS_CLIENT = process.env.PW_PERSONAL_SETTINGS_OSCLIENT || "junchi";
const ACCOUNT = process.env.PW_PERSONAL_SETTINGS_ACCOUNT || "admin";
const PASSWORD = process.env.PW_PERSONAL_SETTINGS_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_PERSONAL_SETTINGS_BROWSER_CHANNEL || "";

test.use({
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});

function runtimeUrl(hashPath) {
    const query = new URLSearchParams({ ApiBase: API_BASE, OsClient: OS_CLIENT });
    return `${WEB_BASE}/?${query.toString()}#${hashPath}`;
}

async function login(page) {
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30000 });
    await account.fill(ACCOUNT);
    await page.locator('input[type="password"]').fill(PASSWORD);

    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate(element => (
            element.classList.contains("is-checked")
            || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!checked) await privacy.click();
    }

    const loginResponsePromise = page.waitForResponse(
        response => /\/api\/SysUser\/Login/i.test(response.url()),
        { timeout: 30000 }
    );
    await page.locator("button.login-button").click();
    const result = await (await loginResponsePromise).json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.locator("#divLogin")).toHaveCount(0, { timeout: 30000 });
}

function field(page, label) {
    return page.locator("label").filter({ has: page.locator("span", { hasText: label }) }).first();
}

async function fieldControlValues(page, label) {
    return field(page, label).locator("input, select, textarea").evaluateAll(elements => elements
        .filter(element => {
            const style = window.getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
        })
        .map(element => ({
            tag: element.tagName.toLowerCase(),
            type: element.getAttribute("type") || "",
            value: element.value
        })));
}

test("Junchi personal center exposes safe self-service fields and cross-device visual preferences", async ({ browser, page }, testInfo) => {
    test.skip(!PASSWORD, "PW_PERSONAL_SETTINGS_PASSWORD is required for the real UI login.");
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 960 });

    await page.goto(runtimeUrl("/login"), { waitUntil: "domcontentloaded" });
    await login(page);
    await page.goto(runtimeUrl("/micro-app/microi-platform-service/personal-settings"), {
        waitUntil: "domcontentloaded"
    });

    await expect(page.getByText("个人资料", { exact: true }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("DiyToken 身份", { exact: true })).toBeVisible();

    for (const label of ["显示名称", "邮箱", "性别", "界面语言"]) {
        await expect(field(page, label)).toBeVisible();
        await expect(field(page, label).locator("input, select").first()).toBeEnabled();
    }
    for (const label of ["登录账号", "手机号", "所属部门", "当前角色"]) {
        await expect(field(page, label)).toBeVisible();
        await expect(field(page, label).locator("input").first()).toBeDisabled();
    }
    await expect(page.getByText(/^Level$/i)).toHaveCount(0);

    const profileResponsePromise = page.waitForResponse(
        response => response.request().method() === "POST"
            && /\/api\/SysUser\/UpdateCurrentProfile/i.test(response.url()),
        { timeout: 30000 }
    );
    await page.getByRole("button", { name: "保存资料" }).click();
    const profileResponse = await profileResponsePromise;
    const profileResult = await profileResponse.json();
    expect(profileResponse.status(), JSON.stringify(profileResult)).toBe(200);
    expect(Number(profileResult.Code), profileResult.Msg || "个人资料保存失败").toBe(1);
    expect(String(profileResult.Msg || "")).toMatch(/保存/);

    await page.getByText("偏好与终端", { exact: true }).first().click();
    await expect(page.getByText("sys_user 个人设置", { exact: true })).toBeVisible();
    for (const label of ["主题色", "浅色 / 深色", "菜单子级展开方式", "桌面模式", "登录后首页", "桌面背景", "桌面任务栏菜单"]) {
        await expect(field(page, label)).toBeVisible();
    }
    const savePreferences = page.getByRole("button", { name: "保存全部个人偏好" });
    await expect(savePreferences).toBeVisible();
    const preferenceResponsePromise = page.waitForResponse(
        response => response.request().method() === "POST"
            && /\/apiengine\/platform-user-update-preferences(?:[/?#]|$)/i.test(response.url()),
        { timeout: 30000 }
    );
    await savePreferences.click();
    const preferenceResponse = await preferenceResponsePromise;
    const preferenceBody = await preferenceResponse.text();
    expect(preferenceResponse.status(), preferenceBody || "preference ApiEngine returned an empty response").toBe(200);
    expect(preferenceBody, "preference ApiEngine returned an empty response").not.toBe("");
    const preferenceResult = JSON.parse(preferenceBody);
    expect(Number(preferenceResult.Code), preferenceResult.Msg || "个人偏好保存失败").toBe(1);
    expect(String(preferenceResult.Msg || "")).toMatch(/保存/);

    const preferenceLabels = [
        "主题色",
        "浅色 / 深色",
        "菜单子级展开方式",
        "桌面模式",
        "登录后首页",
        "桌面背景",
        "桌面任务栏菜单"
    ];
    const expectedPreferences = {};
    for (const label of preferenceLabels) {
        expectedPreferences[label] = await fieldControlValues(page, label);
    }

    const freshContext = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
        const freshPage = await freshContext.newPage();
        await freshPage.setViewportSize({ width: 1440, height: 960 });
        await freshPage.goto(runtimeUrl("/login"), { waitUntil: "domcontentloaded" });
        await login(freshPage);
        await freshPage.goto(runtimeUrl("/micro-app/microi-platform-service/personal-settings"), {
            waitUntil: "domcontentloaded"
        });
        await expect(freshPage.getByText("个人资料", { exact: true }).first()).toBeVisible({ timeout: 30000 });
        await freshPage.getByText("偏好与终端", { exact: true }).first().click();
        await expect(freshPage.getByText("sys_user 个人设置", { exact: true })).toBeVisible();
        for (const label of preferenceLabels) {
            await expect.poll(
                async () => fieldControlValues(freshPage, label),
                { message: `全新浏览器上下文未恢复个人偏好：${label}`, timeout: 15000 }
            ).toEqual(expectedPreferences[label]);
        }
    } finally {
        await freshContext.close();
    }

    await page.screenshot({
        path: testInfo.outputPath("junchi-personal-settings-v1.7.2.png"),
        fullPage: true
    });
});
