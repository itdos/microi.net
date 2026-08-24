import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const frontend = process.env.PW_BASE_URL || "http://localhost:61500";
const apiBase = process.env.PW_API_BASE || "https://localhost:61501";
const password = process.env.PW_LOCAL_PASSWORD || "";
const browserChannel = process.env.PW_BROWSER_CHANNEL || "";
const screenshotDir = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/render-source-neutral-acceptance"
);

test.use({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
    ...(browserChannel ? { channel: browserChannel } : {})
});
test.setTimeout(180_000);

function tenantUrl(hash = "") {
    const query = new URLSearchParams({ OsClient: "iTdos", ApiBase: apiBase });
    return `${frontend}/?${query.toString()}${hash}`;
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
    await page.locator('input[type="password"]').first().fill(password);
    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate(element => (
            element.classList.contains("is-checked")
            || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!checked) await privacy.click();
    }
    const responsePromise = page.waitForResponse(
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const result = await (await responsePromise).json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first())
        .toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => window.__MICROI_APP_READY__ === true, null, {
        timeout: 30_000
    });
}

test("微服务来源详情使用租户中性的平台文案", async ({ page }) => {
    test.skip(!password, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(screenshotDir, { recursive: true });
    await login(page);
    await page.getByRole("menuitem", { name: /系统引擎|System Engine/i }).click();
    await page.getByRole("menuitem", { name: /系统管理|System Management/i }).click();
    const systemConfigEntry = page.getByRole("menuitem", {
        name: /系统设置|System Settings/i
    }).first();
    await expect(systemConfigEntry).toBeVisible({ timeout: 30_000 });
    await systemConfigEntry.click();
    await expect(page).toHaveURL(/#\/system-config(?:\?|$)/, { timeout: 30_000 });

    const runtimeEndpoint = await page.evaluate(() => window.__MICROI_RUNTIME_ENDPOINT__);
    expect(runtimeEndpoint?.apiBase).toBe(apiBase);
    expect(runtimeEndpoint?.osClient).toBe("iTdos");

    const securityEntry = page.getByRole("button", {
        name: /安全与服务接入|登录与身份|Login and Identity|Security and Service Access/i
    }).first();
    await expect(securityEntry).toBeVisible({ timeout: 60_000 });
    await securityEntry.click();
    const microserviceDialog = page.getByRole("dialog").last();
    await expect(microserviceDialog).toBeVisible({ timeout: 30_000 });

    const badge = microserviceDialog.locator('[data-render-source="microservice"]').last();
    await expect(badge).toBeVisible({ timeout: 60_000 });
    await badge.locator("[data-render-source-trigger]").click();
    const dialog = page.locator(".mci-render-source-dialog:visible").last();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toContainText(
        /当前内容由平台框架统一托管|This content is hosted by the platform framework/
    );
    await expect(dialog).toContainText(
        /这是由平台微服务运行时挂载的独立前端应用|An independent frontend application mounted by the platform microservice runtime/
    );
    await expect(dialog).not.toContainText(/吾码|吾碼/);
    await dialog.screenshot({
        path: path.join(screenshotDir, "microservice-platform-wording.png")
    });
});
