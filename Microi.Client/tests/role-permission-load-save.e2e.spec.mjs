import { expect, test } from "@playwright/test";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";

test.use({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.setTimeout(120_000);

function tenantUrl(hash = "") {
    const query = new URLSearchParams({ OsClient: "iTdos" });
    return `${FRONTEND}/?${query.toString()}${hash}`;
}

async function login(page) {
    await page.goto(tenantUrl(), { waitUntil: "domcontentloaded" });
    const accountInput = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(accountInput).toBeVisible({ timeout: 30_000 });
    await accountInput.fill("admin");
    await page.locator('input[type="password"]').first().fill(LOCAL_PASSWORD);

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

function isFormWriteResponse(response, action) {
    const endpoint = new URL(response.url()).pathname.split("/").filter(Boolean).at(-1) || "";
    return endpoint.toLowerCase() === action.toLowerCase()
        || endpoint.toLowerCase().startsWith(action.toLowerCase() + "-");
}

async function openRowAction(page, row, action) {
    const directAction = row.getByRole("button", { name: action }).first();
    if (await directAction.isVisible().catch(() => false)) {
        await directAction.click();
        return;
    }
    await row.getByRole("button", { name: /^(?:More|更多)$/i }).first().click();
    const menu = page.locator(".global-more-menu:visible").last();
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await menu.locator(".global-more-menu-item").filter({ hasText: action }).first().click();
}

test("角色权限首次加载走专用菜单树并可原值保存", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await login(page);
    await page.goto(tenantUrl("#/system/role"), { waitUntil: "domcontentloaded" });

    const rolePage = page.locator(".left-right-page").first();
    await expect(rolePage).toBeVisible({ timeout: 45_000 });
    await rolePage.locator(".tree-all-node").click();
    const roleRow = rolePage.locator(".right-table-col .el-table__row").first();
    await expect(roleRow).toBeVisible({ timeout: 30_000 });

    const menuRequestStarted = new Map();
    let menuMetric = null;
    page.on("request", (request) => {
        const url = request.url();
        if (/GetDiyTableRowTree/i.test(url)
            || /platform-sys-menu\?Action=(?:GetSysMenuStep|GetRolePermissionTree)/i.test(url)) {
            menuRequestStarted.set(request, Date.now());
        }
    });
    page.on("response", (response) => {
        const request = response.request();
        if (!menuRequestStarted.has(request)) return;
        menuMetric = {
            url: response.url(),
            durationMs: Date.now() - menuRequestStarted.get(request)
        };
    });

    await openRowAction(page, roleRow, /^(?:Edit|编辑)$/i);
    const dialog = page.locator(
        ".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible"
    ).last();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const permissionField = dialog.locator(".mci-role-permission-field");
    await expect(permissionField.locator(".mci-role-permission-field__tree")).toBeVisible({ timeout: 45_000 });
    await expect(permissionField.locator(".el-alert--error")).toHaveCount(0);
    expect(menuMetric, "没有捕获到菜单权限树请求").toBeTruthy();
    const menuUrl = new URL(menuMetric.url);
    expect(menuUrl.pathname).toBe("/apiengine/platform-sys-menu");
    expect(menuUrl.searchParams.get("Action")).toBe("GetRolePermissionTree");
    expect(menuMetric.durationMs, "角色权限树首次加载不应退化到秒级慢查询").toBeLessThan(5_000);
    console.log(`[role-permission] endpoint=${menuUrl.pathname}${menuUrl.search} durationMs=${menuMetric.durationMs}`);

    const updateResponse = page.waitForResponse(
        (response) => isFormWriteResponse(response, "UptFormData"),
        { timeout: 45_000 }
    );
    await dialog.getByRole("button", { name: /^(?:Save|保存)$/i }).first().click();
    const updateResult = await (await updateResponse).json();
    expect(Number(updateResult.Code), updateResult.Msg || "role update failed").toBe(1);
    await expect(dialog).toBeHidden({ timeout: 30_000 });
});
