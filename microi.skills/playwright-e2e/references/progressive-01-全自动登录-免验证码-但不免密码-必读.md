# playwright-e2e 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=playwright-e2e-008 sha256=353b1e7ec1d3e93d1fac92c8e9d6e520bf77b628a4141524a09404814f7affb7 -->
## 全自动登录（免验证码，但不免密码）——必读

E2E 自动化最容易卡在「登录页有图形验证码」。Microi 后端允许自动化跳过验证码，但账号和密码必须始终走真实校验；如果密码配置错了，登录接口必须返回账号或密码错误。源码见 `Microi.Server/Microi.net.Api/Controllers/SysUserController.cs`（`Login` 方法开头）。

### 方式 A：自动化登录参数（远端/本地通用）

- 触发条件：请求体传 `_AutomationTestLogin=true` 或 `_SkipCaptchaForAutomation=true`，且当前租户 `sys_config.AutoTestSkipCaptcha=true`（中文 Label：允许自动化测试登录时绕开验证码；字段缺失时按默认开启兼容旧库）。
- 效果：只跳过图形验证码，仍校验 `Account` / `Pwd`。
- 适用：MCP 连接远端租户、CI、Playwright 截图验收、接口自动化登录。
- 风险控制：如果远端环境不希望自动化免验证码，请在系统设置关闭【允许自动化测试登录时绕开验证码】。

Playwright 登录助手（直接拿 Token，不走登录页）：

```js
// helpers/microi-login.js
export async function automationLogin(page, {
  backend = process.env.BACKEND || 'https://localhost:61501',
  osClient = process.env.MICROI_OSCLIENT || 'iTdos',
  account = process.env.PW_TEST_ACCOUNT || 'admin',
  password = process.env.PW_TEST_PASSWORD || '',
  frontend = process.env.FRONTEND || 'http://localhost:61500',
} = {}) {
  const resp = await page.request.post(`${backend}/api/SysUser/Login`, {
    headers: { OsClient: osClient },
    data: { Account: account, Pwd: password, OsClient: osClient, _AutomationTestLogin: true },
    ignoreHTTPSErrors: true,
  });
  const json = await resp.json();
  if (json.Code !== 1) throw new Error('automationLogin failed: ' + JSON.stringify(json).slice(0, 300));
  const token = json.Data?.Token || json.Token;
  const userId = json.Data?.Id || json.Id;
  await page.goto(frontend, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ t, u, oc, account }) => {
    localStorage.setItem('Token', t);
    localStorage.setItem('CurrentUser', JSON.stringify({ Id: u, Account: account }));
    localStorage.setItem('OsClient', oc);
  }, { t: token, u: userId, oc: osClient, account });
  return { token, userId };
}
```

### 选型口诀

- 容器、CI、本机接口自动化都使用 **`_AutomationTestLogin=true` + 真实密码**，直接 request 拿 Token。
- 需要验证真实 UI 登录时，用同一真实账号密码填写页面；目标租户仍由 `sys_config.AutoTestSkipCaptcha` 决定是否允许自动化跳过验证码。
- 失败时再退回 UI 兜底并保留原始错误；禁止新增 `DevLoginBypass`、Dev Key 或 `_DEV_BYPASS_`。
- Token 可能在响应体 `Data.Token`，也可能在响应头 `Authorization`，两处都要兜底取。
- 不要把 Token 明文写进最终报告/附件。

### ⚠️ 关键实测结论（Microi.Client SPA 守卫）

> 实测：**仅把 Token 写进 localStorage 并不能通过前端路由守卫**——页面会反复跳回 `/login`，且动态菜单路由（如 `/order`）在登录态建立前会报 `No match found`。Dev Key 头旁路（方式 A）只对 `page.request` 直连接口有效（见 `blueprint-e2e.spec.mjs`），SPA 仍需要一次真实 UI 登录会话。
>
> 在浏览器内做 E2E（点页面、拖拽、截图）时最稳的登录顺序：
> 1. 跳到 `#/login`；
> 2. 填从受保护测试进程变量或用户本轮提供的真实账号密码；
> 3. 目标租户开启 `AutoTestSkipCaptcha` 时传自动化标记跳过验证码，否则按真实页面流程填写验证码；
> 4. 点「登 录」，落到首页；
> 5. 再 `location.hash = '#/<目标路由>'` 进入目标页。
>
> 直连接口验收（不进页面）使用自动化标记拿 Token；历史 `_DEV_BYPASS_`、Dev Key 和 `DevLoginBypass` 均不得继续使用。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-009 sha256=f864be2aee2ce2490d2a8e241e5852fbd0777590f771397fd3c7973017889ae7 -->
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
2. 从 `PW_TEST_ACCOUNT` / `PW_TEST_PASSWORD` 读取真实测试凭据；脚本不得修改后端 `appsettings.*.json`。
3. 本地后端未启动时，自动进入 `Microi.Server/Microi.net.Api` 后执行 `dotnet run --launch-profile Microi.net.Api`。
4. 启动 Playwright，打开指定前端页面，开启 `MicroiFormTrace`，采集 `window.__MICROI_FORM_TRACE__`、console、pageerror、当前 URL 和 Playwright trace。
5. 页面卡住或断言失败时，先看最后一批 `[MicroiFormTrace #n]`，定位是停在 `runtime:*`、`diy-select:*`、`inform-v8-*`、`field-v8-*` 还是业务 console。

常用环境变量：

```powershell
$env:FRONTEND='http://localhost:61500'
$env:BACKEND='https://localhost:61501'
$env:PW_BACKEND_ENV='iTdos'
$env:PW_ASPNETCORE_ENVIRONMENT='iTdos'
$env:PW_DOTNET_ENVIRONMENT='iTdos'
$env:PW_APPSETTINGS_ENV='iTdos'
$env:MICROI_OSCLIENT='iTdos'
$env:PW_TEST_ACCOUNT='<从本地配置读取或手工覆盖>'
$env:PW_TEST_PASSWORD='<从本地配置读取或手工覆盖>'
$env:MICROI_FREEZE_PATH='/#/diy/diy-design/<TableId>?PageType='
npm run test:form-freeze:auto
```

可选开关：

- `PW_START_BACKEND=0`：不自动启动后端，只跑测试。
- `PW_CONFIG_BACKEND=0`：不修改 `launchSettings.json`。
- `PW_BACKEND_PROFILE=Microi.net.Api`：指定 launch profile。
- `PW_TEST_ACCOUNT`、`PW_TEST_PASSWORD`：仅注入当前自动化进程，必须使用真实账号密码且不得写回文件。
- `PW_HEADED=0`：无头运行。

诊断代码要遵守这些规则：

- 登录优先用真实后端 `/api/SysUser/Login`，token 可能在响应头 `Authorization`，不要只从 `Data.Token` 取。
- 如果 direct-token 被前端守卫踢回登录页，必须保留 UI 登录兜底，模拟真实用户输入账号密码点击登录。
- trace 只在 URL、localStorage 或 `window.__MICROI_FORM_TRACE_ENABLED__` 开启时输出，避免生产默认刷屏。
- 卡死类问题要捕获 `pageerror`；Vue 的 `Maximum recursive updates exceeded` 通常直接暴露根因组件。
- 不要把 token 打印到最终报告里；console 附件中如包含 token，只用于本地诊断，不要转述完整值。
- 修复后必须重跑同一个诊断用例，确认最后 trace 不再无限重复，并且页面在 10-15 秒后仍可响应。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-010 sha256=10e0c01fcbdc6319d6d5037a068a50ed83df2f3b1498326fc349e17c71d30a5d -->
## 移动端视觉与资源验收

uni-app H5、移动商城、分享海报、首页改版这类任务不能只跑接口和 DOM 断言。每次涉及页面风格、图片、二维码、商品卡片、首页聚合时，Playwright 必须补齐以下检查：

- 每个核心页面都保存全页截图到 `tests/e2e/screenshots/`，并用 `view_image` 人眼复核首页、登录页、分享海报、商品列表等关键截图。
- 对关键文字选择器做对比度检查，至少覆盖品牌名、搜索占位、公告、快捷入口、促销卡、分类、商品标题、价格、资产金额。浅底弱灰、金色按钮白字、渐变上低透明文字都应判为失败。
- 图片不能只断言 URL 不为空；必须验证图片真实加载，例如检查 `img.naturalWidth > 0`、uni-image 背景图、或 HTTP 200。坏图、404、空白图都算失败。
- 平台应用图片、海报二维码、公告图、商品图必须来自平台 HDFS/API 或数据库字段。测试中应拦截并拒绝 `qrserver.com`、`create-qr-code`、`picsum.photos`、`placeholder.com`、`dummyimage.com` 等第三方图床/二维码服务。
- 如果接口返回了不可用图片，优先修数据源、上传平台文件或修接口引擎，不要用第三方 fallback 把测试“跑绿”。
- 对分享海报二维码，优先断言平台接口，如 `/api/Os/CreateQRCodeImage`，或平台接口引擎返回的 HDFS 图片路径。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-011 sha256=6f2c751a6f1eb21ea571972d5a2f9d5323b997dbcdca510c2e34784911af5504 -->
## 测试证据必须绑定需求编号

当用户一次提出多个问题时，Playwright 用例、截图文件名和最终测试报告必须能回到原始 `1、2、3...` 编号。

- 每个问题至少要有一个验证入口：DOM 断言、接口回读、数据库回读、截图或人眼复核；不能只测“页面能打开”。
- 截图命名建议包含问题编号和页面，例如 `issue-01-mine-message-recharge-row.png`、`issue-02-certify-approved-consistent.png`。
- 最终报告必须列出：编号、测试命令、是否通过、截图路径、未覆盖原因。
- 如果某项属于后台元数据或数据库配置，仍需通过接口/数据库回读给出证据；前端截图只能证明展示，不等价于后台配置已改。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-012 sha256=1fcd0a28af8226af4f1e4608645c74bf2fe503ce195f05ffd115c590fafabd06 -->
## 移动端/H5 回归纪律

处理 uni-app H5 移动商城的交易、资产、登录、购物车、抢购、充值、分享或图片相关问题时，不能只改代码后让用户手工发现问题。完成实现后必须至少执行（以下变量按项目实际情况替换）：

```powershell
Set-Location '<uniapp-project-root>'      # 替换为项目实际路径
$env:PW_API_BASE='https://localhost:61501' # 替换为项目后端地址
$env:PW_API_ENV='development'
$env:PW_PORT='5192'                       # 替换为项目实际端口
npm run build:h5:local
npx playwright test --reporter=list
```

业务口径规则因项目而异，应在各项目自己的 `tests/e2e/` 目录中维护 spec 断言，不要写进通用 skill。

表单引擎冻结高频根因：

- 在 computed/render/watch 路径里写回同一个响应式依赖，例如 `field.Data` watcher 里再次写 `field.Data`。
- 程序性同步 `el-select` 值时触发 `change`，又执行 V8/FormSet，形成循环。
- 折叠分组、字段 Tabs 等运行态字段属性反复写入 `_isShow`、`_collapseClass`、`_fieldTabsPanes`。
- 前端 InFormV8 或字段 V8 中持续 `FormSet` 同一字段，且没有值相等保护。

当前 Microi.Client 的表单冻结诊断文件是 `tests/form-engine-freeze-trace.spec.mjs`。新增类似测试时，可以复制它的结构：`addInitScript` 注入 `ApiBase/OsClient/Trace`，登录后跳转目标 hash，等待设计/表单 DOM，延迟观察响应性，最后 attach trace 和 console。

<!-- /microi-progressive:chunk -->
