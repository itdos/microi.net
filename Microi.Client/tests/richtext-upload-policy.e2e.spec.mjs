import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const API_BASE = process.env.PW_API_BASE || "https://localhost:61501";
const OS_CLIENT = "iTdos";
const LOCAL_PASSWORD = process.env.PW_LOCAL_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const TABLE_ID = "4232ebac-abb7-4981-b0de-a8bdad5dc53a";
const RECORD_ID = "37c709bf-d597-46ea-80d1-99b97ea10ac4";
const RECORD_TITLE = "Codex富文本私有回读验收";
const TEST_IMAGE = path.resolve(process.cwd(), "public/static/img/more.png");
const SCREENSHOT_DIR = path.resolve(process.cwd(), "../.tmp/richtext-upload-acceptance");

test.use({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

function tenantUrl(hash = "") {
    // 显式绑定本次验收的后端，便于共享 61501 被其它任务占用时使用隔离实例，
    // 同时避免浏览器 localStorage 中旧 ApiBase 污染测试结果。
    return `${FRONTEND}/?OsClient=iTdos&ApiBase=${encodeURIComponent(API_BASE)}${hash}`;
}

async function login(page) {
    await page.goto(tenantUrl(), { waitUntil: "domcontentloaded" });
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="user name" i]',
        'input[placeholder*="username" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill("admin");
    await page.locator('input[type="password"]').first().fill(LOCAL_PASSWORD);
    const responsePromise = page.waitForResponse(
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const response = await responsePromise;
    const result = await response.json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 60_000 });
    const rawToken = response.headers()["authorization"]
        || result.Data?.Token
        || result.Token
        || result.DataAppend?.Token;
    const token = String(rawToken || "").replace(/^Bearer\s+/iu, "");
    expect(token, "UI login did not return a DiyToken").not.toBe("");
    return token;
}

async function chooseDesignerField(page, fieldName) {
    const selector = page.getByTestId("designer-field-search").first();
    await expect(selector).toBeVisible({ timeout: 45_000 });
    await selector.click();
    await selector.locator("input").first().fill(fieldName);
    const option = page.locator(".el-select-dropdown:visible .el-select-dropdown__item")
        .filter({ hasText: fieldName })
        .first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();
    const selectedField = page.locator(".field-drag-handle.selected-field").first();
    await expect(selectedField).toBeVisible({ timeout: 30_000 });
    return selectedField;
}

async function callFormEngine(page, token, action, data) {
    const response = await page.request.post(`${API_BASE}/api/FormEngine/${action}`, {
        headers: {
            authorization: `Bearer ${token}`,
            OsClient: OS_CLIENT
        },
        data,
        ignoreHTTPSErrors: true
    });
    expect(response.status(), action).toBe(200);
    return response.json();
}

async function openPrivateRichTextRecord(page, { edit = true } = {}) {
    await page.goto(tenantUrl("#/notepad?ViewMode=Table"), { waitUntil: "domcontentloaded" });
    const row = page.locator(".el-table__body-wrapper tbody tr")
        .filter({ hasText: RECORD_TITLE })
        .first();
    await expect(row).toBeVisible({ timeout: 45_000 });
    await row.dblclick();
    let form = page.locator([
        ".diy-form-container.el-dialog:visible",
        ".diy-form-container.el-drawer:visible"
    ].join(", ")).last();
    await expect(form).toBeVisible({ timeout: 30_000 });
    if (!edit) return { form, policy: null };

    const editButton = form.getByRole("button", { name: /^(?:Edit|编辑)$/i }).first();
    if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        form = page.locator([
            ".diy-form-container.el-dialog:visible",
            ".diy-form-container.el-drawer:visible"
        ].join(", ")).last();
        await expect(form).toBeVisible({ timeout: 30_000 });
    }
    const policy = form.locator(".richtext-policy-bar").first();
    await policy.scrollIntoViewIfNeeded();
    await expect(policy).toContainText("私有桶");
    return { form, policy };
}

async function chooseRichTextImage(page, form) {
    const imageMenu = form.locator('[data-menu-key="group-image"]').first();
    await expect(imageMenu).toBeVisible({ timeout: 30_000 });
    await imageMenu.click();
    const uploadButton = page.locator('[data-menu-key="uploadImage"]:visible').first();
    await expect(uploadButton).toBeVisible({ timeout: 30_000 });
    const uploadResponsePromise = page.waitForResponse(
        (response) => /\/api\/HDFS\/Upload(?:\?|$)/i.test(response.url()),
        { timeout: 60_000 }
    );
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
    await uploadButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(TEST_IMAGE);
    const uploadResponse = await uploadResponsePromise;
    const uploadResult = await uploadResponse.json();
    expect(Number(uploadResult.Code), uploadResult.Msg || "rich-text image upload failed").toBe(1);
    const uploaded = Array.isArray(uploadResult.Data) ? uploadResult.Data[0] : uploadResult.Data;
    expect(String(uploaded?.Path || uploaded?.FilePathName || "")).not.toBe("");
    expect([true, 1, "true"].includes(uploaded?.Limit)).toBe(true);
    return uploaded;
}

test("富文本配置弹层完整展示公私桶与图片、视频、文件策略", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page);
    await page.goto(tenantUrl(`#/diy/diy-design/${TABLE_ID}?PageType=`), { waitUntil: "domcontentloaded" });

    const selectedField = await chooseDesignerField(page, "富文本");
    await selectedField.dblclick();
    const dialog = page.getByRole("dialog", { name: "富文本与附件配置", exact: true }).first();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText("统一存储范围", { exact: true })).toBeVisible();
    await expect(dialog.getByText("私有桶", { exact: true })).toBeVisible();
    await expect(dialog.getByText("公有桶", { exact: true })).toBeVisible();
    await expect(dialog.getByText("图片", { exact: true })).toBeVisible();
    await expect(dialog.getByText("视频", { exact: true })).toBeVisible();
    await expect(dialog.getByText("文件附件", { exact: true })).toBeVisible();
    await expect(dialog).toContainText("不会保存临时 Token");

    const panel = dialog.locator(".el-dialog").first();
    await expect(panel).toBeVisible();
    const layout = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            width: rect.width,
            right: rect.right,
            viewportWidth: window.innerWidth,
            overflowX: element.scrollWidth - element.clientWidth
        };
    });
    expect(layout.width).toBeLessThanOrEqual(800);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.overflowX).toBeLessThanOrEqual(1);
    await panel.screenshot({ path: path.join(SCREENSHOT_DIR, "richtext-config-dialog.png") });
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
});

test("富文本私有图片上传后编辑值自动还原为稳定标识且不保存临时 Token", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    await login(page);
    await page.goto(tenantUrl("#/mci-full-test"), { waitUntil: "domcontentloaded" });
    const addButton = page.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 45_000 });
    await addButton.click();

    const form = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
    await expect(form).toBeVisible({ timeout: 30_000 });
    const policy = form.locator(".richtext-policy-bar").first();
    await policy.scrollIntoViewIfNeeded();
    await expect(policy).toContainText("私有桶");
    await expect(policy).toContainText("图片 20M");
    await expect(policy).toContainText("压缩至 500KB");
    await expect(policy).toContainText("视频 200M");
    await expect(policy).toContainText("文件 100M");

    const imageMenu = form.locator('[data-menu-key="group-image"]').first();
    await expect(imageMenu).toBeVisible({ timeout: 30_000 });
    await imageMenu.click();
    const uploadButton = page.locator('[data-menu-key="uploadImage"]:visible, button[title*="上传图片"]:visible, button[title*="Upload image"]:visible').first();
    await expect(uploadButton).toBeVisible({ timeout: 30_000 });
    const uploadResponsePromise = page.waitForResponse(
        (response) => /\/api\/HDFS\/Upload(?:\?|$)/i.test(response.url()),
        { timeout: 60_000 }
    );
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
    await uploadButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(TEST_IMAGE);
    const uploadResponse = await uploadResponsePromise;
    const uploadResult = await uploadResponse.json();
    expect(Number(uploadResult.Code), uploadResult.Msg || "rich-text image upload failed").toBe(1);
    const uploaded = Array.isArray(uploadResult.Data) ? uploadResult.Data[0] : uploadResult.Data;
    expect(String(uploaded?.Path || uploaded?.FilePathName || "")).not.toBe("");
    expect([true, 1, "true"].includes(uploaded?.Limit)).toBe(true);

    const editorImage = form.locator(".richtext-wysiwyg img").first();
    await expect(editorImage).toBeVisible({ timeout: 30_000 });
    const sourceButton = form.locator('[data-menu-key="microiSourceCode"]').first();
    await expect(sourceButton).toBeVisible();
    await sourceButton.click();
    const source = form.locator(".richtext-source-code").first();
    await expect(source).toBeVisible();
    const canonicalHtml = await source.inputValue();
    expect(canonicalHtml).toContain("/__microi_richtext_private__/");
    expect(canonicalHtml).not.toMatch(/(?:Token|Ticket)=/i);
    await policy.scrollIntoViewIfNeeded();
    await form.screenshot({ path: path.join(SCREENSHOT_DIR, "richtext-private-upload.png") });

    await source.fill("<p>源码同步回归</p>");
    await sourceButton.click();
    await expect(source).toBeHidden();
    await expect(form.locator(".richtext-wysiwyg").first()).toContainText("源码同步回归");
});

test("富文本私有图片保存并重新打开后按权限刷新预览地址", async ({ page }) => {
    test.skip(!LOCAL_PASSWORD, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const token = await login(page);
    const originalResult = await callFormEngine(page, token, "GetFormData", {
        FormEngineKey: "diy_notepad",
        Id: RECORD_ID
    });
    expect(Number(originalResult.Code), originalResult.Msg || "read acceptance record failed").toBe(1);
    const original = originalResult.Data || {};
    let recordPrepared = false;

    try {
        await page.goto(tenantUrl("#/mci-full-test"), { waitUntil: "domcontentloaded" });
        const addButton = page.getByRole("button", { name: /^(?:新增(?:记录)?|Add)$/i }).first();
        await expect(addButton).toBeVisible({ timeout: 45_000 });
        await addButton.click();
        let activeForm = page.locator(".diy-form-container.el-dialog:visible, .diy-form-container.el-drawer:visible").last();
        await expect(activeForm).toBeVisible({ timeout: 30_000 });
        await chooseRichTextImage(page, activeForm);
        const editorImage = activeForm.locator(".richtext-wysiwyg img").first();
        await expect(editorImage).toBeVisible({ timeout: 30_000 });

        const sourceButton = activeForm.locator('[data-menu-key="microiSourceCode"]').first();
        await sourceButton.click();
        const source = activeForm.locator(".richtext-source-code").first();
        await expect(source).toBeVisible();
        const canonicalBeforeSave = await source.inputValue();
        expect(canonicalBeforeSave).toContain("/__microi_richtext_private__/");
        expect(canonicalBeforeSave).not.toMatch(/(?:Token|Ticket)=/i);

        const saveResult = await callFormEngine(page, token, "UptFormData", {
            FormEngineKey: "diy_notepad",
            Id: RECORD_ID,
            _FormData: {
                Biaoti: RECORD_TITLE,
                Neirong: canonicalBeforeSave
            }
        });
        expect(Number(saveResult.Code), saveResult.Msg || "persist private rich-text marker failed").toBe(1);
        recordPrepared = true;

        ({ form: activeForm } = await openPrivateRichTextRecord(page, { edit: false }));
        const reopenedImage = activeForm.locator(".richtext-view-content img").first();
        await expect(reopenedImage).toBeVisible({ timeout: 30_000 });
        await expect.poll(async () => reopenedImage.evaluate((image) => ({
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            src: image.currentSrc || image.src
        })), { timeout: 30_000 }).toMatchObject({ complete: true });
        const reopenedState = await reopenedImage.evaluate((image) => ({
            naturalWidth: image.naturalWidth,
            src: image.currentSrc || image.src
        }));
        expect(reopenedState.naturalWidth).toBeGreaterThan(0);
        expect(reopenedState.src).not.toContain("/__microi_richtext_private__/");
        expect(reopenedState.src).toMatch(/\/api\/HDFS\/OpenPrivateFile\?/iu);
        await activeForm.screenshot({ path: path.join(SCREENSHOT_DIR, "richtext-private-reopened.png") });

        const storedResult = await callFormEngine(page, token, "GetFormData", {
            FormEngineKey: "diy_notepad",
            Id: RECORD_ID
        });
        expect(Number(storedResult.Code), storedResult.Msg || "read persisted marker failed").toBe(1);
        const canonicalAfterReopen = String(storedResult.Data?.Neirong || "");
        expect(canonicalAfterReopen).toContain("/__microi_richtext_private__/");
        expect(canonicalAfterReopen).not.toMatch(/(?:Token|Ticket)=/i);
    } finally {
        if (recordPrepared) {
            const restoreResult = await callFormEngine(page, token, "UptFormData", {
                FormEngineKey: "diy_notepad",
                Id: RECORD_ID,
                _FormData: {
                    Biaoti: original.Biaoti ?? "",
                    Neirong: original.Neirong ?? ""
                }
            });
            expect(Number(restoreResult.Code), restoreResult.Msg || "restore rich-text acceptance record failed").toBe(1);
        }
    }
});
