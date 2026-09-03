import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "admin";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const SCREENSHOT_DIR = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || ".tmp/ai-image-studio-acceptance"
);
const ONE_PIXEL_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
);

test.use({
    viewport: { width: 1640, height: 900 },
    ignoreHTTPSErrors: true,
    ...(process.env.PW_BROWSER_CHANNEL ? { channel: process.env.PW_BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

function tenantUrl(route = "") {
    return `${FRONTEND}/?OsClient=iTdos${route ? `#${route}` : ""}`;
}

function unwrapDosResult(value) {
    let current = value || {};
    for (let index = 0; index < 3; index += 1) {
        const nested = current?.Data ?? current?.data;
        if (!nested || typeof nested !== "object" || nested.Code === undefined) break;
        current = nested;
    }
    return current;
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
    const payload = await (await responsePromise).json();
    expect(Number(payload.Code), payload.Msg || "UI login failed").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
}

test("AI 助手首屏可发现全部工作台，29 个图片工具可用且精确处理真实落盘", async ({ page }) => {
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await login(page);
    await page.goto(tenantUrl("/mic-ai-engine"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/#\/mic-ai-engine(?:[?&]|$)/, { timeout: 30_000 });
    const assistant = page.locator('.ai-engine-page:not(.is-compact)[data-testid="unified-ai-assistant"]:visible').last();
    await expect(assistant).toBeVisible({ timeout: 45_000 });

    for (const id of ["chat", "data", "image", "music", "video", "models"]) {
        await expect(assistant.locator(`[data-testid="ai-capability-${id}"]`)).toBeVisible();
    }

    await expect(assistant.locator('.ai-engine-sidebar')).toHaveCount(0);
    await expect(assistant.locator('button[data-testid^="ai-image-tool-"]')).toHaveCount(29);
    await assistant.locator('[data-testid="ai-capability-image"]').click();
    const studio = page.locator('[data-testid="ai-image-studio"]:visible').last();
    await expect(studio).toBeVisible({ timeout: 30_000 });
    await expect(studio.getByRole("heading", { name: "AI 图像工作台", exact: true })).toBeVisible();

    const discovered = [];
    for (const category of ["生成", "AI 编辑", "人像商品", "精确处理"]) {
        await studio.getByRole("button", { name: new RegExp(`^${category}`) }).click();
        discovered.push(...await studio.locator(".tool-row strong").allTextContents());
    }
    expect(new Set(discovered).size).toBe(29);
    for (const required of [
        "文生图", "图生图", "AI 高清放大", "AI 消除", "AI 扩图", "AI 去水印",
        "AI 证件照", "多图合成", "AI 重绘", "AI 抠图", "AI 黑白上色",
        "老照片修复", "AI 换背景", "人像精修", "商品场景图", "多图拼接"
    ]) expect(discovered).toContain(required);

    await studio.getByRole("button", { name: /^精确处理/ }).click();
    await studio.locator('[data-testid="ai-image-tool-grayscale"]').click();
    await studio.locator('input[type="file"]').setInputFiles({
        name: "acceptance-pixel.png",
        mimeType: "image/png",
        buffer: ONE_PIXEL_PNG
    });
    const exactResponsePromise = page.waitForResponse(
        (response) => /\/apiengine\/platform-ai-runtime(?:\?|$)/i.test(response.url()),
        { timeout: 90_000 }
    );
    await studio.locator('[data-testid="ai-image-run"]').click();
    const exactResponse = await exactResponsePromise;
    expect(exactResponse.status()).toBe(200);
    const exactResult = unwrapDosResult(await exactResponse.json());
    expect(Number(exactResult.Code), exactResult.Msg || "ProcessImage failed").toBe(1);
    expect(exactResult.Data?.Operation).toBe("grayscale");
    expect(exactResult.Data?.Permanent).toBe(true);
    expect(exactResult.Data?.FileName).toMatch(/^ai-grayscale-[A-Za-z0-9_-]+\.png$/);
    expect(exactResult.Data?.FileUrl).toMatch(/^https:\/\//);
    await expect(studio.locator(".result-grid figure")).toHaveCount(1, { timeout: 30_000 });
    const fileResponse = await page.request.get(exactResult.Data.FileUrl);
    expect(fileResponse.ok()).toBeTruthy();

    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-image-studio-desktop-1640x900.png"),
        fullPage: false
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(tenantUrl("/mic-ai-engine?workspace=image&tool=id-photo"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="ai-image-tool-id-photo"]:visible').last()).toBeVisible({ timeout: 45_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-image-studio-mobile-390x844.png"),
        fullPage: false
    });

    expect(pageErrors, `page errors: ${pageErrors.join("\n")}`).toEqual([]);
});

test("音乐工作台首屏可发现，预设、提交和音轨结果形成完整 UI 闭环", async ({ page }) => {
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route(/\/api\/Ai\/GenerateMiniMaxMusic(?:\?|$)/i, async (route) => {
        const body = route.request().postDataJSON();
        expect(body.Model).toBe("music-3.0");
        expect(body.IsInstrumental).toBe(true);
        expect(body.Prompt).toContain("科技");
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                Code: 1,
                Data: {
                    FileName: "ai-music-ui-acceptance.wav",
                    FileUrl: "https://static.itdos.com/itdos/ai-music/ui-acceptance.wav",
                    Format: "wav",
                    Model: "MiniMaxAI/MiniMax-Music3",
                    ModelFallbackUsed: true,
                    ModelFallbackReason: "UI acceptance fixture",
                    DurationMilliseconds: 20_000,
                    Permanent: true,
                    Storage: "Microi.HDFS"
                }
            })
        });
    });

    await login(page);
    await page.goto(tenantUrl("/mic-ai-engine?workspace=music"), { waitUntil: "domcontentloaded" });
    const music = page.locator('[data-testid="ai-music-studio"]:visible').last();
    await expect(music).toBeVisible({ timeout: 45_000 });
    await expect(music.getByRole("heading", { name: "一句灵感，生成可直接试听的配乐" })).toBeVisible();
    await expect(music.getByText("公开算力可能排队或限额", { exact: false })).toBeVisible();
    await music.getByRole("button", { name: /品牌科技/ }).click();
    await expect(music.locator('textarea[data-testid="ai-music-prompt"], [data-testid="ai-music-prompt"] textarea').first()).toHaveValue(/科技品牌配乐/);
    await music.locator('[data-testid="ai-music-run"]').click();
    await expect(music.locator("audio")).toBeVisible({ timeout: 30_000 });
    await expect(music.getByText("MiniMaxAI/MiniMax-Music3", { exact: false }).first()).toBeVisible();
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-music-workbench-ui.png"),
        fullPage: false
    });
    expect(pageErrors, `page errors: ${pageErrors.join("\n")}`).toEqual([]);
});

test("MiniMax 文生图和私有参考图图生图均返回持久 HDFS 资产", async ({ page }) => {
    test.skip(process.env.PW_RUN_PAID_AI_IMAGE !== "1", "Set PW_RUN_PAID_AI_IMAGE=1 for real paid image-provider acceptance.");
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    test.setTimeout(600_000);
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    await login(page);
    await page.goto(tenantUrl("/mic-ai-engine?workspace=image&tool=text-to-image"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/#\/mic-ai-engine\?workspace=image/, { timeout: 30_000 });
    const studio = page.locator('[data-testid="ai-image-studio"]:visible').last();
    await expect(studio).toBeVisible({ timeout: 45_000 });

    const imagePrompt = studio.locator('textarea[data-testid="ai-image-prompt"], [data-testid="ai-image-prompt"] textarea').first();
    await imagePrompt.fill("一位虚构的成年东方男性产品设计师正面半身肖像，简洁浅灰摄影棚背景，自然柔光，真实商业摄影，不含文字和标志");
    const textResponsePromise = page.waitForResponse(
        (response) => /\/api\/Ai\/GenerateMiniMaxImage(?:\?|$)/i.test(response.url()),
        { timeout: 240_000 }
    );
    await studio.locator('[data-testid="ai-image-run"]').click();
    const textResponse = await textResponsePromise;
    expect(textResponse.status()).toBe(200);
    const textResult = unwrapDosResult(await textResponse.json());
    expect(Number(textResult.Code), textResult.Msg || "text-to-image failed").toBe(1);
    const generated = textResult.Data?.Images?.[0];
    expect(generated?.Permanent).toBe(true);
    expect(generated?.Storage).toBe("Microi.HDFS");
    expect(generated?.FileUrl).toMatch(/^https:\/\//);
    const generatedFile = await page.request.get(generated.FileUrl);
    expect(generatedFile.ok()).toBeTruthy();
    const generatedBuffer = await generatedFile.body();
    await expect(studio.locator(".result-grid figure")).toHaveCount(1, { timeout: 30_000 });
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-live-text-to-image.png"),
        fullPage: false
    });

    await studio.getByRole("button", { name: /^AI 编辑/ }).click();
    await studio.locator('[data-testid="ai-image-tool-image-to-image"]').click();
    await studio.locator('input[type="file"]').setInputFiles({
        name: "generated-reference.jpeg",
        mimeType: generated.ContentType || "image/jpeg",
        buffer: generatedBuffer
    });
    await imagePrompt.fill("保持人物身份与五官特征，改为站在现代低代码产品工作室，蓝绿色环境光，半身构图，真实摄影");
    const referenceResponsePromise = page.waitForResponse(
        (response) => /\/api\/Ai\/GenerateMiniMaxImage(?:\?|$)/i.test(response.url()),
        { timeout: 240_000 }
    );
    await studio.locator('[data-testid="ai-image-run"]').click();
    const referenceResponse = await referenceResponsePromise;
    expect(referenceResponse.status()).toBe(200);
    const referenceResult = unwrapDosResult(await referenceResponse.json());
    expect(Number(referenceResult.Code), referenceResult.Msg || "image-to-image failed").toBe(1);
    expect(referenceResult.Data?.Operation).toBe("image-to-image");
    expect(referenceResult.Data?.ReferenceCount).toBe(1);
    expect(referenceResult.Data?.Images?.[0]?.Permanent).toBe(true);
    expect(referenceResult.Data?.Images?.[0]?.FileUrl).toMatch(/^https:\/\//);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-live-image-to-image.png"),
        fullPage: false
    });

});

test("音乐工作台通过托管接口或官方开源 Music3 回退返回持久 HDFS 音轨", async ({ page }) => {
    test.skip(process.env.PW_RUN_PAID_AI_MUSIC !== "1", "Set PW_RUN_PAID_AI_MUSIC=1 for real music-provider acceptance.");
    test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
    test.setTimeout(420_000);
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    await login(page);
    await page.goto(tenantUrl("/mic-ai-engine?workspace=music"), { waitUntil: "domcontentloaded" });
    const music = page.locator('[data-testid="ai-music-studio"]:visible').last();
    await expect(music).toBeVisible({ timeout: 45_000 });
    const musicPrompt = music.locator('textarea[data-testid="ai-music-prompt"], [data-testid="ai-music-prompt"] textarea').first();
    await musicPrompt.fill("轻快克制的科技产品演示配乐，温暖钢琴、细腻电子脉冲与柔和打击乐，结构有推进感，无人声");
    const musicResponsePromise = page.waitForResponse(
        (response) => /\/api\/Ai\/GenerateMiniMaxMusic(?:\?|$)/i.test(response.url()),
        { timeout: 330_000 }
    );
    await music.locator('[data-testid="ai-music-run"]').click();
    const musicResponse = await musicResponsePromise;
    expect(musicResponse.status()).toBe(200);
    const musicResult = unwrapDosResult(await musicResponse.json());
    expect(Number(musicResult.Code), musicResult.Msg || "music generation failed").toBe(1);
    expect(musicResult.Data?.Permanent).toBe(true);
    expect(musicResult.Data?.Storage).toBe("Microi.HDFS");
    expect(musicResult.Data?.FileUrl).toMatch(/^https:\/\//);
    expect(["music-3.0", "MiniMaxAI/MiniMax-Music3"]).toContain(musicResult.Data?.Model);
    expect((await page.request.get(musicResult.Data.FileUrl)).ok()).toBeTruthy();
    await expect(music.locator("audio")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-live-music.png"),
        fullPage: false
    });
});
