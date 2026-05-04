---
name: playwright-e2e
description: 在 Microi 吾码低代码平台的前端项目（PC Vue / uni-app H5）中编写 Playwright 端到端测试，串联接口引擎+前端页面，跑通登录→业务流程→结算等关键路径
---

# Microi 吾码 — Playwright 端到端测试

> 适用场景：Microi 吾码（开源 AI 低代码平台）下的任何 Vite/Vue 前端项目，包括 PC 后台 `Microi.Client`、移动端 uni-app H5、官网、租户自建小程序/H5。
> 目标：用 Playwright 自动启动开发服务器、模拟用户操作、断言后端 V8 接口引擎返回值，保证一套低代码系统从注册→登录→主流程能跑通。

## 1. 安装

```bash
npm i -D @playwright/test
npx playwright install chromium
```

## 2. 目录约定

```
<前端项目>/
  e2e/
    fixtures/login.ts
    pages/
      home.spec.ts
      login.spec.ts
      <业务流程>.spec.ts
    playwright.config.ts
```

## 3. playwright.config.ts 模板

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5180',
    trace: 'on-first-retry',
    extraHTTPHeaders: {
      // Microi 多租户标识，必填；OsClient 名称按你的项目配
      'OsClient': process.env.PW_OS_CLIENT || 'demo'
    }
  },
  webServer: {
    command: 'npm run dev',           // 或 npm run dev:h5
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',  use: { ...devices['iPhone 12'] } }
  ]
});
```

## 4. 与 Microi V8 接口对接的登录 fixture

接口引擎地址固定形如 `${API}/apiengine/{ApiEngineKey}`。把 `API` / `OS` / 登录引擎 Key 改成你项目的实际值。

```ts
// e2e/fixtures/login.ts
import { request } from '@playwright/test';
const API = process.env.PW_API_BASE || 'https://api.your-domain.com';
const OS  = process.env.PW_OS_CLIENT || 'demo';

export async function login(account: string, pwd: string, engineKey = 'member_login') {
  const ctx = await request.newContext();
  const r = await ctx.post(`${API}/apiengine/${engineKey}`, {
    headers: { OsClient: OS, 'Content-Type': 'application/json' },
    data: { Account: account, Pwd: pwd }
  });
  const json = await r.json();
  if (json.Code !== 1) throw new Error('登录失败: ' + json.Msg);
  return json.Data;
}
```

## 5. 典型用例

```ts
// e2e/pages/login.spec.ts
import { test, expect } from '@playwright/test';
import { login } from '../fixtures/login';

test('会员登录拿到 Token 并能进入首页', async ({ page }) => {
  const data = await login('admin', 'admin888');
  expect(data.Token).toBeTruthy();
  await page.addInitScript((t) => localStorage.setItem('Token', t), data.Token);
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
```

```ts
// 业务流程：列表 → 详情 → 主操作 → 验证落库
test('详情页主操作可用', async ({ page }) => {
  await page.goto('/#/pages/business/detail?id=<RecordId>');
  await page.getByRole('button', { name: '提交' }).click();
  await expect(page.getByText('成功')).toBeVisible();
});
```

## 6. 直接断言接口引擎返回

```ts
import { request as r } from '@playwright/test';
test('home_data 接口允许匿名且返回正常', async () => {
  const ctx = await r.newContext();
  const res = await ctx.post(`${process.env.PW_API_BASE}/apiengine/home_data`, {
    headers: { OsClient: process.env.PW_OS_CLIENT! }, data: {}
  });
  const j = await res.json();
  expect(j.Code).toBe(1);
});
```

## 7. 运行

```bash
npx playwright test
npx playwright test login.spec.ts
npx playwright test --ui
npx playwright show-report
```

## 8. 与 Microi 的协作要点（通用）

- **匿名访问**：登录/注册/首页公开数据等接口必须 `AllowAnonymous=1`。可在低代码后台勾选，或用 MCP `microi_set_engine_anonymous` 批量设置。
- **Token 透传**：业务接口在 Header 加 `Token`；fixture 写 `localStorage` 即可被前端拦截器拾取。
- **多租户**：所有请求必须带 `OsClient`，否则后端无法路由到对应租户库。
- **uni-app H5 路由**：通常 `hash` 模式，URL 形如 `/#/pages/...`，Playwright 跳转必须带 `#`。
- **静态资源路径**：uni-app H5 部署到子路径时 `vite.config.js` 必须 `base: './'`。
- **CI 模式**：`webServer.command` 可以改成 `npm run build && npx serve dist`，避开 HMR 干扰。
- **调试**：`await page.pause()` 或 `PWDEBUG=1 npx playwright test`。

## 9. 常见坑速查表

| 现象 | 原因 | 解决 |
|------|------|------|
| 登录接口返回 Code=0 / null | 引擎 AllowAnonymous=0 | `microi_set_engine_anonymous` 改 1 |
| 静态资源 404 | `vite.config.js` 缺 `base: './'` | 加上后重新 build |
| H5 横向滚动条 | 子组件 swiper/scroll-x 撑出 viewport | 根容器 `overflow-x:hidden;max-width:100vw` |
| 列表查不到数据 | 排序倒序 / 无默认 PageSize | 用 `microi_run_engine` 验接口返回 |
| 接口引擎里 V8.Db is null | MCP run_engine 不带 DB 会话 | 用 `V8.FormEngine.*` 替代原生 SQL |
| 权限不足 | 当前账号 Level<9999 | 用超管账号登录再跑 MCP 工具 |

## 10. 推荐的最少冒烟集

任何 Microi 业务系统建议至少覆盖：

1. 公开首页能打开，关键文案 / banner 可见
2. 注册：表单提交→进入首页或登录页，DB 出现新用户
3. 登录：拿到 Token、本地存储写入、跳首页
4. 一条主业务主线（如：列表→详情→提交→列表能查到）
5. 退出登录：清 Token、跳登录页

跑通这 5 条 = 客户最低交付条件。
