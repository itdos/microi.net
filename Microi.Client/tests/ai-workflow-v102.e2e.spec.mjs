import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const OS_CLIENT = process.env.PW_OS_CLIENT || "iTdos";
const STANDALONE = process.env.PW_AI_WORKFLOW_STANDALONE === "1";
const TENANT_URL = `${FRONTEND}/?OsClient=${encodeURIComponent(OS_CLIENT)}`;
const ROUTE_PREFIX = STANDALONE ? "" : "/micro-app/microi-ai-workflow";
const ARTIFACT_DIR = path.resolve(process.cwd(), process.env.PW_SCREENSHOT_DIR || "../.tmp/ai-workflow-v103-acceptance");

test.use({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true, channel: process.env.PW_BROWSER_CHANNEL || "msedge" });
test.setTimeout(300_000);

async function login(page) {
    await page.goto(`${TENANT_URL}#${ROUTE_PREFIX}/relationship`, { waitUntil: "domcontentloaded" });
    const standaloneLogin = page.getByTestId("standalone-login");
    if (STANDALONE) {
        await expect(standaloneLogin).toBeVisible({ timeout: 20_000 });
        await standaloneLogin.locator('input[name="account"]').fill(ACCOUNT);
        await standaloneLogin.locator('input[name="password"]').fill(PASSWORD);
        await standaloneLogin.getByRole("button", { name: "登录并进入" }).click();
        await expect(page.getByTestId("ai-workflow-relationship-studio")).toBeVisible({ timeout: 45_000 });
        return;
    }

    const account = page.locator([
        'input[placeholder*="用户名"]', 'input[placeholder*="账号"]', 'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]', 'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill(ACCOUNT);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate(element => element.classList.contains("is-checked") || Boolean(element.querySelector('input[type="checkbox"]')?.checked));
        if (!checked) await privacy.click();
    }
    const responsePromise = page.waitForResponse(
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const response = await responsePromise;
    const result = await response.json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    const rawAuthorization = response.headers().authorization
        || result.DataAppend?.Token || result.Data?.Token || "";
    expect(String(rawAuthorization).replace(/^Bearer\s+/i, ""), "登录响应必须返回 DiyToken").not.toBe("");
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(targetHash => { window.location.hash = targetHash; }, `#${ROUTE_PREFIX}/relationship`);
    await expect(page.getByTestId("ai-workflow-relationship-studio")).toBeVisible({ timeout: 45_000 });
}

function waitForWorkflowResponse(page, action) {
    return page.waitForResponse(async response => {
        if (!/\/apiengine\/platform-ai-workflow(?:\?|$)/i.test(response.url())) return false;
        try { return String(response.request().postDataJSON()?.Action || "").toLowerCase() === action.toLowerCase(); }
        catch { return false; }
    }, { timeout: 90_000 });
}

function overlaps(first, second) {
    return first.x < second.x + second.width && first.x + first.width > second.x
        && first.y < second.y + second.height && first.y + first.height > second.y;
}

async function expectRelationshipViewport(page, studio, globe, viewportLabel) {
    const metrics = await page.evaluate(() => {
        const studioElement = document.querySelector('[data-testid="ai-workflow-relationship-studio"]');
        const globeElement = document.querySelector('[data-testid="relationship-globe"]');
        const scrollingElement = document.scrollingElement || document.documentElement;
        const scrollOwners = [];
        let current = studioElement;
        while (current) {
            const style = getComputedStyle(current);
            if (/auto|scroll/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 2) {
                scrollOwners.push({
                    tag: current.tagName,
                    className: current.className || "",
                    overflowY: style.overflowY,
                    clientHeight: current.clientHeight,
                    scrollHeight: current.scrollHeight
                });
            }
            current = current.parentElement;
        }
        return {
            viewportHeight: window.innerHeight,
            documentOverflowY: scrollingElement.scrollHeight - scrollingElement.clientHeight,
            documentOverflowX: scrollingElement.scrollWidth - scrollingElement.clientWidth,
            studioBottom: studioElement?.getBoundingClientRect().bottom || 0,
            globeBottom: globeElement?.getBoundingClientRect().bottom || 0,
            ancestorScrollOwners: scrollOwners
        };
    });
    expect(metrics.documentOverflowY, `${viewportLabel} 不得出现页面级纵向滚动条`).toBeLessThanOrEqual(2);
    expect(metrics.documentOverflowX, `${viewportLabel} 不得出现页面级横向滚动条`).toBeLessThanOrEqual(2);
    expect(metrics.studioBottom, `${viewportLabel} 关系工作台底部应在首屏内`).toBeLessThanOrEqual(metrics.viewportHeight + 2);
    expect(metrics.globeBottom, `${viewportLabel} 3D 关系图底部应在首屏内`).toBeLessThanOrEqual(metrics.viewportHeight + 2);
    expect(metrics.ancestorScrollOwners, `${viewportLabel} 关系页祖先容器不得形成第二纵向滚动层`).toEqual([]);
    await expect(studio).toBeVisible();
    await expect(globe).toBeVisible();
    return metrics;
}

test("AI 工作流平台应用验收：3D 控件、相机、首屏滚动、骨架与拖放", async ({ page }) => {
    test.skip(!ACCOUNT || !PASSWORD, "需要受保护的真实测试帐号密码");
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error?.stack || error)));

    await login(page);
    if (!STANDALONE) {
        const sidebar = page.locator(".sidebar-container-microi");
        await expect(sidebar).toBeVisible({ timeout: 30_000 });
        const workflowMenu = sidebar.getByText("AI工作流", { exact: true }).first();
        if (!await workflowMenu.isVisible({ timeout: 3_000 }).catch(() => false)) {
            const systemEngineMenu = sidebar.getByText("系统引擎", { exact: true }).first();
            if (await systemEngineMenu.isVisible().catch(() => false)) await systemEngineMenu.click();
        }
        await expect(workflowMenu, "超级管理员应能在系统引擎下看到 AI工作流 菜单").toBeVisible({ timeout: 15_000 });
        await page.screenshot({ path: path.join(ARTIFACT_DIR, "00-system-engine-ai-workflow-menu.png"), fullPage: false });
    }
    const studio = page.getByTestId("ai-workflow-relationship-studio");
    const workbench = studio.locator(".aiwf-workbench");
    const studioBox = await studio.boundingBox();
    const workbenchBox = await workbench.boundingBox();
    expect(workbenchBox.y - studioBox.y, "关系页顶部应压缩到约两条工具栏").toBeLessThanOrEqual(118);

    const overviewRequest = waitForWorkflowResponse(page, "Overview");
    await page.getByRole("button", { name: /加载关系图/ }).click();
    await expect(page.getByTestId("relationship-loading-skeleton")).toBeVisible();
    expect(Number((await (await overviewRequest).json())?.Code)).toBe(1);

    const globe = page.getByTestId("relationship-globe");
    await expect(globe.locator('canvas[data-webgl-ready="true"]')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("relationship-loading-skeleton")).toBeHidden({ timeout: 45_000 });
    const lod = globe.locator(".relationship-globe__lod");
    const cameraTools = studio.locator(".aiwf-camera-tools");
    await expect(lod).toBeVisible();
    await expect(cameraTools).toBeVisible();
    expect(overlaps(await lod.boundingBox(), await cameraTools.boundingBox()), "名称状态与相机按钮不得重叠").toBe(false);

    const autoRotate = studio.locator(".el-switch").first();
    const autoRotateInput = autoRotate.locator('input[type="checkbox"]');
    if (await autoRotateInput.isChecked()) await autoRotate.click();
    await expect(autoRotateInput).not.toBeChecked();
    await page.waitForTimeout(260);
    const cameraBefore = await globe.getAttribute("data-camera-state");
    const rebuildBefore = Number(await globe.getAttribute("data-topology-rebuilds"));
    const label = globe.locator(".relationship-globe__label:not(.is-selected)").first();
    await expect(label).toBeVisible({ timeout: 30_000 });
    await label.click();
    await page.waitForTimeout(850);
    expect(Number(await globe.getAttribute("data-topology-rebuilds")), "详情选择不得重建拓扑").toBe(rebuildBefore);
    const cameraAfter = await globe.getAttribute("data-camera-state");
    const cameraDelta = String(cameraAfter).split(",").reduce((maximum, value, index) => Math.max(maximum, Math.abs(Number(value) - Number(String(cameraBefore).split(",")[index]))), 0);
    expect(cameraDelta, "点击节点不得重置相机；只允许 OrbitControls 阻尼的亚像素收敛").toBeLessThan(0.25);
    await expectRelationshipViewport(page, studio, globe, "1920x1080");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "01-relationship-globe-compact-round-controls.png"), fullPage: false });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(350);
    await expectRelationshipViewport(page, studio, globe, "1440x900");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "01b-relationship-globe-first-screen-1440x900.png"), fullPage: false });

    const blueprintNav = page.getByRole("button", { name: "业务蓝图", exact: true }).first();
    const blueprintListResponse = page.waitForResponse(
        response => /\/api\/V8Engine\/ListBlueprints(?:\?|$)/i.test(response.url()),
        { timeout: 90_000 }
    );
    await blueprintNav.click();
    await expect(page.getByTestId("route-skeleton-library")).toBeVisible();
    const blueprintListPayload = await (await blueprintListResponse).json();
    expect(Number(blueprintListPayload?.Code), blueprintListPayload?.Msg || "业务蓝图列表读取失败").toBe(1);
    expect(String(blueprintListPayload?.Msg || "")).not.toContain("doesn't exist");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "02-blueprint-route-skeleton.png"), fullPage: false });
    await expect(page.getByTestId("blueprint-library")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("route-skeleton-library")).toBeHidden({ timeout: 45_000 });
    await expect(page.getByRole("alert").filter({ hasText: "读取失败" })).toHaveCount(0);

    const firstCard = page.locator(".blueprint-card").first();
    if (await firstCard.isVisible({ timeout: 12_000 }).catch(() => false)) {
        await firstCard.getByRole("button", { name: "打开设计器" }).click();
        await expect(page.getByTestId("route-skeleton-designer")).toBeVisible();
        await expect(page.getByTestId("blueprint-designer")).toBeVisible({ timeout: 45_000 });
        const canvas = page.getByTestId("blueprint-canvas");
        const paletteItem = page.locator(".palette-item").first();
        await expect(canvas).toBeVisible();
        await expect(paletteItem).toBeVisible();
        const beforeClick = await canvas.locator(".blueprint-node").count();
        await paletteItem.click();
        expect(await canvas.locator(".blueprint-node").count(), "单击节点库不得新增节点").toBe(beforeClick);
        await paletteItem.dragTo(canvas, { targetPosition: { x: 480, y: 260 } });
        await expect(canvas.locator(".blueprint-node")).toHaveCount(beforeClick + 1);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, "03-blueprint-drag-drop.png"), fullPage: false });
    }

    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});
