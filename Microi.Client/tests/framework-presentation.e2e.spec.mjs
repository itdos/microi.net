import { expect, test } from "@playwright/test";

const WEB_BASE = process.env.PW_PRESENTATION_WEB_BASE || "http://127.0.0.1:5178";
const API_BASE = process.env.PW_PRESENTATION_API_BASE || "https://api.chongstech.com";
const OS_CLIENT = process.env.PW_PRESENTATION_OSCLIENT || "junchi";
const ACCOUNT = process.env.PW_PRESENTATION_ACCOUNT || "admin";
const PASSWORD = process.env.PW_PRESENTATION_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_PRESENTATION_BROWSER_CHANNEL || "";
const SYSTEM_CONFIG_RECORD_ID = process.env.PW_PRESENTATION_SYSTEM_CONFIG_RECORD_ID
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
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.locator("#divLogin")).toHaveCount(0, { timeout: 30000 });
}

test("real Junchi pages render permanent inspectable source badges and a non-blocking watermark", async ({ page }, testInfo) => {
    test.skip(!PASSWORD, "PW_PRESENTATION_PASSWORD is required for the real UI login.");
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 960 });

    let patchedSysConfigResponses = 0;
    await page.route(`${API_BASE}/**`, async route => {
        const requestUrl = route.request().url();
        const isGetSysConfig = /\/api\/FormEngine\/GetSysConfig/i.test(requestUrl);
        const isLogin = /\/api\/SysUser\/Login/i.test(requestUrl);
        if (!isGetSysConfig && !isLogin) {
            await route.continue();
            return;
        }
        const response = await route.fetch();
        const payload = await response.json();
        const patchConfig = config => {
            if (!config || typeof config !== "object" || Array.isArray(config)) return false;
            Object.assign(config, {
                FrameworkWatermarkEnabled: 1,
                FrameworkWatermarkContent: "$SysTitle$ · $UserName$ · $DateTime$",
                FrameworkWatermarkDirection: "DiagonalUp",
                FrameworkWatermarkOpacity: 8,
                FrameworkWatermarkDensity: "Comfortable",
                FrameworkWatermarkFontSize: 16
            });
            return true;
        };
        if (Number(payload?.Code) === 1) {
            const candidates = isGetSysConfig
                ? [payload.Data]
                : [payload.Data?.SysConfig, payload.DataAppend?.SysConfig];
            const patched = candidates.map(patchConfig).some(Boolean);
            if (patched) {
                patchedSysConfigResponses += 1;
            }
        }
        await route.fulfill({ response, json: payload });
    });

    await page.goto(runtimeUrl("/login"), { waitUntil: "domcontentloaded" });
    await login(page);
    await page.goto(runtimeUrl(`/system-config?RecordId=${SYSTEM_CONFIG_RECORD_ID}`), {
        waitUntil: "domcontentloaded"
    });

    const presentationDiagnostics = await page.evaluate(() => {
        const piniaState = window.__VUE_APP__?._instance?.proxy?.$pinia?.state?.value || {};
        const rootDiyStore = window.__VUE_APP__?._instance?.proxy?.diyStore;
        const diyState = rootDiyStore?.$state || piniaState.DiyStore || piniaState.diy || {};
        return {
            appMounted: window.__MICROI_APP_MOUNTED__ === true,
            appReady: window.__MICROI_APP_READY__ === true,
            watermarkNodes: document.querySelectorAll('[data-mci-framework-watermark="true"]').length,
            frameworkWatermarkEnabled: diyState.SysConfig?.FrameworkWatermarkEnabled,
            sysConfigKeys: Object.keys(diyState.SysConfig || {}).filter(key => (
                key.startsWith("FrameworkWatermark")
            ))
        };
    });
    await testInfo.attach("presentation-diagnostics.json", {
        body: JSON.stringify({ patchedSysConfigResponses, ...presentationDiagnostics }, null, 2),
        contentType: "application/json"
    });
    expect(patchedSysConfigResponses).toBeGreaterThan(0);
    expect(presentationDiagnostics).toMatchObject({
        appMounted: true,
        appReady: true,
        frameworkWatermarkEnabled: 1
    });

    const watermark = page.locator('[data-mci-framework-watermark="true"]');
    await expect(watermark).toBeVisible({ timeout: 30000 });
    const watermarkState = await watermark.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const centerElement = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            viewportWidth: innerWidth,
            viewportHeight: innerHeight,
            pointerEvents: style.pointerEvents,
            interceptsCenter: centerElement === element || element.contains(centerElement)
        };
    });
    expect(watermarkState).toMatchObject({
        width: watermarkState.viewportWidth,
        height: watermarkState.viewportHeight,
        pointerEvents: "none",
        interceptsCenter: false
    });

    const interfaceStyleSection = page.getByRole("button", { name: /^(界面风格|Interface Style)\b/i }).first();
    await expect(interfaceStyleSection).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
        const counts = ((await interfaceStyleSection.textContent()) || "").match(/\d+/g) || [];
        return counts.map(Number).some(count => count > 0);
    }, { message: "界面风格分组不能把折叠字段统计成 0 项" }).toBe(true);
    await interfaceStyleSection.click();
    for (const groupFieldName of [
        "InterfaceThemeNavigationGroup",
        "InterfaceLoginExperienceGroup",
        "FrameworkPresentationGroup",
        "InterfaceTenantExtensionGroup"
    ]) {
        await expect(page.locator(`.field_${groupFieldName} .diy-collapse-group`).first()).toBeVisible();
    }
    const presentationGroup = page.locator(".field_FrameworkPresentationGroup .diy-collapse-group").first();
    await expect(presentationGroup).toHaveAttribute("aria-expanded", "false");
    await presentationGroup.click();
    await expect(presentationGroup).toHaveAttribute("aria-expanded", "true");
    for (const fieldName of [
        "FrameworkWatermarkEnabled",
        "FrameworkWatermarkContent",
        "FrameworkWatermarkDirection",
        "FrameworkWatermarkOpacity",
        "FrameworkWatermarkDensity",
        "FrameworkWatermarkFontSize"
    ]) {
        await expect(page.locator(`.field_${fieldName}`).first()).toBeVisible();
    }
    for (const fieldName of [
        "MenuWidth",
        "DisableLoginGitee",
        "DisableLoginWeChat",
        "DisableLoginGitHub"
    ]) {
        const field = page.locator(`.field_${fieldName}`).first();
        if (await field.count()) {
            await expect(field, `${fieldName} 必须留在自己的折叠组，不能被框架水印组误吞`).toBeHidden();
        }
    }
    const tenantTrailingField = page.locator(".field_FileUpload145").first();
    if (await tenantTrailingField.count()) {
        const tenantExtensionGroup = page.locator(".field_InterfaceTenantExtensionGroup .diy-collapse-group").first();
        await expect(tenantExtensionGroup).toHaveAttribute("aria-expanded", "false");
        await expect(tenantTrailingField).toBeHidden();
        await presentationGroup.click();
        await expect(presentationGroup).toHaveAttribute("aria-expanded", "false");
        await expect(tenantTrailingField, "末尾租户扩展字段不能随框架水印组一起切换").toBeHidden();
        await presentationGroup.click();
        await expect(presentationGroup).toHaveAttribute("aria-expanded", "true");
        await tenantExtensionGroup.click();
        await expect(tenantExtensionGroup).toHaveAttribute("aria-expanded", "true");
        await expect(tenantTrailingField).toBeVisible();
    }
    await page.screenshot({
        path: testInfo.outputPath("junchi-system-config-interface-style-collapse-groups.png"),
        fullPage: true
    });

    const securityEntry = page.getByRole("button", {
        name: /安全与服务接入|登录与身份|Login and Identity|Security and Service Access/i
    }).first();
    await expect(securityEntry).toBeVisible({ timeout: 30000 });
    await securityEntry.click();

    const securityDialog = page.getByRole("dialog").last();
    await expect(securityDialog).toBeVisible({ timeout: 30000 });
    const microApp = securityDialog.locator("micro-app.micro-app-dialog__app").last();
    await expect(microApp, "安全与服务接入应挂载当前平台微服务").toBeVisible({ timeout: 45000 });
    await expect.poll(async () => microApp.evaluate(element => {
        const body = element.querySelector("micro-app-body")
            || element.shadowRoot?.querySelector?.("micro-app-body");
        if (!body) return false;
        const appRoot = body.querySelector?.("#app");
        const candidates = appRoot
            ? [appRoot]
            : Array.from(body.children || []).filter(child => !["SCRIPT", "STYLE", "LINK"].includes(child.tagName));
        return candidates.some(child => {
            const rect = child.getBoundingClientRect();
            const style = getComputedStyle(child);
            return rect.width > 0
                && rect.height > 0
                && style.display !== "none"
                && style.visibility !== "hidden"
                && (child.childElementCount > 0 || String(child.textContent || "").trim().length > 0);
        });
    }), {
        message: "安全与服务接入必须渲染真实子应用内容，不能只出现宿主或加载骨架",
        timeout: 45000
    }).toBe(true);
    await expect(securityDialog.getByRole("heading", { name: "服务端私有设置" }),
        "安全与服务接入应显示平台微服务的真实业务页面").toBeVisible({ timeout: 30000 });
    await expect(securityDialog.locator(".mci-micro-app-error:visible"), "当前平台微服务不能进入错误态").toHaveCount(0);
    await expect(securityDialog.getByText(/MICRO_APP_VERSION_MISMATCH|Requested version is not current\.|微服务暂时无法加载/),
        "系统设置应用不能重新固定历史微服务版本").toHaveCount(0);

    const badge = page.locator('[data-render-source="microservice"]').last();
    await expect(badge).toBeVisible({ timeout: 30000 });
    const expandedWidth = await badge.evaluate(element => element.getBoundingClientRect().width);
    expect(expandedWidth).toBeGreaterThan(60);

    await page.waitForTimeout(3200);
    await expect.poll(() => badge.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(60);
    await expect(badge.locator("[data-render-source-dismiss]"), "弹窗来源标识不需要手动关闭入口").toHaveCount(0);

    await badge.locator("[data-render-source-trigger]").click();
    const detailsDialog = page.locator(".mci-render-source-dialog:visible").last();
    await expect(detailsDialog).toBeVisible();
    await expect(detailsDialog.getByText("microi-platform-service", { exact: true }).first()).toBeVisible();
    await expect(detailsDialog.getByText("/system-settings", { exact: true }).first()).toBeVisible();
    await expect(detailsDialog.getByText(/microi_list_applications/i).first()).toBeVisible();
    await expect(detailsDialog).toContainText("当前内容由平台框架统一托管");
    await expect(detailsDialog).not.toContainText(/吾码|吾碼/);
    await page.screenshot({
        path: testInfo.outputPath("dialog-microservice-source-details.png"),
        fullPage: false
    });
    await detailsDialog.locator(".el-dialog__headerbtn").click();

    const closeButton = page.locator('.el-dialog__headerbtn:visible, .el-drawer__close-btn:visible').last();
    if (await closeButton.count()) {
        const overlap = await Promise.all([badge.boundingBox(), closeButton.boundingBox()]).then(([left, right]) => {
            if (!left || !right) return false;
            return left.x < right.x + right.width
                && left.x + left.width > right.x
                && left.y < right.y + right.height
                && left.y + left.height > right.y;
        });
        expect(overlap).toBe(false);
    }

    await page.screenshot({
        path: testInfo.outputPath("framework-watermark-and-microservice-badge.png"),
        fullPage: false
    });

    if (await closeButton.count()) await closeButton.click();
    await page.goto(runtimeUrl("/micro-app/chemical-bid-management/manager-dashboard"), {
        waitUntil: "domcontentloaded"
    });
    const menuBadge = page.locator('.micro-app-host [data-render-source="microservice"]').first();
    await expect(menuBadge, "菜单微服务必须由宿主在右上角显示来源标识").toBeVisible({ timeout: 45000 });
    await expect(menuBadge.locator("[data-render-source-dismiss]"), "菜单微服务标识必须可以手动关闭").toBeVisible();
    await page.waitForTimeout(3200);
    await expect(menuBadge).toBeVisible();

    await menuBadge.locator("[data-render-source-trigger]").click();
    const menuDetails = page.locator(".mci-render-source-dialog:visible").last();
    await expect(menuDetails).toBeVisible();
    await expect(menuDetails.getByText("chemical-bid-management", { exact: true })).toBeVisible();
    await expect(menuDetails.getByText("/manager-dashboard", { exact: true })).toBeVisible();
    await expect(menuDetails.getByText(
        "AI应用/chemical-bid-management",
        { exact: true }
    ).first(), "菜单微服务详情应至少显示可用于 AI 定位的在线应用源码根路径").toBeVisible();
    await page.screenshot({
        path: testInfo.outputPath("menu-microservice-source-details.png"),
        fullPage: false
    });
    await menuDetails.locator(".el-dialog__headerbtn").click();
    await expect(menuDetails).toBeHidden();
    await page.screenshot({
        path: testInfo.outputPath("junchi-menu-microservice-source-badge.png"),
        fullPage: false
    });
    await menuBadge.locator("[data-render-source-dismiss]").click();
    await expect(menuBadge).toHaveCount(0);

    await page.screenshot({
        path: testInfo.outputPath("junchi-menu-microservice-source-badge-dismissed.png"),
        fullPage: false
    });
});
