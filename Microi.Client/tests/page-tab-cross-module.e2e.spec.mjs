import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/page-tab-cross-module-acceptance"
);

test.use({
    viewport: { width: 1640, height: 920 },
    ignoreHTTPSErrors: true,
    ...(process.env.PW_BROWSER_CHANNEL ? { channel: process.env.PW_BROWSER_CHANNEL } : {})
});
test.setTimeout(180_000);

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
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first())
        .toBeVisible({ timeout: 30_000 });
}

async function moduleRuntime(page) {
    return page.evaluate(() => {
        const root = document.querySelector("#diy-table");
        let instance = root?.__vueParentComponent || null;
        while (instance && !instance.proxy?.SysMenuId) instance = instance.parent;
        const proxy = instance?.proxy;
        return {
            sysMenuId: String(proxy?.SysMenuId || ""),
            tableId: String(proxy?.TableId || ""),
            hostSysMenuId: String(proxy?.PageTabHostSysMenuId || ""),
            hostTableId: String(proxy?.PageTabHostTableId || "")
        };
    });
}

test("我的工作跨表 PageTabs 在同一模块实例内切换并显示稳定骨架屏", async ({ page }) => {
    test.skip(!PASSWORD, "PW_LOCAL_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    const pageErrors = [];
    const serverErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
        if (response.status() >= 500 && /\/(?:api|apiengine)\//i.test(response.url())) {
            serverErrors.push(`${response.status()} ${response.url()}`);
        }
    });

    await login(page);
    await page.goto(tenantUrl("#/mic-home-work-todo"), { waitUntil: "domcontentloaded" });

    const root = page.locator("#diy-table");
    const hero = page.locator(".module-presentation-header:not(.module-shell-skeleton)").first();
    const tabs = page.locator("#table-rowlist-tabs .el-tabs__item");
    await expect(root).toBeVisible({ timeout: 45_000 });
    await expect(hero).toBeVisible({ timeout: 45_000 });
    await expect(tabs.filter({ hasText: "与我相关" }).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".module-page-tabs-skeleton")).toHaveCount(0, { timeout: 45_000 });

    const before = {
        runtime: await moduleRuntime(page),
        heroTitle: await hero.locator(".module-presentation-title").innerText(),
        workspaceTabs: await page.locator(".parent-tabs .el-tabs__item").allInnerTexts(),
        heroBox: await hero.boundingBox()
    };
    expect(before.runtime.sysMenuId).not.toBe("");
    expect(before.runtime.tableId).not.toBe("");
    await page.evaluate(() => {
        window.__microiPageTabRoot = document.querySelector("#diy-table");
    });

    let delayModuleRequests = false;
    await page.route("**/*", async (route) => {
        const request = route.request();
        if (delayModuleRequests
            && request.method() !== "OPTIONS"
            && /\/(?:api|apiengine)\//i.test(request.url())) {
            await new Promise((resolve) => setTimeout(resolve, 1_100));
        }
        await route.continue();
    });

    delayModuleRequests = true;
    await tabs.filter({ hasText: "与我相关" }).first().click();
    const skeleton = page.locator(".module-page-tabs-skeleton");
    await expect(skeleton).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".module-shell-skeleton")).toBeVisible({ timeout: 10_000 });
    const skeletonHeroBox = await page.locator(".module-shell-skeleton").boundingBox();
    expect(skeletonHeroBox).not.toBeNull();
    expect(before.heroBox).not.toBeNull();
    expect(Math.abs(skeletonHeroBox.y - before.heroBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(skeletonHeroBox.height - before.heroBox.height)).toBeLessThanOrEqual(4);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-cross-module-skeleton.png"),
        fullPage: false
    });
    delayModuleRequests = false;

    await expect(skeleton).toHaveCount(0, { timeout: 45_000 });
    await expect(hero).toBeVisible({ timeout: 45_000 });
    await expect(tabs.filter({ hasText: "与我相关" }).first()).toHaveClass(/is-active/);

    const afterRoute = await page.evaluate(() => {
        const [pathName, query = ""] = location.hash.split("?");
        return { pathName, tab: new URLSearchParams(query).get("Tab") };
    });
    expect(afterRoute).toEqual({ pathName: "#/mic-home-work-todo", tab: "与我相关" });

    const after = {
        runtime: await moduleRuntime(page),
        heroTitle: await hero.locator(".module-presentation-title").innerText(),
        workspaceTabs: await page.locator(".parent-tabs .el-tabs__item").allInnerTexts(),
        sameRoot: await page.evaluate(() => (
            window.__microiPageTabRoot === document.querySelector("#diy-table")
        ))
    };
    expect(after.sameRoot).toBe(true);
    expect(after.workspaceTabs).toEqual(before.workspaceTabs);
    expect(after.heroTitle).toBe(before.heroTitle);
    expect(after.runtime.sysMenuId).not.toBe(before.runtime.sysMenuId);
    expect(after.runtime.tableId).not.toBe(before.runtime.tableId);
    expect(after.runtime.hostSysMenuId).toBe(before.runtime.sysMenuId);
    expect(after.runtime.hostTableId).toBe(before.runtime.tableId);
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);

    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-cross-module-final.png"),
        fullPage: false
    });

    const returnTab = tabs.filter({ hasText: "我的待办" }).first();
    await expect(returnTab).toBeVisible();
    await returnTab.click();
    await expect(returnTab).toHaveClass(/is-active/, { timeout: 45_000 });
    await expect(skeleton).toHaveCount(0, { timeout: 45_000 });
    const returnedRoute = await page.evaluate(() => {
        const [pathName, query = ""] = location.hash.split("?");
        return { pathName, tab: new URLSearchParams(query).get("Tab") };
    });
    expect(returnedRoute).toEqual({ pathName: "#/mic-home-work-todo", tab: "我的待办" });
    const returnedRuntime = await moduleRuntime(page);
    expect(returnedRuntime.sysMenuId).toBe(before.runtime.sysMenuId);
    expect(returnedRuntime.tableId).toBe(before.runtime.tableId);
    expect(await page.evaluate(() => (
        window.__microiPageTabRoot === document.querySelector("#diy-table")
    ))).toBe(true);
});
