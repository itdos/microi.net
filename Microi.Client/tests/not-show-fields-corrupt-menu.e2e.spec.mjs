import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/not-show-fields-acceptance"
);

test.use({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    ...(process.env.PW_BROWSER_CHANNEL ? { channel: process.env.PW_BROWSER_CHANNEL } : {})
});
test.setTimeout(150_000);

function tenantUrl(hash = "") {
    return `${FRONTEND}/?OsClient=iTdos${hash}`;
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

    const responsePromise = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const result = await (await responsePromise).json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
}

async function tableRuntime(page) {
    return page.evaluate(() => {
        const root = document.querySelector("#diy-table");
        let instance = root?.__vueParentComponent || null;
        while (instance && !instance.proxy?.SysMenuId) instance = instance.parent;
        const proxy = instance?.proxy;
        const notShowFields = Array.isArray(proxy?.NotShowFields)
            ? JSON.parse(JSON.stringify(proxy.NotShowFields))
            : null;
        return {
            sysMenuId: String(proxy?.SysMenuId || ""),
            rowsAreArray: Array.isArray(proxy?.DiyTableRowList),
            rowCount: Array.isArray(proxy?.DiyTableRowList) ? proxy.DiyTableRowList.length : -1,
            visibleFieldCount: Array.isArray(proxy?.ShowDiyFieldList) ? proxy.ShowDiyFieldList.length : -1,
            notShowFields,
            notShowFieldsAreValid: Array.isArray(notShowFields) && notShowFields.every((item) => (
                (typeof item === "string" && item.trim() !== "")
                || (item
                    && !Array.isArray(item)
                    && typeof item === "object"
                    && (String(item.Name || "").trim() !== ""
                        || String(item.Id || "").trim() !== ""))
            ))
        };
    });
}

test("damaged NotShowFields cannot blank the table after GetTableData succeeds", async ({ page }) => {
    test.skip(!PASSWORD, "PW_LOCAL_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    const pageErrors = [];
    const tableResponses = [];
    let injectedMenuResponses = 0;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
        if (/\/api\/FormEngine\/GetTableData(?:\?|$)/i.test(response.url())) {
            tableResponses.push(response.json().catch(() => null));
        }
    });

    await login(page);
    await page.route("**/*", async (route) => {
        const request = route.request();
        if (request.method() === "POST"
            && /\/api\/FormEngine\/GetSysMenuModel(?:\?|$)/i.test(request.url())) {
            const response = await route.fetch();
            const payload = await response.json();
            if (Number(payload?.Code) === 1 && payload?.Data) {
                payload.Data.NotShowFields = JSON.stringify([
                    null,
                    "",
                    {},
                    { Label: "invalid" },
                    { Name: "__not_a_real_field__" }
                ]);
                injectedMenuResponses += 1;
            }
            await route.fulfill({ response, json: payload });
            return;
        }
        await route.continue();
    });

    await page.goto(tenantUrl("#/mic-home-work-todo"), { waitUntil: "domcontentloaded" });
    await expect(page.locator("#diy-table")).toBeVisible({ timeout: 45_000 });
    await expect.poll(async () => (await tableRuntime(page)).visibleFieldCount, {
        timeout: 45_000
    }).toBeGreaterThan(0);

    const networkResults = await Promise.all(tableResponses);
    const successfulTableResponse = networkResults.find((result) => (
        Number(result?.Code) === 1 && Array.isArray(result?.Data)
    ));
    expect(successfulTableResponse, "GetTableData should succeed with an array payload").toBeTruthy();
    expect(injectedMenuResponses).toBeGreaterThan(0);

    const runtime = await tableRuntime(page);
    expect(runtime.sysMenuId).not.toBe("");
    expect(runtime.rowsAreArray).toBe(true);
    expect(runtime.notShowFieldsAreValid).toBe(true);
    expect(pageErrors).toEqual([]);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "not-show-fields-null-safe.png"),
        fullPage: true
    });
});
