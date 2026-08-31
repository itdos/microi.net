import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import * as sass from "sass";

const clientRoot = process.cwd();
const OUTPUT = path.resolve(process.cwd(), "../.tmp/screenshots/dialog-viewport-scroll");
const systemEdge = process.platform === "win32"
    ? [
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
    ].find(existsSync)
    : null;

if (systemEdge) test.use({ launchOptions: { executablePath: systemEdge } });

const [elementStyles, elementDarkStyles] = await Promise.all([
    fs.readFile(path.join(clientRoot, "node_modules/element-plus/dist/index.css"), "utf8"),
    fs.readFile(path.join(clientRoot, "node_modules/element-plus/theme-chalk/dark/css-vars.css"), "utf8")
]);
const platformStyles = sass.compile(path.join(clientRoot, "src/styles/mci-design.scss"), {
    style: "expanded",
    silenceDeprecations: ["legacy-js-api", "import", "slash-div", "global-builtin", "color-functions"]
}).css;
const fieldMarkup = Array.from({ length: 22 }, (_, index) => `
    <div class="dialog-scroll-harness__field">
      <strong>表单字段 ${index + 1}</strong>
      <span>平板与小分辨率电脑仍应完整可达</span>
    </div>`).join("");

const harnessHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>${elementStyles}</style>
  <style>${elementDarkStyles}</style>
  <style>${platformStyles}</style>
  <style>
    html,body,#app{width:100%;height:100%;margin:0;overflow:hidden}
    body{font-family:Inter,"Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#edf4ff,#e9e7ff)}
    html.dark body{background:linear-gradient(135deg,#101827,#20153a)}
    .dialog-scroll-harness{display:grid;gap:12px}
    .dialog-scroll-harness__intro{margin:0;padding:14px 16px;border-radius:12px;background:var(--el-color-primary-light-9);color:var(--el-text-color-primary);line-height:1.6}
    .dialog-scroll-harness__field{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;min-height:52px;padding:0 14px;border:1px solid var(--el-border-color-lighter);border-radius:10px;background:var(--el-bg-color);color:var(--el-text-color-regular)}
    .dialog-scroll-harness__field strong{color:var(--el-text-color-primary)}
    .dialog-scroll-harness__end{padding:18px;border-radius:12px;background:var(--el-color-success-light-9);color:var(--el-color-success-dark-2);font-weight:700;text-align:center}
  </style>
</head>
<body>
  <div id="app">
    <div class="el-overlay mci-unified-overlay" style="z-index:2001">
      <div class="el-overlay-dialog">
        <section class="el-dialog mci-unified-dialog" role="dialog" aria-label="长表单滚动验收" style="width:min(820px, 86vw)">
          <header class="el-dialog__header">
            <span class="el-dialog__title">长表单滚动验收</span>
            <button class="el-dialog__headerbtn" type="button" aria-label="关闭">×</button>
          </header>
          <div class="el-dialog__body">
            <main class="dialog-scroll-harness">
              <p class="dialog-scroll-harness__intro">标题与底部操作固定，只有中间表单内容纵向滚动。</p>
              ${fieldMarkup}
              <div class="dialog-scroll-harness__end" data-testid="dialog-scroll-end">表单底部内容已可见</div>
            </main>
          </div>
          <footer class="el-dialog__footer"><button class="el-button el-button--primary" type="button">保存并关闭</button></footer>
        </section>
      </div>
    </div>
  </div>
</body></html>`;

const scenarios = [
    { name: "1366x520 light", width: 1366, height: 520, dark: false },
    { name: "1024x600 dark", width: 1024, height: 600, dark: true }
];

for (const scenario of scenarios) {
    test(`unified dialog keeps a long form reachable at ${scenario.name}`, async ({ page }) => {
        await fs.mkdir(OUTPUT, { recursive: true });
        await page.setViewportSize({ width: scenario.width, height: scenario.height });
        await page.setContent(harnessHtml, { waitUntil: "domcontentloaded" });
        await page.evaluate((dark) => {
            document.documentElement.classList.toggle("dark", dark);
            document.documentElement.dataset.theme = dark ? "dark" : "light";
        }, scenario.dark);

        const dialog = page.locator(".el-dialog.mci-unified-dialog");
        const header = dialog.locator(":scope > .el-dialog__header");
        const body = dialog.locator(":scope > .el-dialog__body");
        const footer = dialog.locator(":scope > .el-dialog__footer");
        const end = body.getByTestId("dialog-scroll-end");
        await expect(dialog).toBeVisible();
        await expect(header).toBeVisible();
        await expect(footer).toBeVisible();

        const before = await dialog.evaluate((element) => {
            const dialogBox = element.getBoundingClientRect();
            const dialogStyle = getComputedStyle(element);
            const dialogHeader = element.querySelector(":scope > .el-dialog__header");
            const dialogBody = element.querySelector(":scope > .el-dialog__body");
            const dialogFooter = element.querySelector(":scope > .el-dialog__footer");
            const headerBox = dialogHeader.getBoundingClientRect();
            const bodyStyle = getComputedStyle(dialogBody);
            const footerBox = dialogFooter.getBoundingClientRect();
            return {
                viewportHeight:window.innerHeight,
                dialogTop:dialogBox.top,
                dialogBottom:dialogBox.bottom,
                display:dialogStyle.display,
                flexDirection:dialogStyle.flexDirection,
                overflowY:bodyStyle.overflowY,
                bodyClientHeight:dialogBody.clientHeight,
                bodyScrollHeight:dialogBody.scrollHeight,
                headerTop:headerBox.top,
                footerTop:footerBox.top
            };
        });
        expect(before.dialogTop, JSON.stringify(before)).toBeGreaterThanOrEqual(0);
        expect(before.dialogBottom, JSON.stringify(before)).toBeLessThanOrEqual(before.viewportHeight + 1);
        expect(before.display).toBe("flex");
        expect(before.flexDirection).toBe("column");
        expect(["auto", "scroll"]).toContain(before.overflowY);
        expect(before.bodyScrollHeight, JSON.stringify(before)).toBeGreaterThan(before.bodyClientHeight);

        await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await expect(end).toBeVisible();
        const after = await dialog.evaluate((element) => {
            const dialogHeader = element.querySelector(":scope > .el-dialog__header");
            const dialogBody = element.querySelector(":scope > .el-dialog__body");
            const dialogFooter = element.querySelector(":scope > .el-dialog__footer");
            const bodyBox = dialogBody.getBoundingClientRect();
            const endBox = dialogBody.querySelector('[data-testid="dialog-scroll-end"]').getBoundingClientRect();
            return {
                scrollTop:dialogBody.scrollTop,
                headerTop:dialogHeader.getBoundingClientRect().top,
                footerTop:dialogFooter.getBoundingClientRect().top,
                bodyTop:bodyBox.top,
                bodyBottom:bodyBox.bottom,
                endTop:endBox.top,
                endBottom:endBox.bottom
            };
        });
        expect(Math.abs(after.headerTop - before.headerTop), JSON.stringify({ before, after })).toBeLessThanOrEqual(1);
        expect(Math.abs(after.footerTop - before.footerTop), JSON.stringify({ before, after })).toBeLessThanOrEqual(1);
        expect(after.endTop, JSON.stringify(after)).toBeGreaterThanOrEqual(after.bodyTop - 1);
        expect(after.endBottom, JSON.stringify(after)).toBeLessThanOrEqual(after.bodyBottom + 1);

        await page.screenshot({
            path:path.join(OUTPUT, `${scenario.width}x${scenario.height}-${scenario.dark ? "dark" : "light"}.png`),
            fullPage:false
        });
    });
}
