import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const JUNCHI_PASSWORD = process.env.PW_JUNCHI_PASSWORD || "";
const ANDERSON_PASSWORD = process.env.PW_ANDERSON_PASSWORD || "";
const RUN_LEVEL500_API_ENGINE_PROBE = process.env.PW_ANDERSON_LEVEL500_PROBE === "1";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/role-dept-tree-acceptance"
);

test.use({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

function tenantUrl(osClient, apiBase = "", hash = "") {
    const query = new URLSearchParams({ OsClient: osClient });
    if (apiBase) query.set("ApiBase", apiBase);
    return `${FRONTEND}/?${query.toString()}${hash}`;
}

async function login(page, { osClient, password, apiBase = "", account = "admin" }) {
    await page.goto(tenantUrl(osClient, apiBase), { waitUntil: "domcontentloaded" });
    const accountInput = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(accountInput).toBeVisible({ timeout: 30_000 });
    await accountInput.fill(account);
    await page.locator('input[type="password"]').first().fill(password);

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
    const currentUser = result?.Data?.CurrentUser || result?.Data?.User || result?.Data || {};
    const displayName = String(currentUser.Name || currentUser.Account || account)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const accountName = String(account).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const identityName = account.toLowerCase() === "admin"
        ? /管理员|admin/i
        : new RegExp(`${accountName}|${displayName}`, "i");
    await expect(page.getByRole("button", { name: identityName }).first()).toBeVisible({ timeout: 30_000 });
}

function requestBody(request) {
    try {
        return request.postDataJSON() || {};
    } catch (error) {
        return {};
    }
}

function endpointName(url) {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).at(-1) || "";
    const dynamicEndpoint = lastSegment.match(
        /^(GetTableData|GetSysMenuModel|GetDiyTableModel|GetDiyFieldByDiyTables)(?:-.+)?$/i
    );
    if (!dynamicEndpoint) return lastSegment;
    return ["GetTableData", "GetSysMenuModel", "GetDiyTableModel", "GetDiyFieldByDiyTables"]
        .find((name) => name.toLowerCase() === dynamicEndpoint[1].toLowerCase());
}

const JUNCHI_MATERIAL_MODULE_KEY = "01KXGPXRSF94HCMA1T5KEEHQZV";

function isJunchiMaterialRequest(request) {
    const pathname = new URL(request.url()).pathname;
    return pathname.toLowerCase().endsWith(`-${JUNCHI_MATERIAL_MODULE_KEY.toLowerCase()}`)
        || requestBody(request).ModuleEngineKey === JUNCHI_MATERIAL_MODULE_KEY;
}

function formItem(dialog, label) {
    return dialog.locator(".el-form-item").filter({ hasText: label }).first();
}

function isFormWriteResponse(response, action) {
    const lastSegment = new URL(response.url()).pathname.split("/").filter(Boolean).at(-1) || "";
    return lastSegment.toLowerCase() === action.toLowerCase()
        || lastSegment.toLowerCase().startsWith(action.toLowerCase() + "-");
}

async function closeFormIfOpen(dialog) {
    if (!await dialog.isVisible().catch(() => false)) return;
    await dialog.getByRole("button", { name: /^(?:Close|关闭)$/i }).first().click();
    const confirm = dialog.page().locator(".el-message-box:visible").last();
    if (await confirm.waitFor({ state: "visible", timeout: 1_500 }).then(() => true).catch(() => false)) {
        await confirm.getByRole("button", { name: /^(?:OK|Confirm|确定)$/i }).last().click();
    }
    await expect(dialog).toBeHidden({ timeout: 15_000 });
}

async function filterRightTable(page, name) {
    const rightTable = page.locator(".right-table-col").first();
    const keyword = rightTable.locator(".keyword-input input").first();
    await expect(keyword).toBeVisible({ timeout: 30_000 });
    if (await keyword.inputValue()) {
        const clearResponse = page.waitForResponse(
            (response) => endpointName(response.url()) === "GetTableData",
            { timeout: 30_000 }
        );
        await keyword.fill("");
        await clearResponse;
    }
    const row = rightTable.locator(".el-table__row").filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    return row;
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

async function deleteRow(page, row, name) {
    const responsePromise = page.waitForResponse(
        (response) => isFormWriteResponse(response, "DelFormData"),
        { timeout: 30_000 }
    );
    await openRowAction(page, row, /^(?:Delete|删除)$/i);
    const confirm = page.locator(".el-message-box:visible").last();
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.getByRole("button", { name: /^(?:OK|Confirm|确定)$/i }).last().click();
    const response = await responsePromise;
    const result = await response.json();
    expect(Number(result.Code), result.Msg || "delete failed: " + name).toBe(1);
    await expect(page.locator(".right-table-col .el-table__row").filter({ hasText: name })).toHaveCount(0, { timeout: 30_000 });
}

async function deleteFilteredRow(page, name) {
    const row = await filterRightTable(page, name);
    await deleteRow(page, row, name);
}

async function cleanupVisibleRows(page, marker) {
    for (let index = 0; index < 10; index++) {
        const row = page.locator(".right-table-col .el-table__row").filter({ hasText: marker }).first();
        if (!await row.isVisible().catch(() => false)) return;
        const name = await row.locator("td").filter({ hasText: marker }).first().innerText();
        await deleteRow(page, row, name.trim());
    }
    throw new Error("too many stale Codex acceptance rows: " + marker);
}

test("角色和部门菜单使用低代码左右树表，角色表单加载权限明细定制字段", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const legacyCalls = [];
    page.on("request", (request) => {
        if (/\/api\/(?:SysRole|SysDept)\//i.test(new URL(request.url()).pathname)) {
            legacyCalls.push(new URL(request.url()).pathname);
        }
    });

    await login(page, { osClient: "iTdos", password: LOCAL_PASSWORD });
    await page.goto(tenantUrl("iTdos", "", "#/system/role"), { waitUntil: "domcontentloaded" });
    const rolePage = page.locator(".left-right-page").first();
    await expect(rolePage).toBeVisible({ timeout: 45_000 });
    await expect(rolePage.locator(".left-tree-card")).toBeVisible();
    const organizationNodes = rolePage.locator(".left-tree-card .el-tree-node__content:visible");
    await expect(organizationNodes.first()).toBeVisible({ timeout: 30_000 });
    const firstRoleRow = rolePage.locator(".right-table-col .el-table__row").first();
    await expect(firstRoleRow).toBeVisible({ timeout: 30_000 });
    await rolePage.locator(".tree-all-node").click();
    await expect(firstRoleRow).toBeVisible({ timeout: 15_000 });
    const addRole = rolePage.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first();
    await expect(addRole).toBeVisible({ timeout: 45_000 });
    await addRole.click();

    const roleDialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
    await expect(roleDialog).toBeVisible({ timeout: 30_000 });
    const permissionField = roleDialog.locator(".mci-role-permission-field");
    await expect(permissionField).toBeVisible({ timeout: 30_000 });
    await expect(permissionField.locator(".el-form-item")).toHaveCount(0);
    const permissionFormItem = permissionField.locator(
        "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' el-form-item ')][1]"
    );
    await expect(permissionFormItem.locator(":scope > .el-form-item__label")).toHaveCount(1);
    await expect(roleDialog).toContainText("接口引擎等平台控制面仍要求 9999 级管理员");
    await expect(roleDialog.locator(".mci-role-permission-field__tree")).toBeVisible({ timeout: 30_000 });
    await expect(permissionField.getByText(/无详情|无搜索/)).toHaveCount(0);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-role-low-code-permissions.png"), fullPage: false });
    await roleDialog.getByRole("button", { name: /^(?:Close|关闭)$/i }).first().click();
    await expect(roleDialog).toBeHidden({ timeout: 15_000 });

    await openRowAction(page, firstRoleRow, /^AI数据权限$/);
    const aiPolicyDialog = page.locator(".mci-unified-dialog:visible").last();
    await expect(aiPolicyDialog.locator(".sysrole-ai-policy-panel")).toBeVisible({ timeout: 30_000 });
    await aiPolicyDialog.getByRole("button", { name: /^(?:Close|关闭)$/i }).first().click();
    await expect(aiPolicyDialog).toBeHidden({ timeout: 15_000 });

    await page.goto(tenantUrl("iTdos", "", "#/system/dept"), { waitUntil: "domcontentloaded" });
    const deptPage = page.locator(".left-right-page").first();
    await expect(deptPage).toBeVisible({ timeout: 45_000 });
    await expect(deptPage.locator(".left-tree-card")).toBeVisible();
    const addDept = deptPage.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first();
    await expect(addDept).toBeVisible({ timeout: 45_000 });
    await addDept.click();
    const deptDialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
    await expect(deptDialog).toBeVisible({ timeout: 30_000 });
    await expect(deptDialog).toContainText(/机构名称|部门名称|SubscriberName|Name/);
    await expect(deptDialog).toContainText(/上级机构|上级部门|选择上级|ParentId/);
    await expect(page.getByText(/url不能为空/)).toHaveCount(0);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-dept-low-code-form.png"), fullPage: false });
    expect(legacyCalls, `legacy custom CRUD endpoints were called: ${legacyCalls.join(", ")}`).toEqual([]);
});

test("角色和部门低代码表单完成事务新增、修改、删除", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    const suffix = String(Date.now()).slice(-8);
    const roleName = "接口引擎专员-Codex-" + suffix;
    const roleNameUpdated = roleName + "-已修改";
    const deptName = "低代码部门-Codex-" + suffix;
    const deptNameUpdated = deptName + "-已修改";
    let roleCreated = false;
    let deptCreated = false;

    await login(page, { osClient: "iTdos", password: LOCAL_PASSWORD });
    try {
        await page.goto(tenantUrl("iTdos", "", "#/system/role"), { waitUntil: "domcontentloaded" });
        const rolePage = page.locator(".left-right-page").first();
        await expect(rolePage).toBeVisible({ timeout: 45_000 });
        await expect(rolePage.locator(".right-table-col .el-table")).toBeVisible({ timeout: 30_000 });
        await cleanupVisibleRows(page, "接口引擎专员-Codex-");
        await rolePage.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first().click();
        let dialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        await formItem(dialog, /^(?:Role Name|角色名称)/i).locator('input[type="text"]').first().fill(roleName);
        await formItem(dialog, /^(?:Level|角色级别)/i).locator('input[type="number"]').first().fill("500");

        const permissionField = dialog.locator(".mci-role-permission-field");
        await expect(permissionField.locator(".mci-role-permission-field__tree")).toBeVisible({ timeout: 30_000 });
        await permissionField.locator('input[placeholder="筛选菜单名称"]').fill("API Engine");
        const systemEngineRow = permissionField.locator(".role-menu-row").filter({ hasText: /System Engine|系统引擎/ }).first();
        await expect(systemEngineRow).toBeVisible({ timeout: 15_000 });
        await systemEngineRow.locator(".role-menu-expand").click();
        const apiEngineRow = permissionField.locator(".role-menu-row").filter({ hasText: /API Engine|接口引擎/ }).first();
        await expect(apiEngineRow).toBeVisible({ timeout: 15_000 });
        await apiEngineRow.locator(".role-menu-check input[type='checkbox']").check();
        await expect(systemEngineRow.locator(".role-menu-check input[type='checkbox']")).toBeChecked();
        for (const permission of ["读取", "新增", "编辑", "删除"]) {
            await apiEngineRow.getByRole("checkbox", { name: permission, exact: true }).check();
        }

        const addRoleResponse = page.waitForResponse(
            (response) => isFormWriteResponse(response, "AddFormData"),
            { timeout: 30_000 }
        );
        await dialog.getByRole("button", { name: /^(?:Save|保存)$/i }).first().click();
        const addRoleResult = await (await addRoleResponse).json();
        expect(Number(addRoleResult.Code), addRoleResult.Msg || "add role failed").toBe(1);
        roleCreated = true;
        await closeFormIfOpen(dialog);

        await page.goto(tenantUrl("iTdos", "", "#/system/role"), { waitUntil: "domcontentloaded" });
        let row = await filterRightTable(page, roleName);
        const roleLimitResponse = page.waitForResponse((response) => {
            if (endpointName(response.url()) !== "GetTableData") return false;
            return String(requestBody(response.request()).FormEngineKey || "").toLowerCase() === "sys_rolelimit";
        }, { timeout: 30_000 });
        await openRowAction(page, row, /^(?:Edit|编辑)$/i);
        dialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        const limitResult = await (await roleLimitResponse).json();
        const apiLimit = (limitResult.Data || []).find((item) => item.FkId === "f873af6b-7577-44e0-b9a7-67027b54ace6");
        expect(apiLimit, JSON.stringify(limitResult).slice(0, 800)).toBeTruthy();
        const permissions = JSON.parse(apiLimit.Permission || "[]");
        expect(permissions).toEqual(expect.arrayContaining(["Read", "Add", "Edit", "Del"]));
        const parentReadLimit = (limitResult.Data || []).find((item) => {
            if (item.FkId === apiLimit.FkId) return false;
            try {
                return JSON.parse(item.Permission || "[]").includes("Read");
            } catch (error) {
                return false;
            }
        });
        expect(parentReadLimit, "System Engine parent menu Read permission was not persisted").toBeTruthy();
        await formItem(dialog, /^(?:Role Name|角色名称)/i).locator('input[type="text"]').first().fill(roleNameUpdated);
        const updateRoleResponse = page.waitForResponse(
            (response) => isFormWriteResponse(response, "UptFormData"),
            { timeout: 30_000 }
        );
        await dialog.getByRole("button", { name: /^(?:Save|保存)$/i }).first().click();
        const updateRoleResult = await (await updateRoleResponse).json();
        expect(Number(updateRoleResult.Code), updateRoleResult.Msg || "update role failed").toBe(1);
        await closeFormIfOpen(dialog);
        await page.goto(tenantUrl("iTdos", "", "#/system/role"), { waitUntil: "domcontentloaded" });
        await deleteFilteredRow(page, roleNameUpdated);
        roleCreated = false;

        await page.goto(tenantUrl("iTdos", "", "#/system/dept"), { waitUntil: "domcontentloaded" });
        const deptPage = page.locator(".left-right-page").first();
        await expect(deptPage).toBeVisible({ timeout: 45_000 });
        await expect(deptPage.locator(".right-table-col .el-table")).toBeVisible({ timeout: 30_000 });
        await cleanupVisibleRows(page, "低代码部门-Codex-");
        await deptPage.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first().click();
        dialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        await formItem(dialog, /^(?:Name|机构名称|部门名称)/i).locator('input[type="text"]').first().fill(deptName);
        const addDeptResponse = page.waitForResponse(
            (response) => isFormWriteResponse(response, "AddFormData"),
            { timeout: 30_000 }
        );
        await dialog.getByRole("button", { name: /^(?:Save|保存)$/i }).first().click();
        const addDeptResult = await (await addDeptResponse).json();
        expect(Number(addDeptResult.Code), addDeptResult.Msg || "add department failed").toBe(1);
        expect(String(addDeptResult?.Data?.Code || "")).not.toBe("");
        deptCreated = true;
        await closeFormIfOpen(dialog);

        await page.goto(tenantUrl("iTdos", "", "#/system/dept"), { waitUntil: "domcontentloaded" });
        row = await filterRightTable(page, deptName);
        await openRowAction(page, row, /^(?:Edit|编辑)$/i);
        dialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        await formItem(dialog, /^(?:Name|机构名称|部门名称)/i).locator('input[type="text"]').first().fill(deptNameUpdated);
        const updateDeptResponse = page.waitForResponse(
            (response) => isFormWriteResponse(response, "UptFormData"),
            { timeout: 30_000 }
        );
        await dialog.getByRole("button", { name: /^(?:Save|保存)$/i }).first().click();
        const updateDeptResult = await (await updateDeptResponse).json();
        expect(Number(updateDeptResult.Code), updateDeptResult.Msg || "update department failed").toBe(1);
        await closeFormIfOpen(dialog);
        await page.goto(tenantUrl("iTdos", "", "#/system/dept"), { waitUntil: "domcontentloaded" });
        await deleteFilteredRow(page, deptNameUpdated);
        deptCreated = false;
    } finally {
        if (roleCreated) {
            await page.goto(tenantUrl("iTdos", "", "#/system/role"), { waitUntil: "domcontentloaded" }).catch(() => {});
            await deleteFilteredRow(page, roleNameUpdated).catch(async () => {
                await deleteFilteredRow(page, roleName).catch(() => {});
            });
        }
        if (deptCreated) {
            await page.goto(tenantUrl("iTdos", "", "#/system/dept"), { waitUntil: "domcontentloaded" }).catch(() => {});
            await deleteFilteredRow(page, deptNameUpdated).catch(async () => {
                await deleteFilteredRow(page, deptName).catch(() => {});
            });
        }
    }
});

test("接口引擎默认关闭 V8 运行限制并在打开后显示限制项", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page, { osClient: "iTdos", password: LOCAL_PASSWORD });
    await page.goto(tenantUrl("iTdos", "", "#/api-engine"), { waitUntil: "domcontentloaded" });
    const addButton = page.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 45_000 });
    await addButton.click();

    const dialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole("tab", { name: /^(?:详细配置|Detailed Configuration)$/i }).click();
    const limitItem = formItem(dialog, /^(?:V8运行限制|V8 Runtime Limit)/i);
    await expect(limitItem).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText(/V8无运行限制|V8 Unlimited/i, { exact: false })).toBeHidden();
    const limitSwitch = limitItem.locator(".el-switch").first();
    await expect(limitSwitch).not.toHaveClass(/is-checked/);

    const runtimeLimitFields = [
        /^(?:超时时间|Timeout)/i,
        /^(?:最大语句数|Max Statements)/i,
        /^(?:累计分配预算|Memory Limit)/i,
        /^(?:递归深度限制|Recursive depth limit)/i
    ];
    for (const label of runtimeLimitFields) {
        const item = formItem(dialog, label);
        await expect(item).toHaveCount(1);
        await expect(item).toBeHidden();
    }

    await limitSwitch.click();
    await expect(limitSwitch).toHaveClass(/is-checked/);
    for (const label of runtimeLimitFields) {
        await expect(formItem(dialog, label)).toBeVisible();
    }
    const memoryItem = formItem(dialog, /^(?:累计分配预算|Memory Limit)/i);
    await expect(memoryItem).toBeVisible();
    const labelStyles = await memoryItem.evaluate((element) => {
        const label = element.querySelector(".diy-field-label__text");
        const description = element.querySelector(".diy-field-description--inline");
        const labelStyle = label ? getComputedStyle(label) : null;
        const descriptionStyle = description ? getComputedStyle(description) : null;
        return {
            labelText: label?.textContent?.trim() || "",
            labelFlexShrink: labelStyle?.flexShrink || "",
            labelOverflow: labelStyle?.overflow || "",
            descriptionOverflow: descriptionStyle?.overflow || "",
            descriptionTextOverflow: descriptionStyle?.textOverflow || ""
        };
    });
    expect(labelStyles.labelText).toMatch(/累计分配预算|Memory Limit/i);
    expect(labelStyles.labelFlexShrink).toBe("0");
    expect(labelStyles.labelOverflow).toBe("visible");
    expect(labelStyles.descriptionOverflow).toBe("hidden");
    expect(labelStyles.descriptionTextOverflow).toBe("ellipsis");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-v8-runtime-limit-off-by-default.png"), fullPage: false });
    await closeFormIfOpen(dialog);
});

test("500 级接口引擎专员可见菜单但服务端拒绝 sys_apiengine 控制面模型", async ({ page }) => {
    test.skip(!ANDERSON_PASSWORD || !RUN_LEVEL500_API_ENGINE_PROBE,
        "需要先把专用测试帐号临时分配给 500 级接口引擎专员角色");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page, {
        osClient: "iTdos",
        account: "anderson",
        password: ANDERSON_PASSWORD
    });

    const apiMenu = page.getByRole("button", { name: /^(?:API Engine|接口引擎)$/i }).first();
    await expect(apiMenu).toBeVisible({ timeout: 30_000 });
    const modelResponse = page.waitForResponse((response) => {
        if (endpointName(response.url()) !== "GetDiyTableModel") return false;
        return String(requestBody(response.request()).Id || "").toLowerCase()
            === "cf389aef-72cc-4980-9c5b-143123561ac0";
    }, { timeout: 45_000 });
    await apiMenu.click();
    const result = await (await modelResponse).json();
    expect(Number(result.Code), JSON.stringify(result).slice(0, 800)).toBe(0);
    expect(String(result.Msg || "")).toMatch(/无权限|没有权限|not authorized|permission/i);
    await expect(page).toHaveURL(/#\/api-engine(?:\?|$)/);
    await expect(page.getByRole("button", { name: /^(?:Add|新增(?:记录)?)$/i })).toHaveCount(0);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-api-engine-level500-denied.png"),
        fullPage: false
    });
});

test("全量测试表单的二维码字段按 DataAppend.Code 生成可下载 PNG", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page, { osClient: "iTdos", password: LOCAL_PASSWORD });
    await page.goto(tenantUrl("iTdos", "", "#/mci-full-test"), { waitUntil: "domcontentloaded" });
    const addButton = page.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 45_000 });
    await addButton.click();
    const dialog = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const image = dialog.locator(".diy-qrcode__card").first();
    await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/, { timeout: 45_000 });
    const imageState = await image.evaluate((element) => ({
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight
    }));
    expect(imageState.complete).toBe(true);
    expect(imageState.naturalWidth).toBeGreaterThan(0);
    expect(imageState.naturalHeight).toBeGreaterThan(0);
    await image.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-qrcode-dataappend.png"), fullPage: false });
});

test("君驰左右树表只发 _Where，空树显示全部且单击树节点不重复初始化", async ({ page }) => {
    test.skip(!JUNCHI_PASSWORD, "PW_JUNCHI_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page, {
        osClient: "junchi",
        apiBase: "https://api.chongstech.com",
        password: JUNCHI_PASSWORD
    });

    const calls = [];
    page.on("request", (request) => {
        const name = endpointName(request.url());
        if (["GetTableData", "GetSysMenuModel", "GetDiyTableModel", "GetDiyFieldByDiyTables"].includes(name)) {
            calls.push({ name, body: requestBody(request), target: isJunchiMaterialRequest(request), at: Date.now() });
        }
    });

    const firstDataResponse = page.waitForResponse((response) => {
        if (endpointName(response.url()) !== "GetTableData") return false;
        return isJunchiMaterialRequest(response.request());
    }, { timeout: 60_000 });
    await page.goto(tenantUrl(
        "junchi",
        "https://api.chongstech.com",
        "#/xiangmutiliaodan"
    ), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".left-right-page").first()).toBeVisible({ timeout: 45_000 });
    const initialResponse = await firstDataResponse;
    const initialBody = requestBody(initialResponse.request());
    const initialResult = await initialResponse.json();
    expect(initialBody._SearchEqual).toBeUndefined();
    expect(initialBody._SearchCheckbox).toBeUndefined();
    expect((initialBody._Where || []).some((item) => item?.Name === "ProjectId" && !String(item?.Value || "").trim())).toBe(false);
    expect(Array.isArray(initialResult.Data) ? initialResult.Data.length : 0, JSON.stringify(initialResult).slice(0, 600)).toBeGreaterThan(0);

    const firstNode = page.locator(".left-tree-card .el-tree-node__content:visible").first();
    await expect(firstNode).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    calls.length = 0;
    await firstNode.click();
    await expect.poll(
        () => calls.filter((call) => call.name === "GetTableData" && call.target).length,
        { timeout: 30_000 }
    ).toBeGreaterThan(0);
    await page.waitForTimeout(4_000);

    const dataCalls = calls.filter((call) => call.name === "GetTableData" && call.target);
    expect(dataCalls).toHaveLength(1);
    const selectedBody = dataCalls[0].body;
    expect(selectedBody._SearchEqual).toBeUndefined();
    expect(selectedBody._SearchCheckbox).toBeUndefined();
    const projectConditions = (selectedBody._Where || []).filter((item) => item?.Name === "ProjectId");
    expect(projectConditions).toHaveLength(1);
    expect(String(projectConditions[0].Value || "").trim()).not.toBe("");

    for (const name of ["GetSysMenuModel", "GetDiyTableModel", "GetDiyFieldByDiyTables"]) {
        expect(calls.filter((call) => call.name === name).length, `${name} duplicated after one tree click`).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-junchi-tree-where-once.png"), fullPage: false });
});
