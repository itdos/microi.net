import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "admin";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || ".tmp/ai-engine-workcenter-acceptance"
);

test.use({
    viewport: { width: 1640, height: 900 },
    ignoreHTTPSErrors: true,
    ...(process.env.PW_BROWSER_CHANNEL
        ? { channel: process.env.PW_BROWSER_CHANNEL }
        : {})
});
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

function tenantUrl(route = "") {
    return `${FRONTEND}/?OsClient=iTdos${route ? `#${route}` : ""}`;
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
        (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const result = await (await responsePromise).json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
}

async function openRoute(page, route) {
    await page.goto(tenantUrl(route), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`#${route.replaceAll("/", "\\/")}(?:[?&]|$)`), { timeout: 30_000 });
    await expect(page.locator(".el-loading-mask:visible")).toHaveCount(0, { timeout: 45_000 });
}

function parseRgb(value) {
    const parts = String(value).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
    return parts.length === 3 ? parts : null;
}

function contrastRatio(left, right) {
    const luminance = (rgb) => {
        const channels = rgb.map((value) => {
            const normalized = value / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const a = luminance(left);
    const b = luminance(right);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("AI 对话清爽化、Markdown 安全渲染与工作中心表单模块全链路", async ({ page }) => {
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    const pageErrors = [];
    const serverErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
        if (response.status() >= 500 && /\/(api|apiengine)\//i.test(response.url())) {
            serverErrors.push(`${response.status()} ${response.url()}`);
        }
    });

    await login(page);
    await openRoute(page, "/mic-ai-engine");

    const assistant = page.getByTestId("unified-ai-assistant");
    await expect(assistant).toBeVisible({ timeout: 30_000 });
    const promptRows = assistant.locator(".quick-prompt");
    const promptCount = await promptRows.count();
    expect(promptCount).toBeGreaterThan(0);
    expect(promptCount).toBeLessThanOrEqual(4);

    const promptStyle = await promptRows.first().evaluate((element) => {
        const style = getComputedStyle(element);
        const title = element.querySelector("strong");
        const titleStyle = title ? getComputedStyle(title) : null;
        let background = "";
        let backgroundNode = element;
        while (backgroundNode) {
            const candidate = getComputedStyle(backgroundNode).backgroundColor;
            if (candidate !== "transparent" && candidate !== "rgba(0, 0, 0, 0)") {
                background = candidate;
                break;
            }
            backgroundNode = backgroundNode.parentElement;
        }
        return {
            display: style.display,
            direction: style.flexDirection,
            radius: style.borderRadius,
            shadow: style.boxShadow,
            titleColor: titleStyle?.color || "",
            background
        };
    });
    expect(promptStyle.display).toBe("flex");
    expect(promptStyle.direction).toBe("row");
    expect(promptStyle.shadow).toBe("none");
    expect(parseFloat(promptStyle.radius)).toBe(0);
    const titleRgb = parseRgb(promptStyle.titleColor);
    const backgroundRgb = parseRgb(promptStyle.background);
    expect(titleRgb).not.toBeNull();
    expect(backgroundRgb).not.toBeNull();
    expect(contrastRatio(titleRgb, backgroundRgb)).toBeGreaterThanOrEqual(4.5);

    const workspaceTabs = assistant.locator(".workspace-tab");
    expect(await workspaceTabs.count()).toBeGreaterThanOrEqual(1);
    const tabMetrics = await workspaceTabs.first().evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { height: box.height, shadow: style.boxShadow };
    });
    expect(tabMetrics.height).toBeLessThanOrEqual(36);

    const composer = assistant.locator(".composer-box");
    await expect(composer).toBeVisible();
    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox.height).toBeLessThan(150);
    await expect(assistant.getByTestId("unified-ai-settings")).toBeVisible();
    await expect(page.locator('[data-testid="unified-ai-model"]:visible')).toHaveCount(0);
    await assistant.getByTestId("unified-ai-settings").click();
    await expect(page.locator('[data-testid="unified-ai-model"]:visible').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="unified-ai-mode"]:visible').first()).toBeVisible();
    await assistant.getByTestId("unified-ai-settings").click();
    await expect(page.locator('[data-testid="unified-ai-model"]:visible')).toHaveCount(0);

    const markdownProbe = await page.evaluate(async () => {
        const { renderAiMarkdown } = await import("/src/utils/ai-markdown.js");
        const host = document.createElement("div");
        host.innerHTML = renderAiMarkdown([
            "## Markdown 标题",
            "",
            "1. **加粗列表**",
            "2. `inlineCode`",
            "",
            "<img src=x onerror=window.__microiMarkdownXss=1>",
            "[危险链接](javascript:alert(1))"
        ].join("\n"));
        return {
            html: host.innerHTML,
            heading: host.querySelector("h2")?.textContent || "",
            bold: host.querySelector("strong")?.textContent || "",
            listCount: host.querySelectorAll("ol > li").length,
            inlineCode: host.querySelector("code")?.textContent || "",
            eventAttribute: host.querySelector("img")?.getAttribute("onerror") || "",
            dangerousHref: host.querySelector("a")?.getAttribute("href") || "",
            xssExecuted: Boolean(window.__microiMarkdownXss)
        };
    });
    expect(markdownProbe.heading).toBe("Markdown 标题");
    expect(markdownProbe.bold).toBe("加粗列表");
    expect(markdownProbe.listCount).toBe(2);
    expect(markdownProbe.inlineCode).toBe("inlineCode");
    expect(markdownProbe.eventAttribute).toBe("");
    expect(markdownProbe.dangerousHref).toBe("");
    expect(markdownProbe.xssExecuted).toBeFalsy();
    expect(markdownProbe.html).not.toContain("##");
    expect(markdownProbe.html).not.toContain("**");

    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-ai-engine-clean-1640x900.png"),
        fullPage: false
    });

    await openRoute(page, "/mic-home-work-todo");
    await expect(page.getByRole("heading", { name: "我的工作", exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("button", { name: "批量审批", exact: true })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 45_000 });

    const labels = ["我的待办", "我发起的", "我处理的", "抄送我的", "与我相关"];
    for (const label of labels) {
        const tab = page.getByRole("tab", { name: label, exact: true });
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await page.waitForTimeout(350);
    }
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 45_000 });
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-form-module-workcenter-1640x900.png"),
        fullPage: false
    });

    expect(serverErrors, `server errors: ${serverErrors.join("\n")}`).toEqual([]);
    expect(pageErrors, `page errors: ${pageErrors.join("\n")}`).toEqual([]);
});
