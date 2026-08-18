import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.PW_LSG_BASE_URL
    || "http://localhost:61500/?OsClient=lsg&ApiBase=https%3A%2F%2Fapi.itdos.com";
const PASSWORD = process.env.PW_LSG_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/tenant-logo-isolation"
);

test.use({
    viewport: { width: 1365, height: 768 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.setTimeout(120_000);

function tenantUrl(hash = "#/") {
    return `${BASE_URL.replace(/#.*$/, "")}${hash}`;
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
    await page.locator('input[type="password"]').first().fill(PASSWORD);

    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate((element) => (
            element.classList.contains("is-checked")
            || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!checked) await privacy.click();
    }

    const loginResponse = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const result = await (await loginResponse).json();
    expect(Number(result.Code), result.Msg || "LSG login failed").toBe(1);
}

async function visibleLogoState(page) {
    const shell = page.locator(".sidebar-logo-microi-shell:visible").first();
    await expect(shell).toBeVisible({ timeout: 45_000 });
    return shell.evaluate((element) => {
        const image = element.querySelector("img");
        return {
            backgroundImage: getComputedStyle(element).backgroundImage,
            naturalWidth: image?.naturalWidth || 0,
            fallbackText: element.textContent?.trim() || ""
        };
    });
}

test("子租户 Logo 在首页及应用商城路由均保持租户品牌", async ({ page }) => {
    test.skip(!PASSWORD, "PW_LSG_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page);

    await expect.poll(async () => (await visibleLogoState(page)).naturalWidth, {
        timeout: 30_000
    }).toBeGreaterThan(0);
    const home = await visibleLogoState(page);
    expect(home.backgroundImage).toContain("/lsg/");
    expect(home.backgroundImage).not.toMatch(/\/static\/img\/logo\/itdos\.svg/i);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home.png") });

    await page.goto(tenantUrl("#/microi-store"), { waitUntil: "domcontentloaded" });
    await expect.poll(async () => (await visibleLogoState(page)).naturalWidth, {
        timeout: 30_000
    }).toBeGreaterThan(0);
    const marketplace = await visibleLogoState(page);
    expect(marketplace.backgroundImage).toContain("/lsg/");
    expect(marketplace.backgroundImage).not.toMatch(/\/static\/img\/logo\/itdos\.svg/i);
    expect(marketplace.fallbackText).toBe("");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "marketplace.png") });
});
