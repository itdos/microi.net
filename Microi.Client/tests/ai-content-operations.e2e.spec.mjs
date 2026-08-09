import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const API_BASE = process.env.PW_API_BASE || "https://localhost:61501";
const OS_CLIENT = process.env.PW_OS_CLIENT || "iTdos";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "admin";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  process.env.PW_SCREENSHOT_DIR || "../AI-Project/microi/推广/验收/2026-08-09-ai-content-operations"
);

test.use({
  viewport: { width: 1920, height: 1080 },
  ignoreHTTPSErrors: true,
  ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.setTimeout(150_000);

async function loginThroughUi(page) {
  await page.goto(`${FRONTEND}/?OsClient=${encodeURIComponent(OS_CLIENT)}`, { waitUntil: "domcontentloaded" });
  const account = page.locator([
    'input[placeholder*="用户名"]',
    'input[placeholder*="账号"]',
    'input[placeholder*="帐号"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="user name" i]'
  ].join(", ")).first();
  const password = page.locator('input[type="password"], input[placeholder*="user password" i]').first();
  await expect(account).toBeVisible({ timeout: 30_000 });
  await account.fill(ACCOUNT);
  await password.fill(PASSWORD);

  const privacy = page.locator(".privacy-policy-wrapper .el-checkbox").first();
  if (await privacy.isVisible().catch(() => false)) {
    const checked = await privacy.evaluate((element) => (
      element.classList.contains("is-checked") || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
    ));
    if (!checked) await privacy.click();
  }

  const responsePromise = page.waitForResponse(
    (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
    { timeout: 30_000 }
  );
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const response = await responsePromise;
  const result = await response.json();
  expect(Number(result.Code), result.Msg || "UI login failed").toBe(1);
  const rawAuthorization = response.headers()["authorization"]
    || result.Data?.Token
    || result.Token
    || result.DataAppend?.Token;
  const token = String(rawAuthorization || "").replace(/^Bearer\s+/i, "");
  expect(token).toBeTruthy();
  await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  return token;
}

async function gotoModule(page, route) {
  await page.goto(`${FRONTEND}/?OsClient=${encodeURIComponent(OS_CLIENT)}#${route}`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`#${route.replaceAll("/", "\\/")}(?:[?&]|$)`), { timeout: 30_000 });
  await expect(page.locator(".el-loading-mask:visible")).toHaveCount(0, { timeout: 45_000 });
}

test("AI 内容运营菜单、定时入口与 MiniMax 受保护 API 在共享服务中可用", async ({ page }) => {
  test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const token = await loginThroughUi(page);
  await gotoModule(page, "/mci-ai-content-plan");
  await expect(page.getByText("默认 AI 内容创作与发布计划", { exact: false }).first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: "启用/校准定时发布", exact: true }).first()).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "content-plan-1920x1080.png"), fullPage: false });

  await gotoModule(page, "/mci-ai-content-asset");
  await expect(page.getByRole("columnheader", { name: "资产类型", exact: true }).first()).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "content-assets-1920x1080.png"), fullPage: false });

  const sourceResponse = await page.request.get(`${FRONTEND}/src/utils/v8-ai.js`);
  expect(sourceResponse.ok()).toBeTruthy();
  const source = await sourceResponse.text();
  for (const symbol of ["CreateMiniMaxVideoAsync", "GetMiniMaxVideoTaskAsync", "GetMiniMaxVideoFileAsync"]) {
    expect(source).toContain(symbol);
  }

  const headers = { authorization: `Bearer ${token}`, OsClient: OS_CLIENT };
  const guardedCalls = [
    ["CreateMiniMaxVideo", { RequestId: "bad", Prompt: "route validation only" }],
    ["GetMiniMaxVideoTask", { TaskHandle: "invalid-handle" }],
    ["GetMiniMaxVideoFile", { FileHandle: "invalid-handle" }]
  ];
  for (const [action, data] of guardedCalls) {
    const response = await page.request.post(`${API_BASE}/api/Ai/${action}`, { headers, data, ignoreHTTPSErrors: true });
    expect(response.status(), action).toBe(200);
    const result = await response.json();
    expect(Number(result.Code), action).toBe(0);
    expect(String(result.Msg || ""), action).not.toMatch(/MissingToken|请求未携带Token/);
  }

  expect(pageErrors.filter((item) => /ReferenceError|TypeError|Unhandled/i.test(item))).toEqual([]);
});
