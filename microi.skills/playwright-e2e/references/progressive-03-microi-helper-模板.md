# playwright-e2e 详细参考 3

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=playwright-e2e-016 sha256=63d4ded296636335a96cbdd5a9ada0ec8b42ad9cc616b621c88bd6e45904f7fa -->
## Microi helper 模板

```js
// tests/e2e/helpers/microi.js
import { expect } from '@playwright/test';

export const microiEnv = {
  apiBase: process.env.PW_API_BASE || 'https://api.example.com',
  osClient: process.env.PW_OS_CLIENT || 'demo',
  loginEngine: process.env.PW_LOGIN_ENGINE || 'member_login'
};

// 仅用于需要在 URL 中显式携带租户的普通 GET；POST 不调用此函数。
export function withOsClientQuery(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}OsClient=${encodeURIComponent(microiEnv.osClient)}`;
}

export async function callEngine(request, apiEngineKey, data = {}, token = '') {
  const res = await request.post(`${microiEnv.apiBase}/apiengine/${apiEngineKey}`, {
    headers: {
      'Content-Type': 'application/json',
      apiengine: '1',
      osclient: microiEnv.osClient,
      ...(token ? { Token: token } : {})
    },
    data: { ...data, OsClient: data.OsClient || microiEnv.osClient }
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-017 sha256=6e755119a57eb70165adb5d289dc183f15835866b39bea34f8a4a1902cf01dd6 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-018 sha256=dbad091f3a8461ed0277c118870e4823538b3932552d53fbd7c4a989492047c0 -->
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
  - 同步参见 [microi-uniapp-frontend](../microi-uniapp-frontend/SKILL.md) 中的资源 URL 与 FileServer 前缀规范。
9. 用 `page.on('response', r => { if (r.url().includes('/file/') && !r.ok()) failedAssets.push(r.url()); })` 监听全部资源请求，断言 `failedAssets.length === 0`，能在断言前就抓到 404 图片。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-019 sha256=f9551960b0d5b7748263371dd47359b6056c1ef295c9b475bfa35f0efbb330d0 -->
## 最少冒烟集

任何 Microi 业务系统建议至少覆盖：

1. 公开首页或登录页能打开。
2. 登录接口返回非空响应，且不出现数据库连接或权限错误。
3. 登录态能进入首页或工作台。
4. 一条主业务路径能跑通。
5. 底部 Tab、菜单或核心导航都能加载。
6. 退出登录能清理 Token 并回到登录页。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-020 sha256=3ae1a183eefdcdcbc5924d3205802eb7594da02074cadfbdfb85d88b2005f192 -->
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
6. ApiEngine 使用稳定路径 `/apiengine/{ApiEngineKey}`，并通过唯一的 `osclient` Header 传租户；JSON/Form Body 可冗余携带 `OsClient`。普通 POST/PUT/PATCH/DELETE 禁止追加 `--OsClient--...--`。仅第三方回调或无法设置 Header/Form/Query 的 GET/HEAD 才允许特殊路径。
7. 页面级测试必须把 `请求失败`、`网络错误`、`null`、`待开发`、`开发中` 当成失败信号；这些文案如果出现在页面或 toast 中，说明功能未交付或接口契约错误。
8. 新增、保存、结算、转赠、确认、上传等按钮不能只弹“成功/待开发”toast；必须调用真实业务接口，并通过后端查询验证状态变化。
9. 源码守卫可作为兜底：递归扫描 `src/**/*.vue`、`src/**/*.js`，禁止残留 `待开发|开发中` 占位文案。
10. 新建或更新 ApiEngine 后必须用 HTTP 路径复测一次；只用 `microi_run_engine` 通过不够，因为 HTTP 调用还受 `IsEnable`、`StopHttp`、`AllowAnonymous` 和动态路由缓存影响。
11. 每个移动端项目都要有“接口清单驱动”的契约测试：静态扫描或维护清单覆盖所有 `callEngine('xxx')`，逐个 HTTP 调用并断言不是 404、不是空响应、不是字符串 `null`，且必须是标准 DosResult。
12. 写业务闭环时必须准备可重复测试数据并清理：例如抢购要“创建测试挂单 → 调用抢购 → 验证订单 → 删除测试订单/挂单/提货卡”，购物车要“加入购物车 → 结算 → 验证订单/购物车状态 → 删除测试订单”。
13. 图片断言必须检查真实渲染，而不是只检查元素可见。uni-app H5 的 `<image>` 会渲染成 `UNI-IMAGE`，真实图片在内部 `div.style.backgroundImage` 或子 `img` 上；不要把宿主元素的 CSS 渐变背景算作加载成功。
14. 网络守卫要记录 `requestfailed`，特别是图片资源的 `net::ERR_BLOCKED_BY_ORB` / CORS / 404；首页 banner、商品主图、头像等公开图片必须实际加载。
15. 页面出现浏览器原生 `alert`、`confirm` 或 `prompt` 直接判失败；测试应监听 `page.on('dialog')` 记录类型和文案后关闭对话框，再要求业务改用吾码 Tips、Element Plus 或品牌化可访问弹层。长弹窗需分别滚动到顶部、中部、底部触发反馈，并断言提示/确认层的 bounding box 中心接近当前 viewport 中心且未被遮挡。

移动商城/会员 H5 额外规则：

- 商城会员 Token 来自业务接口引擎（如 `mall_member_login` 或项目自定义登录引擎），不是平台 `Sys_User` Token。
- 移动端会员数据查询不要直连平台 FormEngine；使用租户 ApiEngine 或安全查询代理。
- 商品详情“加入购物车”必须登录；登录后必须写服务端购物车，再进入购物车页验证同一商品可见。
- 购物车、订单、资产、团队、提货、地址、收款方式等会员数据都必须按会员 Id 做后端范围过滤。
- 涉及多种支付/货币类型的项目（如提货卡、积分、余额等），每种支付渠道必须独立测试，不能混用或互通；项目自定义的费率、规则参数应在各自项目的测试文件中维护。
- 库存/商品相关接口（如库存转让、抜购窗口）必须返回标准 DosResult，禁止返回 JS `null`；成功路径必须返回订单 Id 或结果数据。
- 购物车“结算”必须调用业务结算接口，不能残留“功能开发中”占位文案；真实闭环：加入购物车 → 结算 → 断言 Code=1 和订单 Id → 确认购物车已清对应商品。
- 首页运营 banner 推荐从公告或配置表驱动；E2E 要同时断言接口返回、图片真实加载、点击进入详情页。
- 涉及多种支付/货币类型的项目（如提货卡、积分、余额等），每种支付渠道必须独立测试，不能混用或互通；项目自定义的费率、规则参数应在各自项目的测试文件中维护。
- 库存/商品相关接口（如库存转让、抢购窗口）必须返回标准 DosResult，禁止返回 JS `null`；成功路径必须返回订单 Id 或结果数据。
- 购物车`结算`必须调用业务结算接口，不能残留`功能开发中`占位文案；真实闭环：加入购物车 → 结算 → 断言 Code=1 和订单 Id → 确认购物车已清对应商品。
- 首页运营 banner 推荐从公告或配置表驱动；E2E 要同时断言接口返回、图片真实加载、点击进入详情页。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-021 sha256=48af1507276053c301e489b5b261b92657ce79ed2045933d4a462d7c71eb96a8 -->
## 与 MCP 的配合

- `microi_get_db_schema`：写测试前确认表和字段。
- `microi_get_playwright_context`：获取可测菜单 URL、接口引擎、匿名配置。
- `microi_plan_playwright_e2e`：生成推荐的测试文件、环境变量和冒烟路径。
- `microi_run_engine`：调试单个接口引擎，不替代浏览器 E2E。
- `microi_set_engine_anonymous`：登录、注册、公开首页接口需要匿名访问时使用；设置后仍要验证 HTTP `/apiengine/{key}` + `osclient` Header 返回标准 DosResult。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-022 sha256=d05000c40920ae53e9ce758385e2b7ad62a79d7d974491e241e6da8d698c9232 -->
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

<!-- /microi-progressive:chunk -->
