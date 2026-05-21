---
name: playwright-e2e
description: 按 Microi 系统真实业务逻辑进行 Playwright 全自动化、全面测试。Use when testing PC Vue, uni-app H5, websites, page engines, mobile malls, ApiEngine/FormEngine contracts, login flows, write-flow closure, network guards, screenshots, reports, and Playwright Test for VSCode integration.
---

# Microi 吾码 Playwright E2E 自动化测试

`E2E` 是 `End-to-End`，中文通常叫“端到端测试”。它强调从用户入口开始，穿过前端页面、接口引擎、表单引擎、权限、缓存、数据库等真实链路，验证一条业务路径是否真的可交付。

## 是否需要 `-e2e` 后缀

建议保留 `playwright-e2e` 这个 skill 名称。

- Playwright 也能做接口测试、组件测试和截图巡检，但在 Microi 中最关键的价值是“像真实用户一样跑通低代码系统”。
- `-e2e` 能让 AI 明确区分它和 `v8-debugging`、`v8-crud-api`、`playwright-ct` 等其他能力。
- 如果未来要补更细的能力，可以新增 `playwright-api` 或 `visual-regression`，不要把当前 skill 改成泛泛的 `playwright`。

## 适用范围

- PC 管理端：`Microi.Client`、租户后台、运营后台。
- uni-app H5：移动商城、会员中心、H5 工作台。
- Page Engine 页面：大屏、仪表盘、官网页面。
- 接口引擎验收：直接用 Playwright `request` 调 `/apiengine/{ApiEngineKey}`。
- 交付冒烟：登录、主导航、核心业务流、退出登录、关键页面截图。

不适合把 Playwright 用来替代 V8 单函数调试。单个接口引擎的入参输出优先用 VS Code 插件远程执行、MCP `microi_run_engine` 或后端单元测试。

## 标准目录

前端项目中推荐使用 `tests/e2e`，而不是根目录 `e2e`，这样能和单元测试、组件测试并列。

```text
<frontend-project>/
  playwright.config.js
  tests/
    e2e/
      helpers/
        microi.js
      specs/
        auth.spec.js
        smoke.spec.js
        <business-flow>.spec.js
      screenshots/
      report/
```

## 必备环境变量

```bash
PW_BASE_URL=http://127.0.0.1:5180
PW_API_BASE=https://api.example.com
PW_OS_CLIENT=demo
PW_WEB_SERVER_COMMAND="npm run dev:h5 -- --host 0.0.0.0 --port 5180"
PW_WEB_SERVER_URL=http://127.0.0.1:5180
PW_BROWSER_CHANNEL=msedge
```

常用业务变量：

```bash
PW_LOGIN_ENGINE=member_login
PW_TEST_ACCOUNT=admin
PW_TEST_PASSWORD=123456
PW_HOME_PATH=/#/pages/index/index
```

## 服务自启动纪律（必做）

执行自动化测试、截图巡检、接口引擎回读、`/apiengine/{key}` 验收时，如果本地后端或前端不可达，不能把 `fetch failed`、`ECONNREFUSED`、`000 Failed to connect`、端口无人监听当作任务终点。必须先自动启动所需服务，再继续完整验证。

默认本地后端：

```powershell
dotnet run --project Microi.Server/Microi.net.Api/Microi.net.Api.csproj --launch-profile Microi.net.Api
```

默认 PC 前端：

```powershell
Push-Location Microi.Client
npm run dev -- --host 0.0.0.0 --port 1988
Pop-Location
```

默认乐闪购 H5 前端仍按项目自身命令启动，例如 `npm run dev:h5 -- --host 0.0.0.0 --port 5192` 或测试配置里的 `PW_WEB_SERVER_COMMAND`。如果目标测试同时依赖 PC 管理端和移动 H5，需要分别启动对应前端；不要用一个前端服务替代另一个业务入口。

执行顺序：先检查端口/健康接口是否可达；不可达则用后台终端启动；等待服务输出监听地址；再重试接口同步、页面打开、Playwright 截图和断言。只有启动命令失败、缺少依赖、数据库连接失败、端口冲突无法自动换端口且无替代配置时，才算真正阻塞，并且要报告具体失败命令和错误。

## 表单引擎卡死/递归更新全自动化诊断

当用户反馈“新增抽屉卡死”“设计页卡死”“点击控件无响应”“Maximum recursive updates exceeded”等表单引擎问题时，优先做可复现的 Playwright 诊断，而不是只靠猜测改代码。

Microi.Client 已提供专用入口：

```powershell
Push-Location Microi.Client
npm run test:form-freeze:auto
Pop-Location
```

该入口会执行 `scripts/run-form-engine-freeze-trace.mjs`，完整流程如下：

1. 自动配置 `Microi.Server/Microi.net.Api/Properties/launchSettings.json` 中指定 profile 的 `ASPNETCORE_ENVIRONMENT` 和 `DOTNET_ENVIRONMENT`。
2. 自动配置 `Microi.Server/Microi.net.Api/appsettings.{Env}.json` 的 `DevLoginBypass`，用于本地测试账号、跳过验证码、只允许 loopback。
3. 本地后端未启动时，自动执行 `dotnet run --project Microi.Server/Microi.net.Api/Microi.net.Api.csproj --launch-profile Microi.net.Api`。
4. 启动 Playwright，打开指定前端页面，开启 `MicroiFormTrace`，采集 `window.__MICROI_FORM_TRACE__`、console、pageerror、当前 URL 和 Playwright trace。
5. 页面卡住或断言失败时，先看最后一批 `[MicroiFormTrace #n]`，定位是停在 `runtime:*`、`diy-select:*`、`inform-v8-*`、`field-v8-*` 还是业务 console。

常用环境变量：

```powershell
$env:FRONTEND='http://localhost:1988'
$env:BACKEND='https://localhost:7266'
$env:PW_BACKEND_ENV='iTdos'
$env:PW_ASPNETCORE_ENVIRONMENT='iTdos'
$env:PW_DOTNET_ENVIRONMENT='iTdos'
$env:PW_APPSETTINGS_ENV='iTdos'
$env:MICROI_OSCLIENT='iTdos'
$env:PW_TEST_ACCOUNT='admin'
$env:PW_TEST_PASSWORD='microi#2026'
$env:MICROI_FREEZE_PATH='/#/diy/diy-design/<TableId>?PageType='
npm run test:form-freeze:auto
```

可选开关：

- `PW_START_BACKEND=0`：不自动启动后端，只跑测试。
- `PW_CONFIG_BACKEND=0`：不修改 `launchSettings.json`。
- `PW_CONFIG_DEV_LOGIN=0`：不修改 `DevLoginBypass`。
- `PW_APPSETTINGS_PATH=Microi.Server/Microi.net.Api/appsettings.iTdos.json`：明确指定配置文件。
- `PW_BACKEND_PROFILE=Microi.net.Api`：指定 launch profile。
- `PW_DEV_LOGIN_BYPASS=1`、`PW_DEV_SKIP_CAPTCHA=1`、`PW_DEV_ONLY_LOOPBACK=1`：控制本地登录旁路。
- `PW_DEV_LOGIN_ACCOUNT`、`PW_DEV_LOGIN_PASSWORD`：只配置后端旁路账号密码；`PW_TEST_ACCOUNT`、`PW_TEST_PASSWORD` 同时作为 Playwright 登录账号密码。
- `PW_HEADED=0`：无头运行。

诊断代码要遵守这些规则：

- 登录优先用真实后端 `/api/SysUser/Login`，token 可能在响应头 `Authorization`，不要只从 `Data.Token` 取。
- 如果 direct-token 被前端守卫踢回登录页，必须保留 UI 登录兜底，模拟真实用户输入账号密码点击登录。
- trace 只在 URL、localStorage 或 `window.__MICROI_FORM_TRACE_ENABLED__` 开启时输出，避免生产默认刷屏。
- 卡死类问题要捕获 `pageerror`；Vue 的 `Maximum recursive updates exceeded` 通常直接暴露根因组件。
- 不要把 token 打印到最终报告里；console 附件中如包含 token，只用于本地诊断，不要转述完整值。
- 修复后必须重跑同一个诊断用例，确认最后 trace 不再无限重复，并且页面在 10-15 秒后仍可响应。

## 移动端视觉与资源验收

uni-app H5、移动商城、分享海报、首页改版这类任务不能只跑接口和 DOM 断言。每次涉及页面风格、图片、二维码、商品卡片、首页聚合时，Playwright 必须补齐以下检查：

- 每个核心页面都保存全页截图到 `tests/e2e/screenshots/`，并用 `view_image` 人眼复核首页、登录页、分享海报、商品列表等关键截图。
- 对关键文字选择器做对比度检查，至少覆盖品牌名、搜索占位、公告、快捷入口、促销卡、分类、商品标题、价格、资产金额。浅底弱灰、金色按钮白字、渐变上低透明文字都应判为失败。
- 图片不能只断言 URL 不为空；必须验证图片真实加载，例如检查 `img.naturalWidth > 0`、uni-image 背景图、或 HTTP 200。坏图、404、空白图都算失败。
- 平台应用图片、海报二维码、公告图、商品图必须来自平台 HDFS/API 或数据库字段。测试中应拦截并拒绝 `qrserver.com`、`create-qr-code`、`picsum.photos`、`placeholder.com`、`dummyimage.com` 等第三方图床/二维码服务。
- 如果接口返回了不可用图片，优先修数据源、上传平台文件或修接口引擎，不要用第三方 fallback 把测试“跑绿”。
- 对分享海报二维码，优先断言平台接口，如 `/api/Os/CreateQRCodeImage`，或平台接口引擎返回的 HDFS 图片路径。

## 乐闪购移动端回归纪律

处理乐闪购 `ai-helper/数字经济商城/mci.lsg.uniapp` 的交易、资产、登录、购物车、抢购、约单、充值、分享或图片相关问题时，不能只改代码后让用户手工发现问题。完成实现后必须至少执行：

```powershell
Set-Location 'd:\Work\microi.net.all\ai-helper\数字经济商城\mci.lsg.uniapp'
$env:PW_API_BASE='https://localhost:7266'
$env:PW_API_ENV='development'
$env:PW_PORT='5192'
npm run build:h5:local
npx playwright test --reporter=list
```

当前业务口径要在测试里同步表达：普通商品只能提货卡支付，兑换金商品只能兑换金支付；积分充值只允许系统档位并生成唯一尾数金额；图片和二维码必须来自平台接口/HDFS；我的页绿色积分和兑换金提货入口按当前口径隐藏；约单同意后两张卡进入已约单，普通抢购必须被拒绝。

表单引擎冻结高频根因：

- 在 computed/render/watch 路径里写回同一个响应式依赖，例如 `field.Data` watcher 里再次写 `field.Data`。
- 程序性同步 `el-select` 值时触发 `change`，又执行 V8/FormSet，形成循环。
- 折叠分组、字段 Tabs 等运行态字段属性反复写入 `_isShow`、`_collapseClass`、`_fieldTabsPanes`。
- 前端 InFormV8 或字段 V8 中持续 `FormSet` 同一字段，且没有值相等保护。

当前 Microi.Client 的表单冻结诊断文件是 `tests/form-engine-freeze-trace.spec.mjs`。新增类似测试时，可以复制它的结构：`addInitScript` 注入 `ApiBase/OsClient/Trace`，登录后跳转目标 hash，等待设计/表单 DOM，延迟观察响应性，最后 attach trace 和 console。

## 文字对比度与可读性自动化检查（必做）

凡涉及前端样式、卡片、芯片、按钮、价格区间筛选条、退出登录、徽章、覆盖文字（金色/渐变背景上的小字）、列表副标题、空状态等，**测试与人眼复核都必须执行对比度检查**。历史教训：「1000 以下」筛选条、「退出登录」幽灵按钮、`#7A6A58` 浅灰副标题在 `#F8F3EA` 米色底色下肉眼几乎不可见，但接口/DOM 断言全部通过。

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

| 页面 | 路径 | 重点检查 |
|------|------|---------|
| 首页 | `/#/pages/index/index` | 横幅、公告、商品卡价格 |
| 分类 | `/#/pages/category/category` | tab、商品标题副信息 |
| 商品详情 | `/#/pages/product/detail?id=...` | 价格、规格、按钮 |
| 购物车 | `/#/pages/cart/cart` | 数量、合计、结算按钮 |
| 库存转让区 | `/#/pages/zone/transfer` | **价格区间芯片（顶部）**、卡号、持有人、转让价 |
| 抢购详情 | `/#/pages/zone/grab-detail?id=...` | **真实卖家昵称**、规则文字、底部按钮 |
| 订单列表/详情 | `/#/pages/order/buy-list` 等 | 状态徽章、金额、提交按钮 |
| 我的 | `/#/pages/mine/mine` | **退出登录按钮**、菜单标签、积分数字 |

判定标准：任意小号文字 < 12px 在彩色/渐变背景上，或纯文字按钮在与页面同色调底色上无明显边框/填充——一律视为缺陷，必须修复后再发版。

### 设计禁忌（直接判失败）

1. `mci-btn-ghost` 在米色 / 浅金 / 暖红等近似底色上当独立操作按钮使用——必须改成 `mci-btn-primary` 或显式覆盖背景填充。
2. `color: #7A6A58 / #8C7B68 / #999` 等中性灰直接放在 `#F8F3EA` 等暖色底，且字号 ≤ 22rpx。
3. 渐变红/金背景上写 `opacity: .85` 的小字。
4. 金色 `#D8A23A` 文本放在白色或浅金底（必须改深红 `#8E0613` 或加深底）。
5. 价格区间、状态、筛选这类**导航/筛选元素出现在列表中部作为标题**——必须移到顶部 sticky 工具栏，并与正文形成色彩区隔。

## 安装

```bash
npm i -D @playwright/test
npx playwright install chromium
```

国内或内网环境如果下载浏览器困难，可以使用本机 Edge：

```bash
$env:PW_BROWSER_CHANNEL='msedge'
npx playwright test
```

## playwright.config.js 模板

```js
import { defineConfig, devices } from '@playwright/test';

const port = process.env.PW_PORT || '5180';
const baseURL = process.env.PW_BASE_URL || `http://127.0.0.1:${port}`;
const webServerUrl = process.env.PW_WEB_SERVER_URL || baseURL;
const channel = process.env.PW_BROWSER_CHANNEL || undefined;
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

## Microi helper 模板

```js
// tests/e2e/helpers/microi.js
import { expect } from '@playwright/test';

export const microiEnv = {
  apiBase: process.env.PW_API_BASE || 'https://api.example.com',
  osClient: process.env.PW_OS_CLIENT || 'demo',
  loginEngine: process.env.PW_LOGIN_ENGINE || 'member_login'
};

export function withOsClient(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}OsClient=${encodeURIComponent(microiEnv.osClient)}`;
}

export async function callEngine(request, apiEngineKey, data = {}, token = '') {
  const res = await request.post(withOsClient(`${microiEnv.apiBase}/apiengine/${apiEngineKey}`), {
    headers: {
      'Content-Type': 'application/json',
      apiengine: '1',
      OsClient: microiEnv.osClient,
      ...(token ? { Token: token } : {})
    },
    data
  });
  expect(res.ok(), `${apiEngineKey} HTTP status`).toBeTruthy();
  const json = await res.json();
  return json;
}

export async function loginByEngine(request, account, password) {
  const json = await callEngine(request, microiEnv.loginEngine, {
    Account: account,
    Phone: account,
    Pwd: password,
    Password: password
  });
  expect(json.Code, json.Msg || 'login Code').toBe(1);
  const data = json.Data || {};
  const token = data.Token || data.token || data.AccessToken || '';
  expect(token, 'login token').toBeTruthy();
  return { token, data };
}

export async function injectStorage(page, values) {
  await page.addInitScript((storageValues) => {
    for (const [key, value] of Object.entries(storageValues)) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }, values);
}

export async function injectH5Storage(page, token, member = null) {
  return injectStorage(page, {
    mall_token: token,
    mall_member: member || {}
  });
}

export function assertDosResultShape(json, label = 'DosResult') {
  expect(json, label).toBeTruthy();
  expect(json, label).toHaveProperty('Code');
  expect(typeof json.Code, `${label}.Code type`).toBe('number');
}
```

## 典型用例

```js
import { test, expect } from '@playwright/test';
import { callEngine, loginByEngine, injectH5Storage } from '../helpers/microi.js';

test('公开首页能打开', async ({ page }) => {
  await page.goto(process.env.PW_HOME_PATH || '/');
  await expect(page.locator('body')).toBeVisible();
});

test('登录接口能拿到 Token 并进入首页', async ({ page, request }) => {
  const { token, data } = await loginByEngine(
    request,
    process.env.PW_TEST_ACCOUNT || 'admin',
    process.env.PW_TEST_PASSWORD || '123456'
  );
  await injectH5Storage(page, token, data.Member);
  await page.goto(process.env.PW_HOME_PATH || '/');
  await expect(page.locator('body')).toBeVisible();
});

test('公开接口引擎返回标准 DosResult', async ({ request }) => {
  const json = await callEngine(request, process.env.PW_SMOKE_ENGINE || 'home_data', {});
  expect(json).toHaveProperty('Code');
});
```

## Microi 专属测试策略

1. 先用 MCP `microi_get_playwright_context` 获取当前租户的菜单路由、接口引擎、匿名状态。
2. 公开页面只测“能打开、关键区域可见、无横向溢出、无白屏”。
3. 登录态优先用接口引擎登录，再注入 `localStorage` 或 Cookie，不要在每个用例里重复点登录表单。
4. 业务主线只覆盖客户真正验收的动作：列表、详情、提交、状态变化、余额/库存/积分变动。
5. 接口引擎断言必须检查 `HTTP ok`、`Code`、`Msg` 和关键 `Data` 字段。
6. 涉及写库的用例必须使用专用测试账号和可重复数据，避免污染生产数据。
7. 截图只用于关键节点和失败场景；不要让截图成为唯一断言。
8. **每条业务主线 spec 必须有"图片回归检查"步骤**：在涉及商品列表、商品详情、提货卡、海报、头像、Banner 的页面，必须 `await page.screenshot({ path: 'tests/e2e/screenshots/<spec>.png', fullPage: true })`，并在测试报告生成后用 `view_image` 工具肉眼复核截图，确认：
   - 没有出现纯渐变/首字母占位/空白图位（这通常意味着 `sanitizeAssetUrl` 等前缀工具被遗漏，或图片字段拿到了相对路径）
   - 商品/卡片图都真实显示
   - 价格、卖家、卡号等文案不出错位
   - 同步参见 [uniapp-mall-assets](../uniapp-mall-assets/SKILL.md) 中的 FileServer 前缀规范。
9. 用 `page.on('response', r => { if (r.url().includes('/file/') && !r.ok()) failedAssets.push(r.url()); })` 监听全部资源请求，断言 `failedAssets.length === 0`，能在断言前就抓到 404 图片。

## 最少冒烟集

任何 Microi 业务系统建议至少覆盖：

1. 公开首页或登录页能打开。
2. 登录接口返回非空响应，且不出现数据库连接或权限错误。
3. 登录态能进入首页或工作台。
4. 一条主业务路径能跑通。
5. 底部 Tab、菜单或核心导航都能加载。
6. 退出登录能清理 Token 并回到登录页。

## 完整业务验收门槛

当用户要求“完整测试”“全面测试”“不要让我手工测出接口 null/404/权限漏洞”时，不能只生成浅冒烟。至少补齐以下测试文件：

```text
tests/e2e/
  helpers/microi.js
  smoke.spec.js           # 首屏、导航、图片、布局
  api-contract.spec.js    # 所有接口引擎契约：HTTP ok、非 null、合法 JSON、DosResult.Code
  network.spec.js         # 页面运行期拦截 404/5xx、空响应、字符串 null、意外 Code=0
  auth.spec.js            # 未登录/登录/过期 Token/退出登录
  business-flow.spec.js   # 至少一条真实写操作闭环，写后再查后端状态
```

必备断言：

1. API 响应不能是空 body、字符串 `null`、非 JSON，除明确允许外不能返回 `Code=0`。
2. 公开接口必须可匿名调用；受保护接口未登录必须返回 `Code=1001/1002` 或跳转登录。
3. 写操作必须做“前置清理 → 执行动作 → 后端查询确认 → 用例清理”。
4. UI 点击不能只断言 toast；必须用 `page.waitForResponse()` 捕捉对应接口，并验证响应体。
5. 任何 FormEngine HTTP 路由必须使用 `/api/formengine/{action}-{table}`，不要生成 `/formengine/{table}/{action}`。
6. ApiEngine 动态路由必须显式携带 OsClient：推荐 `/apiengine/{ApiEngineKey}?OsClient={osClient}`，Header 里的 `OsClient` 只能作为补充，不能作为唯一租户来源。
7. 页面级测试必须把 `请求失败`、`网络错误`、`null`、`待开发`、`开发中` 当成失败信号；这些文案如果出现在页面或 toast 中，说明功能未交付或接口契约错误。
8. 新增、保存、结算、转赠、确认、上传等按钮不能只弹“成功/待开发”toast；必须调用真实业务接口，并通过后端查询验证状态变化。
9. 源码守卫可作为兜底：递归扫描 `src/**/*.vue`、`src/**/*.js`，禁止残留 `待开发|开发中` 占位文案。
10. 新建或更新 ApiEngine 后必须用 HTTP 路径复测一次；只用 `microi_run_engine` 通过不够，因为 HTTP 调用还受 `IsEnable`、`StopHttp`、`AllowAnonymous` 和动态路由缓存影响。
11. 每个移动端项目都要有“接口清单驱动”的契约测试：静态扫描或维护清单覆盖所有 `callEngine('xxx')`，逐个 HTTP 调用并断言不是 404、不是空响应、不是字符串 `null`，且必须是标准 DosResult。
12. 写业务闭环时必须准备可重复测试数据并清理：例如抢购要“创建测试挂单 → 调用抢购 → 验证订单 → 删除测试订单/挂单/提货卡”，购物车要“加入购物车 → 结算 → 验证订单/购物车状态 → 删除测试订单”。
13. 图片断言必须检查真实渲染，而不是只检查元素可见。uni-app H5 的 `<image>` 会渲染成 `UNI-IMAGE`，真实图片在内部 `div.style.backgroundImage` 或子 `img` 上；不要把宿主元素的 CSS 渐变背景算作加载成功。
14. 网络守卫要记录 `requestfailed`，特别是图片资源的 `net::ERR_BLOCKED_BY_ORB` / CORS / 404；首页 banner、商品主图、头像等公开图片必须实际加载。

移动商城/会员 H5 额外规则：

- 商城会员 Token 来自业务接口引擎（如 `mall_member_login`），不是平台 `Sys_User` Token。
- 移动端会员数据查询不要直连平台 FormEngine；使用租户 ApiEngine 或安全查询代理。
- 商品详情“加入购物车”必须登录；登录后必须写服务端购物车，再进入购物车页验证同一商品可见。
- 购物车、订单、资产、团队、提货、地址、收款方式等会员数据都必须按会员 Id 做后端范围过滤。
- 库存转让区不要写成“转赠区”，更不要写 `1:1.5 转赠`；业务含义是“提货卡转让”，平台服务费 1.2%，用户收益 1.5%。页面、接口、测试命名都要用“库存转让/提货卡转让”。
- 库存转让区必须覆盖 `mall_grab_window_status`：接口必须返回标准 DosResult，`Data` 至少包含 `Status`、`StartTime`、`EndTime`、`ServerTime`、`UserProfitRate`、`PlatformServiceRate`。当前业务需要 00:00-24:00 全天开放时，测试必须断言 `Status=Open`、开始时间 `00:00:00`、结束时间 `24:00:00`。
- `mall_grab_submit` 必须对空参数、无效挂单、已锁定挂单返回标准 DosResult，禁止返回 JS `null`；成功路径必须返回订单 Id，并验证用户收益率 1.5%、平台服务费率 1.2%。
- “我的-新增地址”和“我的-新增收款方式”必须点击后出现真实表单，保存后后端能查到新增记录。
- 购物车“结算”必须调用 `mall_cart_settle` 或等价业务接口，不能残留 `结算功能开发中`。
- `mall_cart_settle` 必须覆盖真实闭环：登录、加入购物车、点击结算、等待 `/apiengine/mall_cart_settle`、断言 Code=1 和订单 Id，再查询购物车确认对应商品已移除。
- 首页运营 banner 推荐从公告或配置表驱动，例如 `mall_notice.BannerImg`、`IsBanner`、`BannerSort`；E2E 要同时断言接口 `Banners[]`、图片真实加载、点击进入详情页。

## 与 MCP 的配合

- `microi_get_db_schema`：写测试前确认表和字段。
- `microi_get_playwright_context`：获取可测菜单 URL、接口引擎、匿名配置。
- `microi_plan_playwright_e2e`：生成推荐的测试文件、环境变量和冒烟路径。
- `microi_run_engine`：调试单个接口引擎，不替代浏览器 E2E。
- `microi_set_engine_anonymous`：登录、注册、公开首页接口需要匿名访问时使用；设置后仍要验证 HTTP `/apiengine/{key}?OsClient={osClient}` 返回标准 DosResult。

## 与 VS Code 插件的配合

### Microi VS Code 插件

Microi VS Code 插件应提供三类能力：

- 初始化：创建 `playwright.config.js`、`tests/e2e/helpers/microi.js`、示例 `smoke.spec.js`、`.env.e2e.example`，并补齐 `package.json` 脚本。
- 运行：在当前前端项目目录执行 `npm run test:e2e`，并提供打开报告入口。
- 上下文：从后端 `GetPlaywrightContext` 拉取当前租户可测路由和接口引擎，写入 `tests/e2e/.microi-playwright-context.json`，供 AI 生成用例时参考。

### Playwright Test for VSCode（官方插件）

官方插件 `Playwright Test for VSCode` 与 Microi Playwright 规范不冲突。它只是同一套 `@playwright/test` 的 VS Code 测试视图/调试入口，读取项目里的 `playwright.config.js`、`testDir`、`projects`、`webServer`、`use` 配置；CLI 的 `npx playwright test` 与插件按钮运行的是同一批 spec。

推荐共用方式：

1. 项目内保留 `playwright.config.js` 作为唯一配置源，不为插件单独复制一份配置。
2. `webServer.reuseExistingServer: true`，这样插件运行时如果 H5 静态服务已启动就复用，否则按配置启动。
3. 本地 H5 先执行 `npm run build:h5:local`；插件再运行 `tests/e2e/*.spec.js` 时会服务 `dist/build/h5`。
4. Windows 本机推荐 `PW_BROWSER_CHANNEL=msedge` 或在配置中默认 `channel: 'msedge'`，避免每台机器重复下载 Chromium。
5. 需要自定义 `PW_API_BASE/PW_API_ENV/PW_PORT/PW_OS_CLIENT` 时，优先写入 `playwright.config.js` 的默认值或 VS Code 插件环境变量设置；CI 和一次性运行再用终端环境变量覆盖。
6. 插件适合单个用例调试、断点、Trace 查看；最终交付仍要跑 CLI 全量命令并查看 `tests/e2e/report`。
7. 插件截图/trace 与 CLI 使用同一目录；视觉回归仍必须 `view_image` 人眼复核关键 fullPage 截图。

## CI 建议

```yaml
name: e2e
on: [push, pull_request]
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          PW_BASE_URL: http://127.0.0.1:5180
          PW_API_BASE: ${{ secrets.PW_API_BASE }}
          PW_OS_CLIENT: ${{ secrets.PW_OS_CLIENT }}
          PW_TEST_ACCOUNT: ${{ secrets.PW_TEST_ACCOUNT }}
          PW_TEST_PASSWORD: ${{ secrets.PW_TEST_PASSWORD }}
```

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 接口返回 `Code=1001/1002` | Token 失效或未传 | 登录 fixture 注入 Token，或检查 Header |
| 登录接口返回 `Code=0` | 账号数据不存在或 `AllowAnonymous=0` | 准备测试账号，必要时设置匿名 |
| `microi_run_engine` 成功但 `/apiengine/{key}` 返回“未启用” | `IsEnable=0`、`StopHttp=1` 或保存代码时丢失接口元数据 | 设置匿名/启用后清缓存，并用 HTTP 路径复测 |
| 新增接口一开始 404 | 动态路由缓存尚未刷新 | HTTP 调用带 `apiengine: 1` Header 直达接口引擎，并刷新缓存/重启后端 |
| `microi_set_engine_anonymous` 显示已启用但 HTTP 仍提示 `sys_apiengine` 不存在 | 历史引擎 `ApiAddress` 为空或不是 `/apiengine/{key}` | 批量补齐 `ApiAddress`、`IsEnable=1`、`StopHttp=0`，并清 key/id/address 三类缓存 |
| 保存接口代码后 MCP 自己报 `string does not contain DosIsNullOrWhiteSpace` | 后端 C# 在动态对象路径上调用扩展方法 | 改用 `string.IsNullOrWhiteSpace`，不要在 MCP 路径新增 `DosIsNullOrWhiteSpace` 调用 |
| MCP `run_engine` 里 `V8.Db` 为 null | MCP 执行上下文没有注入直连 Db | 维护/测试引擎优先使用 `V8.FormEngine.GetTableData/UptFormData` |
| H5 静态资源 404 | `vite.config.js` 未配置相对路径 | uni-app H5 设置 `base: './'` |
| 本地浏览器下载失败 | Playwright 下载 Chromium 受阻 | 使用 `PW_BROWSER_CHANNEL=msedge` |
| 用例偶发失败 | HMR 或网络请求未稳定 | CI 使用静态构建，断言明确等待关键元素 |
| 页面有横向滚动 | 组件撑出视口 | 对根容器和列表容器加 `max-width:100vw; overflow-x:hidden` |
