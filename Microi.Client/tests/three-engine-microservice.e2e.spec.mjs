import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const TENANT_URL = `${FRONTEND}/?OsClient=iTdos`;
const ARTIFACT_DIR = path.resolve(process.cwd(), "../.tmp/three-engine-microservice-acceptance");

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
        const checked = await privacy.evaluate(element => element.classList.contains("is-checked") || Boolean(element.querySelector('input[type="checkbox"]')?.checked));
        if (!checked) await privacy.click();
    }
    const responsePromise = page.waitForResponse(response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()), { timeout: 30_000 });
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const payload = await (await responsePromise).json();
    expect(Number(payload.Code), payload.Msg || "真实 UI 登录失败").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 45_000 });
}

test("3D 引擎只从独立 MicroService 加载并复用平台登录态", async ({ page }) => {
    test.skip(!ACCOUNT || !PASSWORD, "需要通过受保护进程变量提供真实测试账号密码");
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error?.stack || error)));

    await login(page);
    await page.goto(`${TENANT_URL}#/micro-app/microi-3d-engine/designer`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("microservice-root")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("three-engine-designer")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("standalone-login")).toHaveCount(0);
    await expect(page.locator(".sidebar-container-microi")).toBeVisible();
    await expect(page.getByText("场景预设", { exact: true })).toBeVisible();
    await expect(page.locator("canvas").last()).toBeVisible({ timeout: 45_000 });
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "three-engine-microservice-1600x1000.png"), fullPage: true });
});
