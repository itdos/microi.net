import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const frontend = process.env.PW_BASE_URL || "http://localhost:61500";
const password = process.env.PW_LOCAL_PASSWORD || "";
const flowId = process.env.PW_WORKFLOW_DESIGN_ID || "";
const artifactDir = path.resolve(process.cwd(), "../.tmp/workflow-acceptance");

test.use({ viewport: { width: 1600, height: 960 }, ignoreHTTPSErrors: true, channel: process.env.PW_BROWSER_CHANNEL || "msedge" });
test.setTimeout(120_000);

test("approval workflow designer renders distinct node positions after real admin login", async ({ page }) => {
    expect(password, "PW_LOCAL_PASSWORD is required").not.toBe("");
    expect(flowId, "PW_WORKFLOW_DESIGN_ID is required").not.toBe("");
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await mkdir(artifactDir, { recursive: true });
    await page.goto(`${frontend}/?OsClient=iTdos#/login`, { waitUntil: "domcontentloaded" });
    const account = page.locator(
        'input[placeholder*="用户名"], input[placeholder*="账号"], input[placeholder*="帐号"], input[placeholder*="user name" i]'
    ).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill("admin");
    await page.locator('input[type="password"]').first().fill(password);
    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate(element =>
            element.classList.contains("is-checked") || !!element.querySelector('input[type="checkbox"]')?.checked
        );
        if (!checked) await privacy.click();
    }
    const loginResponse = page.waitForResponse(
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const login = await (await loginResponse).json();
    expect(login.Code, login.Msg || "UI login failed").toBe(1);
    await page.waitForURL(url => url.hash === "#/" || url.hash === "#", { timeout: 30_000 });
    await expect(page.getByRole("menubar")).toBeVisible({ timeout: 30_000 });

    await page.evaluate(id => { location.hash = `#/wf/flow-design/${encodeURIComponent(id)}`; }, flowId);
    const nodes = page.locator("#itdos_flowchart .itdos-wf-node");
    try {
        await expect(nodes.first()).toBeVisible({ timeout: 45_000 });
    } catch (error) {
        await page.screenshot({ path: path.join(artifactDir, "approval-designer-failed.png"), fullPage: true });
        const body = (await page.locator("body").innerText()).slice(0, 500);
        throw new Error(`Designer did not render. url=${page.url()} body=${body} errors=${errors.slice(0, 5).join(" | ")}; ${error.message}`);
    }
    const positions = await nodes.evaluateAll(elements => elements.map(element => ({
        left: getComputedStyle(element).left,
        top: getComputedStyle(element).top
    })));
    const unique = new Set(positions.map(position => `${position.left}:${position.top}`));
    expect(positions.length).toBeGreaterThanOrEqual(3);
    expect(unique.size).toBe(positions.length);
    expect(errors).toEqual([]);
    await page.screenshot({ path: path.join(artifactDir, "approval-designer.png"), fullPage: true });
});
