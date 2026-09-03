import { expect, test } from "@playwright/test";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const TENANT_URL = `${FRONTEND}/?OsClient=iTdos`;

test.use({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
    channel: process.env.PW_BROWSER_CHANNEL || "msedge"
});
test.setTimeout(180_000);

async function login(page) {
    await page.goto(TENANT_URL, { waitUntil: "domcontentloaded" });
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill(ACCOUNT);
    await page.locator('input[type="password"]').first().fill(PASSWORD);

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
    const payload = await (await responsePromise).json();
    expect(Number(payload.Code), payload.Msg || "真实 UI 登录失败").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 45_000 });
}

async function readSafeSessionState(page) {
    return page.evaluate(() => ({
        hasLocalToken: Boolean(JSON.parse(localStorage.getItem("microi.net") || "null")?.Token),
        hasCookieToken: document.cookie.split(";").some((item) => item.trim().startsWith("authorization=")),
        hasCurrentUser: Boolean(JSON.parse(localStorage.getItem("microi.net") || "null")?.CurrentUser?.Id),
        bodyClass: document.body.className
    }));
}

test("Redis 管理器复用平台登录态，且 Cookie 缺失时仍以统一 Token 为准", async ({ page, context }) => {
    test.skip(!ACCOUNT || !PASSWORD, "需要通过受保护进程变量提供真实测试账号密码");
    await login(page);

    const responseSummaries = [];
    page.on("response", async (response) => {
        if (!/\/apiengine\/platform-cache-manager(?:\?|$)/i.test(response.url())) return;
        try {
            const body = await response.json();
            responseSummaries.push({ status: response.status(), code: Number(body?.Code), message: body?.Msg || body?.Message || "" });
        } catch {
            responseSummaries.push({ status: response.status(), code: null, message: "non-json" });
        }
    });

    await page.goto(`${TENANT_URL}#/mci-redis-manager`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".mci-redis-manager")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("已登录 · 平台连接可用", { exact: true })).toBeVisible({ timeout: 30_000 });
    console.log("REDIS_SESSION_FRESH", JSON.stringify(await readSafeSessionState(page)));
    console.log("REDIS_API_FRESH", JSON.stringify(responseSummaries));

    const cookies = await context.cookies();
    await context.clearCookies();
    await context.addCookies(cookies.filter((cookie) => cookie.name !== "authorization"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".mci-redis-manager")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("已登录 · 平台连接可用", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".sidebar-container-microi")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("匿名应急模式", { exact: true })).toHaveCount(0);
    console.log("REDIS_SESSION_NO_COOKIE", JSON.stringify(await readSafeSessionState(page)));

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${TENANT_URL}#/mci-redis-manager`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".mci-redis-manager")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("匿名应急模式", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("dialog").getByText("临时连接 Redis", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".sidebar-container-microi")).toHaveCount(0);
    console.log("REDIS_SESSION_ANONYMOUS", JSON.stringify(await readSafeSessionState(page)));
});
