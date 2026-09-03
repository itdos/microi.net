import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const TENANT_URL = `${FRONTEND}/?OsClient=iTdos`;
const ARTIFACT_DIR = path.resolve(process.cwd(), process.env.PW_SCREENSHOT_DIR || "../.tmp/ai-workflow-relationship-acceptance");

test.use({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
    channel: process.env.PW_BROWSER_CHANNEL || "msedge"
});
test.setTimeout(240_000);

async function login(page) {
    await page.goto(TENANT_URL, { waitUntil: "domcontentloaded" });
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill(ACCOUNT);
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
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const payload = await (await responsePromise).json();
    expect(Number(payload.Code), payload.Msg || "真实 UI 登录失败").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 45_000 });
}

function waitForWorkflowResponse(page, action) {
    return page.waitForResponse(async response => {
        if (!/\/apiengine\/platform-ai-workflow(?:\?|$)/i.test(response.url())) return false;
        try {
            return String(response.request().postDataJSON()?.Action || "").toLowerCase() === action.toLowerCase();
        } catch {
            return false;
        }
    }, { timeout: 90_000 });
}

test("AI 工作流以有界 3D 关系星图呈现业务、数据和实现关系", async ({ page }) => {
    test.skip(!ACCOUNT || !PASSWORD, "需要通过受保护进程变量提供真实测试账号密码");
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error?.stack || error)));

    await login(page);
    await page.goto(`${TENANT_URL}#/micro-app/microi-ai-workflow/relationship`, { waitUntil: "domcontentloaded" });
    const studio = page.getByTestId("ai-workflow-relationship-studio");
    await expect(studio).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { name: "业务关系星图" })).toBeVisible();
    for (const label of ["业务链路", "数据模型", "系统实现"]) {
        await expect(page.getByRole("tab", { name: new RegExp(label) })).toBeVisible();
    }
    await expect(page.getByText("先选择观察视角，再加载关系星图", { exact: true })).toBeVisible();

    const overviewPromise = waitForWorkflowResponse(page, "Overview");
    const startedAt = Date.now();
    await page.getByRole("button", { name: /加载关系图/ }).click();
    const overviewResponse = await overviewPromise;
    const overviewBody = await overviewResponse.json();
    const overviewDurationMs = Date.now() - startedAt;
    expect(Number(overviewBody?.Code), overviewBody?.Msg || "关系概览请求失败").toBe(1);
    const renderedNodes = Number(overviewBody?.Data?.Stats?.RenderedGraphNodeCount || overviewBody?.Data?.Graph?.Nodes?.length || 0);
    expect(renderedNodes).toBeGreaterThan(0);
    expect(renderedNodes).toBeLessThanOrEqual(240);

    const globe = page.getByTestId("relationship-globe");
    await expect(globe).toBeVisible();
    await expect(globe.locator('canvas[data-webgl-ready="true"]')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".aiwf-stage-caption").getByText(/\d+ 节点/)).toBeVisible();
    const renderedEdgeLabel = page.locator(".aiwf-stage-caption").getByText(/[1-9]\d* 条关系/);
    await expect(renderedEdgeLabel).toBeVisible({ timeout: 45_000 });
    const renderedUiEdges = Number((await renderedEdgeLabel.innerText()).match(/\d+/)?.[0] || 0);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai-workflow-business-1600x1000.png"), fullPage: true });

    const dataResponsePromise = waitForWorkflowResponse(page, "Overview");
    await page.getByRole("tab", { name: /数据模型/ }).click();
    const dataResponse = await dataResponsePromise;
    const dataBody = await dataResponse.json();
    expect(Number(dataBody?.Code), dataBody?.Msg || "数据模型请求失败").toBe(1);

    const firstTable = page.locator(".aiwf-resource-item").first();
    await expect(firstTable).toBeVisible({ timeout: 30_000 });
    const detailPromise = waitForWorkflowResponse(page, "NodeDetail");
    await firstTable.click();
    const detailResponse = await detailPromise;
    const detailBody = await detailResponse.json();
    expect(Number(detailBody?.Code), detailBody?.Msg || "表字段详情请求失败").toBe(1);
    const fieldCount = Number(detailBody?.Data?.Stats?.Fields || detailBody?.Data?.Details?.Fields?.length || 0);
    expect(fieldCount).toBeGreaterThan(0);
    await expect(page.getByText(new RegExp(`已读取 ${fieldCount} 个字段`))).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai-workflow-data-model-1600x1000.png"), fullPage: true });

    const domCount = await studio.locator("*").count();
    expect(domCount).toBeLessThan(3000);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await expect(studio).toBeVisible();
    if (await page.getByText("先选择观察视角，再加载关系星图", { exact: true }).isVisible().catch(() => false)) {
        const mobileOverviewPromise = waitForWorkflowResponse(page, "Overview");
        await page.getByRole("button", { name: /加载关系图/ }).click();
        const mobileOverview = await mobileOverviewPromise;
        expect(Number((await mobileOverview.json())?.Code), "移动端关系概览请求失败").toBe(1);
        await expect(page.locator(".aiwf-stage-caption").getByText(/[1-9]\d* 条关系/)).toBeVisible({ timeout: 45_000 });
    }
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai-workflow-data-model-390x844.png"), fullPage: true });

    console.log("AIWF_ACCEPTANCE", JSON.stringify({
        overviewDurationMs,
        renderedNodes,
        renderedEdges: Number(overviewBody?.Data?.Stats?.RenderedGraphEdgeCount || 0),
        renderedUiEdges,
        fieldCount,
        domCount,
        mobileOverflow: overflow
    }));
});
