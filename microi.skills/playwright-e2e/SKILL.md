---
name: playwright-e2e
description: 在 Microi 移动端（uni-app H5）/ PC Vue 项目中编写 Playwright 端到端测试，串联接口引擎+前端页面，跑通登录→下单→支付等关键路径
---

# Microi Playwright 端到端测试

> 适用：`ai-helper/数字经济商城/mci.lsg.uniapp`、`Microi.Client`、其它 Vite/Vue 前端。
> 目标：用 Playwright 自动启动开发服务器、模拟用户操作、断言后端 V8 接口返回值。

## 1. 安装

在前端项目根目录：

```bash
npm i -D @playwright/test
npx playwright install chromium
```

## 2. 目录约定

```
<前端项目>/
  e2e/
    fixtures/login.ts       # 登录辅助：直接 POST 接口拿 token，写 localStorage
    pages/
      home.spec.ts          # 首页冒烟
      login.spec.ts         # 登录
      product-buy.spec.ts   # 商品详情→立即购买
    playwright.config.ts
```

## 3. playwright.config.ts 模板

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 }, // iPhone 12 模拟移动端
    extraHTTPHeaders: {
      'X-OsClient': 'lsg' // Microi 多租户标识
    }
  },
  webServer: {
    command: 'npm run dev:h5',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 12'] } }
  ]
});
```

## 4. 与 Microi V8 接口对接的登录 fixture

```ts
// e2e/fixtures/login.ts
import { request } from '@playwright/test';
const API = 'https://api.itdos.com';
const OS = 'lsg';

export async function login(phone = '13800000000', pwd = 'admin888') {
  const ctx = await request.newContext();
  const r = await ctx.post(`${API}/apiengine/mall_member_login`, {
    headers: { 'OsClient': OS, 'Content-Type': 'application/json' },
    data: { Phone: phone, Pwd: pwd }
  });
  const json = await r.json();
  if (json.Code !== 1) throw new Error('登录失败: ' + json.Msg);
  return json.Data; // { Token, Member }
}
```

## 5. 典型用例

```ts
// e2e/pages/login.spec.ts
import { test, expect } from '@playwright/test';
import { login } from '../fixtures/login';

test('会员登录走通 mall_member_login', async ({ page }) => {
  const data = await login();
  expect(data.Token).toBeTruthy();
  await page.addInitScript((token) => {
    localStorage.setItem('mci_token', token);
  }, data.Token);
  await page.goto('/');
  await expect(page.getByText('乐闪购')).toBeVisible();
});
```

```ts
// e2e/pages/product-buy.spec.ts
test('商品详情立即购买跳购物车', async ({ page }) => {
  await page.goto('/#/pages/product/detail?id=<ProductId>');
  await page.getByText('立即购买').click();
  await expect(page).toHaveURL(/cart/);
  await expect(page.getByText('结算')).toBeVisible();
});
```

## 6. 断言后端接口

```ts
import { request as r } from '@playwright/test';
test('mall_home_data 允许匿名', async () => {
  const ctx = await r.newContext();
  const res = await ctx.post('https://api.itdos.com/apiengine/mall_home_data', {
    headers: { OsClient: 'lsg' }, data: {}
  });
  const j = await res.json();
  expect(j.Code).toBe(1);
  expect(Array.isArray(j.Data.HotProducts)).toBeTruthy();
});
```

## 7. 运行

```bash
npx playwright test                # 全部
npx playwright test login.spec.ts  # 单个
npx playwright test --ui           # 交互模式
npx playwright show-report         # 查看 HTML 报告
```

## 8. 与 Microi 的协作要点

- 登录类接口必须 `AllowAnonymous=1`（用 `microi_run_engine _mcp_set_engine_anonymous` 修复）。
- token 字段名固定 `mci_token`；接口要在 Header 加 `Token` 或 Body 传 `_Token`。
- uni-app H5 路由模式 `hash`（`/#/pages/...`），所有 Playwright 跳转都要带 `#`。
- CI 中跑：把 `webServer.command` 改成 `npm run build:h5 && npx serve dist/build/h5`，避免 vite dev 的 HMR 噪声。
- 调试技巧：`await page.pause()` 暂停，`PWDEBUG=1` 启动调试器。

## 9. 常见坑

| 现象 | 原因 | 解决 |
|------|------|------|
| 登录返回 null | 引擎 `AllowAnonymous=0` | 在低代码后台或用 `_mcp_set_engine_anonymous` 改成 1 |
| 静态资源 404 | `vite.config.js` 没 `base: './'` | 加上后重新 build |
| tabBar 图标缺失 | dist 中 `static/tabbar/*.png` 没拷贝 | 检查 `src/static/tabbar/` 源文件是否齐全 |
| H5 横向滚动条 | 内部 scroll-x 撑出页面 | 根容器加 `overflow-x:hidden;max-width:100vw` |
| Jint `V8.Db` is null | MCP `run_engine` 上下文没有数据库会话 | 用 `V8.FormEngine.UptFormData` 代替原生 SQL |
