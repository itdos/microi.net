import { expect, test } from "@playwright/test";

const WEBSITE = process.env.PW_WEBSITE_URL || "http://localhost:61503";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";

test.use({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});

test("官网 AI 应用接口 521 后停止自动重试，仅允许用户手动重试", async ({ page }) => {
    let requestCount = 0;
    await page.route(/\/apiengine\/official_ai_apps\?OsClient=iTdos(?:&|$)/i, async (route) => {
        requestCount += 1;
        await route.fulfill({
            status: 521,
            contentType: "application/json",
            body: JSON.stringify({ Code: 0, Msg: "simulated upstream 521" })
        });
    });

    await page.goto(`${WEBSITE}/`, { waitUntil: "domcontentloaded" });
    const market = page.locator("#ai-apps");
    await expect(market).toBeVisible({ timeout: 30_000 });
    const retry = market.getByRole("button", { name: "重新加载", exact: true });
    await expect(retry).toBeVisible({ timeout: 30_000 });
    expect(requestCount).toBe(1);

    for (let index = 0; index < 4; index += 1) {
        await page.mouse.wheel(0, 1_200);
        await page.evaluate(() => {
            window.dispatchEvent(new Event("scroll"));
            window.dispatchEvent(new Event("resize"));
        });
        await page.waitForTimeout(350);
    }
    expect(requestCount, "scroll/resize/observer must not restart a failed request").toBe(1);

    await retry.click();
    await expect(retry).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(requestCount, "one manual retry should produce exactly one new request").toBe(2);
});
