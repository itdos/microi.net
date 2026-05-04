---
name: playwright-e2e
description: 在 Microi 吾码低代码平台的 PC Vue、uni-app H5、官网和租户自建前端中编写 Playwright 自动化测试，覆盖 UI 端到端、接口引擎断言、登录态注入、冒烟验收和 CI 报告。
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

export async function callEngine(request, apiEngineKey, data = {}, token = '') {
  const res = await request.post(`${microiEnv.apiBase}/apiengine/${apiEngineKey}`, {
    headers: {
      'Content-Type': 'application/json',
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

export async function injectH5Storage(page, token, member) {
  await page.addInitScript(({ tokenValue, memberValue }) => {
    localStorage.setItem('mall_token', tokenValue);
    if (memberValue) localStorage.setItem('mall_member', JSON.stringify(memberValue));
  }, { tokenValue: token, memberValue: member || null });
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

## 最少冒烟集

任何 Microi 业务系统建议至少覆盖：

1. 公开首页或登录页能打开。
2. 登录接口返回非空响应，且不出现数据库连接或权限错误。
3. 登录态能进入首页或工作台。
4. 一条主业务路径能跑通。
5. 底部 Tab、菜单或核心导航都能加载。
6. 退出登录能清理 Token 并回到登录页。

## 与 MCP 的配合

- `microi_get_db_schema`：写测试前确认表和字段。
- `microi_get_playwright_context`：获取可测菜单 URL、接口引擎、匿名配置。
- `microi_plan_playwright_e2e`：生成推荐的测试文件、环境变量和冒烟路径。
- `microi_run_engine`：调试单个接口引擎，不替代浏览器 E2E。
- `microi_set_engine_anonymous`：登录、注册、公开首页接口需要匿名访问时使用。

## 与 VS Code 插件的配合

VS Code 插件应提供三类能力：

- 初始化：创建 `playwright.config.js`、`tests/e2e/helpers/microi.js`、示例 `smoke.spec.js`、`.env.e2e.example`，并补齐 `package.json` 脚本。
- 运行：在当前前端项目目录执行 `npm run test:e2e`，并提供打开报告入口。
- 上下文：从后端 `GetPlaywrightContext` 拉取当前租户可测路由和接口引擎，写入 `tests/e2e/.microi-playwright-context.json`，供 AI 生成用例时参考。

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
| H5 静态资源 404 | `vite.config.js` 未配置相对路径 | uni-app H5 设置 `base: './'` |
| 本地浏览器下载失败 | Playwright 下载 Chromium 受阻 | 使用 `PW_BROWSER_CHANNEL=msedge` |
| 用例偶发失败 | HMR 或网络请求未稳定 | CI 使用静态构建，断言明确等待关键元素 |
| 页面有横向滚动 | 组件撑出视口 | 对根容器和列表容器加 `max-width:100vw; overflow-x:hidden` |
