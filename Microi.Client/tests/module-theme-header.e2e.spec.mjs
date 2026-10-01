import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const password = process.env.PW_LOCAL_PASSWORD || "";
const base = process.env.PW_BASE_URL || "http://localhost:61500";
const apiBase = process.env.PW_API_BASE || "";

test.use({ browserName: "chromium", channel: "msedge", viewport: { width: 1600, height: 900 } });
test.setTimeout(120_000);

test("主题设置切换全局直角并统一顶栏图标", async ({ page }) => {
    test.skip(!password, "PW_LOCAL_PASSWORD is required");
    await page.goto(`${base}/?OsClient=iTdos${apiBase ? `&ApiBase=${encodeURIComponent(apiBase)}` : ""}`, { waitUntil: "domcontentloaded" });
    const account = page.locator('input[placeholder*="user name"], input[placeholder*="用户名"], input[placeholder*="账号"], input[placeholder*="帐号"]').first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill("admin");
    await page.locator('input[type="password"]').first().fill(password);
    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate((el) => el.classList.contains("is-checked") || !!el.querySelector('input[type="checkbox"]')?.checked);
        if (!checked) await privacy.click();
    }
    const response = page.waitForResponse((res) => /\/api\/SysUser\/Login(?:\?|$)/i.test(res.url()));
    await page.getByRole("button", { name: "登录", exact: true }).click();
    expect(Number((await (await response).json()).Code)).toBe(1);

    const theme = page.getByRole("button", { name: "主题设置" });
    await expect(theme).toBeVisible({ timeout: 30_000 });
    await theme.click();
    const style = page.getByRole("group", { name: "边角风格" });
    await expect(style).toBeVisible();
    const saveStatus = page.locator(".mci-theme-save-status");
    try {
        await style.getByRole("button", { name: "直角" }).click();
        await expect(page.locator("html[data-mci-corner-style='square']")).toHaveCount(1);
        await expect(saveStatus).toHaveClass(/is-saved/, { timeout: 15_000 });
        const radii = await page.locator(".theme-select-trigger, .mci-theme-panel, .el-popper:visible").evaluateAll((elements) =>
            elements.map((el) => getComputedStyle(el).borderRadius));
        expect(radii.length).toBeGreaterThan(0);
        expect(radii.every((radius) => radius.split(" ").every((value) => value === "0px"))).toBe(true);
        const ai = page.locator("[data-testid='desktop-ai-entry']");
        await expect(ai.locator("svg")).toBeVisible();
        await expect(ai.locator("img")).toHaveCount(0);
        const boxes = await page.locator(".navbar-microi .right-menu .theme-select-trigger, .navbar-microi .right-menu [data-testid='desktop-ai-entry']").evaluateAll((elements) =>
            elements.map((el) => Math.round(el.getBoundingClientRect().width)));
        expect(boxes).toEqual([40, 40]);
        if (process.env.PW_SCREENSHOT_DIR) {
            const target = path.resolve(process.env.PW_SCREENSHOT_DIR, "square-theme-and-header.png");
            await fs.mkdir(path.dirname(target), { recursive: true });
            await page.screenshot({ path: target });
        }
    } finally {
        await style.getByRole("button", { name: "圆角" }).click();
        await expect(page.locator("html[data-mci-corner-style='round']")).toHaveCount(1);
        await expect(saveStatus).toHaveClass(/is-saved/, { timeout: 15_000 });
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html[data-mci-corner-style='round']")).toHaveCount(1);
});
