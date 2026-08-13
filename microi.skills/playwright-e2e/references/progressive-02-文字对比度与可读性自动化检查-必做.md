# playwright-e2e 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=playwright-e2e-013 sha256=cce51ad8ff52cd1339b5a1ce4986d8167b5cccb77637e8a3d438da9da03b68cd -->
## 文字对比度与可读性自动化检查（必做）

凡涉及前端样式、卡片、芯片、按钮、价格区间筛选条、退出登录、徽章、覆盖文字（金色/渐变背景上的小字）、列表副标题、空状态等，**测试与人眼复核都必须执行对比度检查**。典型教训：筛选条文字、幽灵按钮、轻色副标题在近似底色下肉眼几乎不可见，但接口/DOM 断言全部通过——这类对比度问题必须通过自动化审计捕捉。

### 自动化对比度审计

对每个核心页面，遍历可见文本节点，计算前景色与最近不透明背景色的 WCAG 对比度，<4.5:1 直接失败：

```js
const lowContrast = await page.evaluate(() => {
  const ratio = (fg, bg) => {
    const lum = (c) => {
      const v = c.map(x => x/255).map(x => x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4));
      return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
    };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0,3).map(Number);
    const lf = lum(parse(fg)); const lb = lum(parse(bg));
    return (Math.max(lf,lb)+0.05)/(Math.min(lf,lb)+0.05);
  };
  const findBg = (el) => {
    let cur = el;
    while (cur) {
      const c = getComputedStyle(cur).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      cur = cur.parentElement;
    }
    return 'rgb(255,255,255)';
  };
  const issues = [];
  document.querySelectorAll('*').forEach(el => {
    const t = (el.innerText || '').trim();
    if (!t || el.children.length) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.5) return;
    const fz = parseFloat(cs.fontSize);
    if (fz < 9) return;
    const r = ratio(cs.color, findBg(el));
    if (r < 4.5) issues.push({ text: t.slice(0,40), color: cs.color, bg: findBg(el), ratio: +r.toFixed(2), fontSize: fz });
  });
  return issues;
});
expect(lowContrast, '低对比度文字: ' + JSON.stringify(lowContrast.slice(0,5))).toEqual([]);
```

### 必须人眼复核（view_image）的页面

完成功能后强制 `fullPage` 截图并 `view_image` 人眼审阅以下页面，截图存入 `tests/e2e/screenshots/`：

| 页面 | 路径（以项目实际路由为准） | 重点检查 |
|------|------|---------|
| 首页 | `/#/pages/index/index` 等 | 横幅、公告、商品卡价格 |
| 分类 | `/#/pages/category/...` | tab、商品标题副信息 |
| 商品详情 | `/#/pages/product/detail?id=...` | 价格、规格、按钮 |
| 购物车 | `/#/pages/cart/...` | 数量、合计、结算按钮 |
| 订单列表/详情 | `/#/pages/order/...` | 状态徽章、金额、提交按钮 |
| 我的 | `/#/pages/mine/...` | **退出登录按钮**、菜单标签、账户信息 |
| 业务专题页 | 项目自定义路径 | 核心功能区域、状态、可交互元素 |

判定标准：任意小号文字 < 12px 在彩色/渐变背景上，或纯文字按钮在与页面同色调底色上无明显边框/填充——一律视为缺陷，必须修复后再发版。

### 设计禁忌（直接判失败）

1. 幽灵按钮（ghost button）在近似底色上当独立操作按钮使用——必须改成实心按钮或显式覆盖背景填充。
2. 中性灰/浅色文字（如 `#999` 等）直接放在与其色调接近的背景上，且字号较小——WCAG 对比度 < 4.5:1 直接判失败。
3. 渐变彩色背景上展示透明度较低的小字。
4. 与背景色调接近的文字颜色放在同色调底色上——必须加深文字颜色或改变底色。
5. 价格区间、状态、筛选这类**导航/筛选元素出现在列表中部作为标题**——必须移到顶部 sticky 工具栏，并与正文形成色彩区隔。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-014 sha256=e5858cce6f743573d699ed7d2d07f958d15be96c28028a91163e841f6d3c016a -->
## 安装

```bash
npm i -D @playwright/test
npx playwright install chromium
```

### 浏览器选择强制顺序

做本地页面级 Playwright 验收时，不能因为 Playwright 官方 Chromium 缓存缺失或下载超时就结束任务。必须按下面顺序自动兜底：

1. 优先读取 `PW_CHROMIUM_EXECUTABLE` / `PW_BROWSER_EXECUTABLE`。
2. Windows 优先探测本机 Edge / Chrome：`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`、`C:/Program Files/Microsoft/Edge/Application/msedge.exe`、`C:/Users/Administrator/AppData/Local/Google/Chrome/Bin/chrome.exe`、`C:/Program Files/Google/Chrome/Application/chrome.exe`、`C:/Program Files (x86)/Google/Chrome/Application/chrome.exe`。
3. 再探测工作区本地缓存：`.cache/chromium/**/chrome.exe`、`.tmp/playwright-browsers/**/chrome.exe`。
4. 仍没有浏览器时，才从吾码 CDN 下载到 `.tmp/playwright-browsers/`，并设置 `PW_CHROMIUM_EXECUTABLE`。
5. 只有系统浏览器、本地缓存和 CDN 下载全部失败时，才允许报告“浏览器不可用”；报告中必须说明已经尝试过哪些路径。

手写一次性脚本必须把浏览器探测逻辑写在 `.tmp/*.mjs` 中，截图和报告也必须输出到 `.tmp/screenshots/` 或 `.tmp/reports/`，不要写到 `Microi.Client/`、`Microi.Server/` 等子项目目录。

国内或内网环境如果下载浏览器困难，可以使用本机 Edge：

```bash
$env:PW_BROWSER_CHANNEL='msedge'
npx playwright test
```

如果本机没有可用 Edge，或必须使用 Chromium，优先从吾码 CDN 下载浏览器压缩包，不要反复卡在 Playwright 官方下载通道：

| 系统 | CDN 地址 |
|------|----------|
| Windows x64 | `https://static.itdos.com/openclaw/chromium/chrome-win64-137.0.7151.68.zip` |
| macOS x64 | `https://static.itdos.com/openclaw/chromium/chrome-mac-x64-137.0.7151.68.zip` |
| macOS arm64 | `https://static.itdos.com/openclaw/chromium/chrome-mac-arm64-137.0.7151.68.zip` |

Windows 示例：

```powershell
$browserRoot = Join-Path (Resolve-Path '.tmp').Path 'playwright-browsers'
New-Item -ItemType Directory -Force -Path $browserRoot | Out-Null
$zipPath = Join-Path $browserRoot 'chrome-win64-137.0.7151.68.zip'
Invoke-WebRequest 'https://static.itdos.com/openclaw/chromium/chrome-win64-137.0.7151.68.zip' -OutFile $zipPath
Expand-Archive $zipPath -DestinationPath $browserRoot -Force
$env:PW_CHROMIUM_EXECUTABLE = (Resolve-Path (Join-Path $browserRoot 'chrome-win64/chrome.exe')).Path
npx playwright test
```

手写 Playwright 脚本时读取 `PW_CHROMIUM_EXECUTABLE` / `PW_BROWSER_EXECUTABLE` 并传给 `chromium.launch({ executablePath })`；Playwright Test 配置中通过 `use.launchOptions.executablePath` 读取该环境变量。只有 CDN、系统浏览器和本地缓存都不可用时，才报告浏览器不可用。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-015 sha256=b9adf7af700e045fd919bdfde321b10df89660561dd8ab476a12cba310855875 -->
## playwright.config.js 模板

```js
import { defineConfig, devices } from '@playwright/test';

const port = process.env.PW_PORT || '5180';
const baseURL = process.env.PW_BASE_URL || `http://127.0.0.1:${port}`;
const webServerUrl = process.env.PW_WEB_SERVER_URL || baseURL;
const channel = process.env.PW_BROWSER_CHANNEL || undefined;
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || process.env.PW_BROWSER_EXECUTABLE || undefined;
const defaultCommand = process.env.PW_APP_TYPE === 'uniapp-h5'
  ? `npm run dev:h5 -- --host 0.0.0.0 --port ${port}`
  : `npm run dev -- --host 0.0.0.0 --port ${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e/report' }]],
  use: {
    baseURL,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      OsClient: process.env.PW_OS_CLIENT || 'demo'
    }
  },
  webServer: {
    command: process.env.PW_WEB_SERVER_COMMAND || defaultCommand,
    url: webServerUrl,
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) }
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], ...(channel ? { channel } : {}) }
    }
  ]
});
```

uni-app H5 如果采用静态产物测试，可以把 `PW_WEB_SERVER_COMMAND` 设置为：

```bash
npm run build:h5 && npx --yes http-server dist/build/h5 -p 5180 -s -c-1
```

<!-- /microi-progressive:chunk -->
