import { expect, test } from "@playwright/test";

const WEB_BASE = process.env.PW_SYSTEM_SETTINGS_WEB_BASE || "https://junchi.chongstech.com";
const API_BASE = process.env.PW_SYSTEM_SETTINGS_API_BASE || "https://api.chongstech.com";
const OS_CLIENT = process.env.PW_SYSTEM_SETTINGS_OSCLIENT || "junchi";
const ACCOUNT = process.env.PW_SYSTEM_SETTINGS_ACCOUNT || "admin";
const PASSWORD = process.env.PW_SYSTEM_SETTINGS_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_SYSTEM_SETTINGS_BROWSER_CHANNEL || "";
const RECORD_ID = process.env.PW_SYSTEM_SETTINGS_RECORD_ID
    || "a5fabe90-995f-45a0-adb4-606cdb98cdcd";

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
    expect(Number(result.Code), result.Msg || "production UI login failed").toBe(1);
    await expect(page.locator("#divLogin")).toHaveCount(0, { timeout: 30000 });
}

test("production Junchi system settings resolves the current built-in platform service", async ({ page }, testInfo) => {
    test.skip(!PASSWORD, "PW_SYSTEM_SETTINGS_PASSWORD is required for the production smoke test.");
    test.setTimeout(150000);
    await page.setViewportSize({ width: 1440, height: 960 });

    await page.goto(runtimeUrl("/login"), { waitUntil: "domcontentloaded" });
    await login(page);
    await page.goto(runtimeUrl(`/system-config?RecordId=${RECORD_ID}`), { waitUntil: "domcontentloaded" });

    const securityEntry = page.getByRole("button", {
        name: /安全与服务接入|登录与身份|Login and Identity|Security and Service Access/i
    }).first();
    await expect(securityEntry).toBeVisible({ timeout: 45000 });
    await securityEntry.click();

    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByRole("heading", { name: "服务端私有设置" })).toBeVisible({ timeout: 60000 });
    await expect(dialog.locator(".mci-micro-app-error:visible")).toHaveCount(0);
    await expect(dialog.getByText(/MICRO_APP_VERSION_MISMATCH|Requested version is not current\.|微服务暂时无法加载/)).toHaveCount(0);

    await page.screenshot({
        path: testInfo.outputPath("junchi-production-system-settings-platform-service.png"),
        fullPage: false
    });
});
