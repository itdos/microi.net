import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.PW_BASE_URL || "http://localhost:61500";
const OS_CLIENT = process.env.PW_OS_CLIENT || "iTdos";
const ACCOUNT = process.env.PW_TEST_ACCOUNT || "admin";
const PASSWORD = process.env.PW_TEST_PASSWORD || "";
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || "";
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  process.env.PW_SCREENSHOT_DIR || "../AI-Project/microi/推广/验收/2026-08-10-ai-platform-studio-v2"
);

const ROUTES = [
  ["overview", "治理总览"],
  ["portal", "门户编排"],
  ["identity", "身份与权限"],
  ["access", "用户组与授权"],
  ["configuration", "配置治理"],
  ["release", "灰度与发布"],
  ["services", "服务目录"],
  ["observability", "可观测与告警"],
  ["assets", "资产与协作"],
  ["import", "迁移导入"]
];

test.use({
  viewport: { width: 1920, height: 1080 },
  ignoreHTTPSErrors: true,
  ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.setTimeout(240_000);

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
  await expect(page.getByRole("button", { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
}

async function waitForStudioFrame(page) {
  await expect(page.locator(".micro-app-host")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".mci-micro-app-error")).toHaveCount(0, { timeout: 45_000 });
  for (let attempt = 0; attempt < 180; attempt += 1) {
    for (const frame of page.frames()) {
      const hasStudio = await frame.locator("header.topbar h1").count().catch(() => 0);
      if (hasStudio > 0) return frame;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`AI platform iframe did not mount. Frames: ${page.frames().map((frame) => frame.url()).join(", ")}`);
}

async function assertRoute(page, route, title, viewportName) {
  const target = `${FRONTEND}/?OsClient=${encodeURIComponent(OS_CLIENT)}#/micro-app/ai-platform-studio/${route}`;
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/micro-app/ai-platform-studio/${route}(?:[?&]|$)`), { timeout: 30_000 });
  const frame = await waitForStudioFrame(page);
  await expect(frame.locator("[data-mci-ui-root]").first()).toBeVisible({ timeout: 45_000 });
  await expect(frame.locator("header.topbar h1")).toHaveText(title, { timeout: 45_000 });
  await expect(frame.locator(".studio__rail nav button")).toHaveCount(10);
  await expect(frame.locator(".mobile-nav button")).toHaveCount(10);

  const geometry = await frame.locator("[data-mci-ui-root]").first().evaluate((element) => ({
    rootClientWidth: element.clientWidth,
    rootScrollWidth: element.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  expect(geometry.rootScrollWidth, `${viewportName}/${route} root overflow`).toBeLessThanOrEqual(geometry.rootClientWidth + 2);
  expect(geometry.documentScrollWidth, `${viewportName}/${route} document overflow`).toBeLessThanOrEqual(geometry.documentClientWidth + 2);
  expect(geometry.bodyScrollWidth, `${viewportName}/${route} body overflow`).toBeLessThanOrEqual(geometry.bodyClientWidth + 2);

  return {
    viewport: viewportName,
    route: `/${route}`,
    title,
    frameUrl: frame.url(),
    geometry
  };
}

test("AI 平台治理中心 10 路由在 PC 与 390px 视口真实可见", async ({ page }, testInfo) => {
  test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && (/localhost:6150[01]/i.test(url) || /ai-platform-studio/i.test(url))) {
      failedResponses.push({ status: response.status(), method: response.request().method(), url });
    }
  });

  await loginThroughUi(page);
  pageErrors.length = 0;
  consoleErrors.length = 0;
  failedResponses.length = 0;

  const evidence = [];
  for (const [route, title] of ROUTES) {
    evidence.push(await assertRoute(page, route, title, "1920x1080"));
    if (route === "overview") {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "overview-pc-1920x1080.png"), fullPage: false });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, title] of ROUTES) {
    evidence.push(await assertRoute(page, route, title, "390x844"));
    const frame = await waitForStudioFrame(page);
    const studioNav = frame.locator(".mobile-nav");
    const hostNav = page.locator(".mobile-tabbar-shell");
    await expect(studioNav).toBeVisible();
    await expect(hostNav).toBeVisible();
    const [studioNavBox, hostNavBox] = await Promise.all([studioNav.boundingBox(), hostNav.boundingBox()]);
    expect(studioNavBox, `${route} studio navigation geometry`).not.toBeNull();
    expect(hostNavBox, `${route} host navigation geometry`).not.toBeNull();
    expect(studioNavBox.y + studioNavBox.height, `${route} navigation overlap`).toBeLessThanOrEqual(hostNavBox.y);
    if (route === "overview") {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "overview-mobile-390x844.png"), fullPage: false });
    }
  }

  const severePageErrors = pageErrors.filter((item) => /ReferenceError|TypeError|Unhandled|SyntaxError/i.test(item));
  const severeConsoleErrors = consoleErrors.filter((item) => /ReferenceError|TypeError|Unhandled|SyntaxError|Failed to load resource/i.test(item));
  expect(severePageErrors, "unexpected page errors").toEqual([]);
  expect(severeConsoleErrors, "unexpected console errors").toEqual([]);
  expect(failedResponses, "unexpected first-party HTTP errors").toEqual([]);

  await testInfo.attach("ai-platform-browser-audit.json", {
    body: Buffer.from(JSON.stringify({ evidence, pageErrors, consoleErrors, failedResponses }, null, 2)),
    contentType: "application/json"
  });
});

test("AI 平台治理新建门户使用统一大圆角居中可拖动弹层", async ({ page }) => {
  test.skip(!PASSWORD, "PW_TEST_PASSWORD is required for the real UI login.");
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await loginThroughUi(page);
  await assertRoute(page, "portal", "门户编排", "1920x1080");
  const frame = await waitForStudioFrame(page);
  await frame.getByRole("button", { name: "新建门户", exact: true }).click();

  const mask = frame.locator(".dialog-mask");
  const dialog = frame.getByRole("dialog", { name: "新建门户项目", exact: true });
  await expect(mask).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".dialog__icon svg")).toBeVisible();
  await expect(dialog.locator(".dialog__heading small")).toHaveText("MICROI CONTROL");
  await expect(dialog.locator(".dialog__heading h2")).toHaveText("新建门户项目");
  await expect(dialog.locator(".dialog__heading p")).not.toBeEmpty();
  const close = dialog.getByRole("button", { name: "关闭弹层", exact: true });
  await expect(close).toBeVisible();
  const footerButtons = dialog.locator(".dialog__footer button");
  await expect(footerButtons).toHaveCount(2);
  await expect(footerButtons.nth(0)).toContainText("关闭");
  await expect(footerButtons.nth(1)).toContainText("创建草稿");
  await expect(footerButtons.locator("svg")).toHaveCount(2);

  const contract = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const body = element.querySelector(".dialog__body");
    const closeButton = element.querySelector(".dialog__close");
    const maskElement = element.closest(".dialog-mask");
    const maskBox = maskElement?.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      maskLeft: maskBox?.left || 0,
      maskTop: maskBox?.top || 0,
      maskWidth: maskBox?.width || innerWidth,
      maskHeight: maskBox?.height || innerHeight,
      radius: Number.parseFloat(style.borderTopLeftRadius),
      bodyBackground: body ? getComputedStyle(body).backgroundColor : "",
      closeBackground: closeButton ? getComputedStyle(closeButton).backgroundColor : "",
      maskPosition: maskElement ? getComputedStyle(maskElement).position : ""
    };
  });
  expect(Math.abs(contract.left + contract.width / 2 - (contract.maskLeft + contract.maskWidth / 2)), JSON.stringify(contract)).toBeLessThanOrEqual(2);
  expect(Math.abs(contract.top + contract.height / 2 - (contract.maskTop + contract.maskHeight / 2)), JSON.stringify(contract)).toBeLessThanOrEqual(2);
  expect(contract.radius).toBeGreaterThanOrEqual(24);
  expect(contract.maskPosition).toBe("fixed");
  expect(["transparent", "rgba(0, 0, 0, 0)"]).not.toContain(contract.bodyBackground);
  expect(["transparent", "rgba(0, 0, 0, 0)"]).not.toContain(contract.closeBackground);

  const header = dialog.locator(".dialog__header");
  const start = await header.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.left + 160, y: box.top + 46 };
  });
  await header.dispatchEvent("pointerdown", { button: 0, clientX: start.x, clientY: start.y, pointerId: 9 });
  await frame.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, button: 0, clientX: 9_000, clientY: 9_000, pointerId: 9 }));
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, clientX: 9_000, clientY: 9_000, pointerId: 9 }));
  });
  await frame.waitForTimeout(100);
  const dragged = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  expect(dragged.left).toBeGreaterThanOrEqual(17);
  expect(dragged.top).toBeGreaterThanOrEqual(17);
  expect(dragged.right).toBeLessThanOrEqual(dragged.viewportWidth - 17);
  expect(dragged.bottom).toBeLessThanOrEqual(dragged.viewportHeight - 17);
  expect(dragged.left).toBeGreaterThan(contract.left + 10);
  expect(dragged.top).toBeGreaterThan(contract.top + 10);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "portal-unified-dialog-after-drag.png"), fullPage: false });
  await close.click();
  await expect(dialog).toHaveCount(0);
});
