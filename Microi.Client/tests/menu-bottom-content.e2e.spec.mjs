import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_MENU_BOTTOM_WEB_BASE || "http://localhost:61500";
const API_BASE = process.env.PW_MENU_BOTTOM_API_BASE || "https://localhost:61501";
const PASSWORD = process.env.PW_MENU_BOTTOM_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_MENU_BOTTOM_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_MENU_BOTTOM_SCREENSHOT_DIR || "../.tmp/menu-bottom-content-acceptance"
);
const CURRENT_YEAR = String(new Date().getFullYear());
const CLIENT_PACKAGE = JSON.parse(await fs.readFile(
    new URL("../package.json", import.meta.url),
    "utf8"
));
const EXPECTED_OS_VERSION = String(CLIENT_PACKAGE.version || "").startsWith("v")
    ? String(CLIENT_PACKAGE.version)
    : `v${String(CLIENT_PACKAGE.version || "")}`;

test.use({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

function tenantUrl(hashPath = "/login") {
    const query = new URLSearchParams({ OsClient: "iTdos", ApiBase: API_BASE });
    return `${FRONTEND}/?${query.toString()}#${hashPath}`;
}

async function loginThroughUi(page) {
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
        const checked = await privacy.evaluate(element => (
            element.classList.contains("is-checked")
            || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!checked) await privacy.click();
    }

    const loginResponsePromise = page.waitForResponse(
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.locator("button.login-button").click();
    const result = await (await loginResponsePromise).json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.locator("#divLogin")).toHaveCount(0, { timeout: 30_000 });
    await page.waitForFunction(() => window.__MICROI_APP_READY__ === true, null, {
        timeout: 30_000
    });
}

async function assertMenuFooter(page, screenshotName) {
    const footer = page.locator(".menu-bottom-bg");
    const content = footer.locator(".item");
    await expect(footer).toBeVisible({ timeout: 30_000 });
    await expect(content.locator(".col-md-12")).toHaveText([
        EXPECTED_OS_VERSION,
        `Copyright © 2009 - ${CURRENT_YEAR}`
    ]);
    await expect(content).not.toContainText(/\{\{|\$YYYY\$|\$OsVersion\$/);

    const diagnostics = await page.evaluate(() => {
        const footerElement = document.querySelector(".menu-bottom-bg");
        const contentElement = footerElement?.querySelector(".item");
        const waveElement = footerElement?.querySelector(".menu-bottom-wave path");
        const parseRgb = value => {
            const matches = String(value || "").match(/[\d.]+/g)?.map(Number) || [];
            return matches.length >= 3 ? matches.slice(0, 3) : null;
        };
        const luminance = rgb => {
            const channels = rgb.map(value => {
                const normalized = value / 255;
                return normalized <= 0.03928
                    ? normalized / 12.92
                    : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const textColor = contentElement ? getComputedStyle(contentElement).color : "";
        const waveColor = waveElement ? getComputedStyle(waveElement).fill : "";
        const foreground = parseRgb(textColor);
        const background = parseRgb(waveColor);
        let contrastRatio = 0;
        if (foreground && background) {
            const lighter = Math.max(luminance(foreground), luminance(background));
            const darker = Math.min(luminance(foreground), luminance(background));
            contrastRatio = (lighter + 0.05) / (darker + 0.05);
        }
        const rect = footerElement?.getBoundingClientRect();
        return {
            runtimeEndpoint: window.__MICROI_RUNTIME_ENDPOINT__,
            textColor,
            waveColor,
            contrastRatio,
            width: rect?.width || 0,
            height: rect?.height || 0
        };
    });
    expect(diagnostics.runtimeEndpoint?.apiBase).toBe(API_BASE);
    expect(diagnostics.runtimeEndpoint?.osClient).toBe("iTdos");
    expect(diagnostics.width).toBeGreaterThan(200);
    expect(diagnostics.height).toBeGreaterThanOrEqual(80);
    expect(diagnostics.contrastRatio).toBeGreaterThanOrEqual(4.5);

    await footer.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName) });
    return diagnostics;
}

test("official MenuBottomContent resolves OsVersion and the current year on the local backend", async ({ page }) => {
    test.skip(!PASSWORD, "PW_MENU_BOTTOM_PASSWORD is required for the real UI login");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await loginThroughUi(page);
    await assertMenuFooter(page, "official-dynamic-template.png");
});

test("an empty MenuBottomContent response renders the framework default footer", async ({ page }) => {
    test.skip(!PASSWORD, "PW_MENU_BOTTOM_PASSWORD is required for the real UI login");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    let patchedResponses = 0;
    await page.route(`${API_BASE}/**`, async route => {
        const requestUrl = route.request().url();
        const isSysConfig = /\/apiengine\/platform-sys-config/i.test(requestUrl);
        const isLogin = /\/api\/SysUser\/Login/i.test(requestUrl);
        if (!isSysConfig && !isLogin) {
            await route.continue();
            return;
        }

        const response = await route.fetch();
        const payload = await response.json();
        const patchConfig = config => {
            if (!config || typeof config !== "object" || Array.isArray(config)) return false;
            config.MenuBottomContent = "";
            return true;
        };
        if (Number(payload?.Code) === 1) {
            const candidates = isSysConfig
                ? [payload.Data]
                : [payload.Data?.SysConfig, payload.DataAppend?.SysConfig];
            if (candidates.map(patchConfig).some(Boolean)) patchedResponses += 1;
        }
        await route.fulfill({ response, json: payload });
    });

    await loginThroughUi(page);
    const diagnostics = await assertMenuFooter(page, "empty-value-default-footer.png");
    expect(patchedResponses).toBeGreaterThan(0);
    expect(diagnostics.contrastRatio).toBeGreaterThanOrEqual(4.5);
});
