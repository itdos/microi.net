import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const frontend = process.env.PW_BASE_URL || "http://localhost:61500";
const password = process.env.PW_LOCAL_PASSWORD || "";
const browserChannel = process.env.PW_BROWSER_CHANNEL || "";
const screenshotDir = path.resolve(
    process.cwd(),
    process.env.PW_SCREENSHOT_DIR || "../.tmp/realtime-notification-chat-acceptance"
);

test.use({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
    ...(browserChannel ? { channel: browserChannel } : {})
});
test.setTimeout(240_000);

async function login(page) {
    await page.goto(`${frontend}/?OsClient=iTdos`, { waitUntil: "domcontentloaded" });
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]'
    ].join(", ")).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill("admin");
    await page.locator('input[type="password"]').first().fill(password);

    const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate(element => (
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
    const result = await (await responsePromise).json();
    expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
    await expect(page.getByRole("button", { name: /管理员|admin/i }).first())
        .toBeVisible({ timeout: 30_000 });
}

test("聊天联系人和历史对象始终显示 Name 或 Account", async ({ page }) => {
    test.skip(!password, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(screenshotDir, { recursive: true });
    await login(page);

    const realtime = page.locator(".chat-realtime-indicator");
    await expect(realtime).toHaveClass(/is-connected/, { timeout: 45_000 });
    await realtime.click();
    const panel = page.locator(".vChat-wrapper:visible");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    const recentNames = panel.locator(".J__recordList .title");
    await expect(recentNames.first()).toBeVisible({ timeout: 20_000 });
    const recentText = (await recentNames.allTextContents()).map(value => value.trim());
    expect(recentText.length).toBeGreaterThan(0);
    expect(recentText.every(Boolean), JSON.stringify(recentText)).toBe(true);

    await panel.locator(".vChat-sidebar > .list.flex1 li").nth(1).click();
    const directoryNames = panel.locator(".J__addrFriendList .name");
    await expect(directoryNames.first()).toBeVisible({ timeout: 20_000 });
    const directoryText = (await directoryNames.allTextContents()).map(value => value.trim());
    expect(directoryText.length).toBeGreaterThan(0);
    expect(directoryText.every(Boolean), JSON.stringify(directoryText)).toBe(true);
    await panel.screenshot({ path: path.join(screenshotDir, "chat-name-account-fallback.png") });
});

test("SignalR状态、admin平台会话、AI闭环和后台任务事件驱动", async ({ page }, testInfo) => {
    test.skip(!password, "PW_LOCAL_PASSWORD is required");
    await fs.mkdir(screenshotDir, { recursive: true });

    const taskRequests = [];
    const webSockets = [];
    const consoleErrors = [];
    page.on("request", request => {
        if (/\/api\/BackgroundTask\/List(?:\?|$)/i.test(request.url())) {
            taskRequests.push({ url: request.url(), at: Date.now() });
        }
    });
    page.on("websocket", socket => webSockets.push(socket.url()));
    page.on("console", message => {
        if (message.type() === "error") consoleErrors.push(message.text());
    });

    await login(page);

    const realtime = page.locator(".chat-realtime-indicator");
    await expect(realtime).toHaveClass(/is-connected/, { timeout: 45_000 });
    expect(webSockets.some(url => /\/diy-websocket\?/i.test(url))).toBe(true);

    await realtime.click();
    await expect(page.locator(".vChat-wrapper")).toBeVisible({ timeout: 15_000 });
    const recentList = page.locator(".vc-recordList");
    await expect(recentList.getByText("AI助手", { exact: true }).first()).toBeVisible();
    await expect(recentList.getByText("admin", { exact: true }).first()).toBeVisible();
    await page.screenshot({
        path: path.join(screenshotDir, "chat-quick-contacts.png"),
        fullPage: true
    });

    await recentList.getByText("admin", { exact: true }).first().click();
    await expect(page.locator(".vChat__header .barTit")).toHaveText("admin");
    const editor = page.locator("#J__wcEditor");
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(editor).toHaveAttribute("placeholder", /只读/);

    await recentList.getByText("AI助手", { exact: true }).first().click();
    await expect(page.locator(".vChat__header .barTit")).toHaveText("AI助手");
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await page.waitForTimeout(1500);
    const beforeAiCount = await page.locator("#J__chatMsgList li.others").count();
    const prompt = `请只回复“SignalR正常” ${Date.now()}`;
    await editor.fill(prompt);
    await page.locator(".J__wchatSubmit").click();
    await expect.poll(
        () => page.locator("#J__chatMsgList li.others").count(),
        { timeout: 60_000 }
    ).toBeGreaterThan(beforeAiCount);
    const aiReply = page.locator("#J__chatMsgList li.others").last();
    await expect(aiReply.locator(".msg")).not.toContainText("正在思考", { timeout: 120_000 });
    const aiReplyText = (await aiReply.locator(".msg").innerText()).trim();
    expect(aiReplyText).toContain("SignalR正常");
    expect(aiReplyText).not.toMatch(/AI回复失败|暂时无法回复|数据查询失败/);
    await expect(aiReply.locator(".msg.ai-error")).toHaveCount(0);
    await page.waitForTimeout(2_000);
    await expect(page.locator("#J__chatMsgList")).toContainText("SignalR正常");
    await page.screenshot({
        path: path.join(screenshotDir, "chat-ai-result.png"),
        fullPage: true
    });

    await realtime.click();
    const beforeOpen = taskRequests.length;
    await page.locator(".task-entry").click();
    const dialog = page.locator(".microi-notification-dialog:visible");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("tab", { name: /后台任务|Background tasks/i }).click();
    await page.waitForTimeout(11_000);
    expect(taskRequests.length - beforeOpen, JSON.stringify(taskRequests)).toBeLessThanOrEqual(1);

    const taskRows = dialog.locator(".task-table .el-table__body-wrapper tbody tr");
    if (await taskRows.count()) {
        await expect(dialog.locator(".task-table")).toContainText(
            /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/
        );
    } else {
        testInfo.annotations.push({ type: "note", description: "当前租户没有后台任务行，日期格式由单元契约覆盖。" });
    }
    await expect(dialog).toBeVisible();
    await dialog.screenshot({
        path: path.join(screenshotDir, "background-task-full-datetime.png"),
    });

    expect(consoleErrors.filter(text => /聊天服务未就绪|Cannot send data if the connection is not/i.test(text)))
        .toEqual([]);
    await testInfo.attach("realtime-evidence.json", {
        body: JSON.stringify({
            websocketUrls: webSockets,
            backgroundTaskListRequests: taskRequests,
            aiReplyText,
            consoleErrors
        }, null, 2),
        contentType: "application/json"
    });
});
