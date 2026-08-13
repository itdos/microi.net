# playwright-e2e 详细参考 4

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=playwright-e2e-023 sha256=9ed2035756e67f2c47430d0980ce9ef31d15392e64e38f91c0765e07437c8821 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-024 sha256=b939c97eef28fab71caa54d134ea524d7ed7c8381deec09e38a7d694b15f53c0 -->
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
| 本地浏览器下载失败 | Playwright 下载 Chromium 受阻 | 先用 `PW_BROWSER_CHANNEL=msedge`，没有 Edge 时从吾码 CDN 下载 Chromium 并设置 `PW_CHROMIUM_EXECUTABLE` |
| 用例偶发失败 | HMR 或网络请求未稳定 | CI 使用静态构建，断言明确等待关键元素 |
| 页面有横向滚动 | 组件撑出视口 | 对根容器和列表容器加 `max-width:100vw; overflow-x:hidden` |

### 多服务器、多租户并行上下文模板

`incognito` 的本质是独立存储上下文。Playwright 的 `browser.newContext()` 每次都会创建隔离上下文，
比在同一个浏览器 context 中开多个 Page 更可靠：

```js
function buildLocalMicroiUrl({ apiBase, osClient, route = '/' }) {
  return `http://localhost:61500/?OsClient=${encodeURIComponent(osClient)}`
    + `&ApiBase=${encodeURIComponent(apiBase)}#${route}`;
}

const targetA = await browser.newContext();
const pageA = await targetA.newPage();
await pageA.goto(buildLocalMicroiUrl({ apiBase: apiA, osClient: tenantA, route: '/home' }));
await pageA.waitForFunction(() => Boolean(window.__MICROI_RUNTIME_ENDPOINT__));
await expect.poll(() => pageA.evaluate(() => window.__MICROI_RUNTIME_ENDPOINT__)).toMatchObject({
  apiBase: apiA,
  osClient: tenantA,
  requiresIsolatedContextForParallelTenants: true
});

const targetB = await browser.newContext();
// targetB 重复同样流程；禁止复用 targetA.newPage() 测 tenantB。
```

若给定的是线上吾码页面，先在第三个一次性 context 中读取
`window.__MICROI_RUNTIME_ENDPOINT__`。旧版回退脚本只读取公开运行目标，不读取或输出 Token：

```js
const endpoint = await page.evaluate(() => {
  const current = window.__MICROI_RUNTIME_ENDPOINT__;
  if (current?.apiBase && current?.osClient) return current;
  const stored = JSON.parse(localStorage.getItem('microi.net') || '{}');
  return {
    apiBase: window.ApiBase || stored.ApiBase || location.origin,
    osClient: new URLSearchParams(location.search).get('OsClient') || window.OsClient || stored.OsClient || ''
  };
});
```

OsClient 仍为空时调用目标站点域名租户解析接口或从成功请求确认。手工 Chrome 的第二个不同租户
至少使用无痕窗口，但同一 Chrome 无痕会话的多个窗口可能继续共享存储；三个以上目标使用独立
Profile 或独立 `--user-data-dir`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-025 sha256=be071153d695081b7c20d34cb5e9563480e3f09d9cd0292f2ca4b0245438787b -->
## 前端微服务 E2E 必测点

测试 Vue3 MicroApp 微服务时，不能只验证 `/micro-app/{OsClient}/{appKey}/index.html` 或带 token 的临时 URL。必须先建立真实登录态，再访问用户实际使用的不带 token 菜单路由，例如 `/#/micro-app/{MsKey}/{RoutePath}`，并确认地址栏没有退回旧的 `micro-app-host` 长地址。

同一套微服务绑定多个菜单时，至少选择 3 个真实菜单往返切换 8 轮，逐轮断言主框架 route、当前菜单和子应用可见内容匹配，且没有 `element head is missing`、`Failed to fetch`、`ERR_TOO_MANY_REDIRECTS`、`app name conflict`、永久骨架屏或空白内容。不能只断言 `<micro-app>` 元素存在。

页签缓存验收必须覆盖单一所有者与清理边界：在一个缓存范围内修改表单输入、筛选、内部路由或滚动位置，切走再返回后状态应保持；连续打开 6 个菜单微服务实例，断言运行时最多保留 5 个，最久未使用的隐藏实例重入时正常冷启动；关闭当前/其它/全部 Tab 后对应实例消失，退出登录后全部实例清空。恢复页还要断言收到最新 Token/OsClient/权限/主题/视口上下文，且任一时刻只有一个可见活动微服务。若子应用有轮询或 WebSocket，记录 `appstate-change`，确认 `afterhidden` 暂停、`aftershow` 幂等恢复而没有重复连接。

如果页面内提供 Microi SDK 调用按钮，必须点击并断言返回 `Code=1`，同时确认没有 `登录身份已过期`、`1001`、`1002`。只看到标题文本不代表鉴权链路通过。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-026 sha256=3c8a1e8bbe281064f30f406703230d8df213f1f1e1d124edb8f9fc8a1df782ea -->
## 动态模块按钮验收

修复或新增 `MoreBtns/FormBtns/PageBtns/PageTabs` 时，运行页看到按钮只证明“最终渲染结果”，不能证明入口确实可由模块引擎维护。至少同时保留三类证据：

1. 后端/MCP 回读目标 `sys_menu`，断言对应按钮稳定 `Id`、`Name`、位置字段、`V8CodeShow` 和 `V8Code` 均已保存，并且未覆盖其它客户按钮。
2. 使用真实管理员登录模块引擎设计器，打开目标模块，断言相应按钮编辑区能看到该按钮及代码。
3. 分别在实际列表/卡片或 PC/移动端运行态检查按钮显隐并点击到目标交互；源码回归还要确认通用模板和宽度计算中不存在按模块 Id、Url、表名写死的同名入口。

按钮通过 `V8.OpenDialog` 打开主前端定制组件时，还要断言组件已在全局注册、`ComponentName` 与注册名一致、`DataAppend` 能到达组件，并确认源码没有新增 `V8.Open<业务名>` 专用包装。按钮通过 `V8.OpenAppDialog` 打开微服务时，按 AppKey、RoutePath 和发布版本回读并验收。涉及新旧版本滚动发布时分别说明组件/应用资源尚未就绪和已就绪的预期，不得只在单一版本页面上验收。
<!-- /microi-progressive:chunk -->
