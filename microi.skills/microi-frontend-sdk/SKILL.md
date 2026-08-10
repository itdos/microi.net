---
name: microi-frontend-sdk
description: Microi 前端 SDK 使用规范，适用于 Vue 3、uni-app、H5、PC 网站与 Microi.Client 扩展。用于创建或修改前端请求、登录态、Token 续签、终端会话、上传、文件 URL、ApiEngine、FormEngine 或应用启动代码。
---

# Microi 前端 SDK

所有 Vue 3 前端项目都应使用 `microi.skills/microi.v8.js` 作为统一的 Microi 前端 SDK。新项目不要复制旧版 Vue2/Vuex 请求封装，也不要重新手写 token、上传、文件 URL、ApiEngine 或 FormEngine 层。

## 必须采用的模式

将 SDK 复制到项目源码目录，通常是：

- uni-app: `src/utils/microi.v8.js`
- PC Vue 3 网站: `src/utils/microi.v8.js`
- Microi.Client 扩展页面：如果已有平台请求层就复用；否则从本地工具模块引入 SDK。

在项目请求模块里只创建一个已配置实例：

```js
import { createMicroiV8 } from './microi.v8.js';

export const V8 = createMicroiV8({
  apiBase: config.apiBase,
  fileServer: config.fileServer,
  webBase: config.webBase,
  osClient: config.osClient,
  tokenKey: 'microi_token',
  userKey: 'microi_user',
  formQueryEngineKey: 'mall_form_query',
  maxConcurrent: 8,
  appendOsClientQuery: true,
  onAuthExpired: () => {
    V8.clearToken();
    uni.reLaunch({ url: '/pages/login/login' });
  }
});
```

在 Vue 3 启动入口挂载：

```js
import { V8 } from './utils/request.js';

export function createApp() {
  const app = createSSRApp(App);
  V8.install(app);
  return { app };
}
```

页面和业务接口模块应从项目请求模块导入已配置实例或薄封装函数，不要直接从标准 skill 文件导入。

## 必须委托 SDK 的能力

- `ApiEngine.Run`：直接调用 `/apiengine/{key}` 时使用 `V8.ApiEngine.Run(key, data)`。
- 旧版 `/api/ApiEngine/Run` 只有在老系统仍然需要时才使用 `V8.ApiEngine.RunLegacy(key, data)`。
- FormEngine CRUD 使用 `V8.FormEngine.*`，或使用 `formEngineGet` 这类项目薄封装。
- 上传使用 `V8.uploadFile`。
- 图片、头像、富文本图片、二维码、付款凭证、证件和私有文件使用 `V8.assetUrl`、`V8.resolveFileUrl` 或 `V8.resolveAvatarUrl`。
- Token 与用户缓存使用 `V8.getToken`、`V8.setToken`、`V8.clearToken`、`V8.getUser` 和 `V8.setUser`。
- 公有 HDFS 上的 AI 应用使用 `microi-ai-app-auth.js` 统一桥接登录：页面和只读演示保持匿名可见，首次持久化 `app_*` 操作弹出登录框，登录成功后携带 Token 重试。后端必须再次识别写代码并以 `V8.CurrentUser.Id` 覆盖 `ClientKey`、`ActorKey`、`UserId`，禁止只靠前端按钮判断。
- JavaScript 需要平台安全区数值时使用 `V8.getSafeArea`；CSS 仍使用 `env(safe-area-inset-*)`。

`Microi.Client` 主后台运行时已内置前后端同构的 `V8.Http.Get/Post/Patch` 及对应 Response 方法；表单事件、按钮 V8 等宿主前端新代码必须优先使用 `V8.Http`，旧 `V8.Post/Get` 仅作兼容保留，其参数和兼容规则以 `v8-http-integration/SKILL.md` 为准。独立项目使用本 SDK、且不在主后台 V8 宿主中时，才使用 SDK 自身的小写 `V8.get/post`、`ApiEngine`、`FormEngine`；不要把它们与宿主旧版大写 `V8.Post/Get` 混为一谈，也不要假设浏览器可以绕过第三方接口的 CORS。

## 登录与验证码封装

SDK 或项目请求模块必须提供登录所需的系统配置和验证码薄封装，不要让页面散落手写。

要求：
- 提供 `isEnabledFlag(value)` 或等价工具，统一判断 `Sys_Config.EnableCaptcha`。它必须把 `true`、`1`、`'true'`、`'1'` 识别为开启，把 `false`、`0`、`'false'`、`'0'`、空值识别为关闭。
- 提供 `getSysConfig()`，内部调用 `V8.GetSysConfig(true)` 或 `/api/DiyTable/GetSysConfig`，并保持当前租户 `OsClient` 一致。
- 提供 `getCaptcha()`，内部调用 `GET /api/Captcha/GetCaptcha`，`responseType:'arraybuffer'`，从响应头读取 `captchaid`，返回 `{ CaptchaId, ImageSrc }`。
- 提供账号登录封装时，只有在页面传入验证码时才追加 `_CaptchaId/_CaptchaValue`；不要在未开启验证码时提交空字段。
- PC Vue、UniApp H5、微信小程序和 App 的账号密码登录都必须使用同一套验证码判断和登录参数契约。

参考薄封装：

```js
export function isEnabledFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    return text === '1' || text === 'true' || text === 'yes' || text === 'on';
  }
  return false;
}

export async function getSysConfig() {
  return await V8.GetSysConfig(true);
}

export async function login(account, pwd, captcha = {}) {
  return V8.Login({
    Account: account,
    Pwd: pwd,
    _CaptchaId: captcha.CaptchaId || undefined,
    _CaptchaValue: captcha.CaptchaValue || undefined
  });
}
```

### MicroService 独立运行认证（强制）

AI 生成的前端微服务不能假定永远在主平台 iframe/micro-app 宿主中运行：

- `window.microApp` 存在且宿主下发 Token 时，直接配置同一个 SDK 实例并进入业务页，不重复显示登录。
- 独立访问时从 `.microi-micro-app.json`/构建配置取得 `apiBase` 与 `osClient`，先复用 SDK 已保存的有效 Token；无 Token 时显示平台帐号密码登录。
- 初始化必须调用 `V8.GetSysConfig(true)` 并按 `EnableCaptcha` 动态决定验证码。验证码接口固定为 `GET /api/Captcha/GetCaptcha`，响应头读取 `captchaid`；只有启用时才向 `V8.Login` 追加 `_CaptchaId/_CaptchaValue`。
- 登录仍签发平台 DiyToken，不创建平行 Token、平行用户表或微服务自有密码体系。失效事件回到登录态，Token 续签仍按本 Skill 的单实例规则处理。
- 宿主额外传入 `permissionContext={sysMenuId,moduleEngineKey,diyTableId}`。SDK/服务层需要访问 FormEngine 时使用真实授权 `moduleEngineKey`；该对象不能代替后端权限，也不能成为放宽匿名接口的理由。

## 请求头规则

SDK 的 `buildHeaders` 必须集中处理所有请求头，不能让页面、业务 wrapper 或上传逻辑各自拼接租户和鉴权头。

- `osclient` 必须作为唯一租户请求头键，值来自当前运行期租户，例如 `demo`。写入前删除已有 `OsClient` / `osclient` / 任意大小写变体。
- `Authorization` 写入前也必须删除已有 `Authorization` / `authorization` 变体。需要同时兼容平台 Token 时，可以保留单独的 `Token` 请求头，但它也必须先做大小写去重。
- 页面传入的 `headers` / `header` 要先合并，再统一去重；禁止 `headers.OsClient = ...` 和 `headers.osclient = ...` 同时存在。
- 小程序授权登录、账号登录、刷新 Token、FormEngine、ApiEngine、上传都必须走同一套去重逻辑。
- 验收时检查真实网络请求：不得出现 `osclient: demo, demo`、`Authorization: Bearer xxx, Bearer xxx` 这类逗号合并值。

## Token、当前登录用户与当前终端登录协议

Microi 后端不是只保存一个全局 Token。每个租户、每个 `sys_user` 在 Redis 中维护一份 `CurrentToken`，其中 `CurrentUser` 表示平台当前登录用户，`Tokens` 表示该用户的多个当前终端登录。每个终端项至少包含 `Token`、`ClientType`、`Did`、`IP`、`CreateTime`、`UpdateTime`；退出、管理员清除登录信息、同终端重新登录或 Token 轮换都会影响该列表。

登录必须同时标记终端类型和稳定设备 Id：

```js
const V8 = createMicroiV8({
  apiBase,
  osClient,
  clientType: 'Mobile', // PC / Mobile / H5 / App / WxMiniProgram / VSCode / MCP
  didKey: 'microi_did'
});

const result = await V8.Login({
  Account,
  Pwd,
  _ClientType: 'Mobile'
});
```

- PC 后台传 `_ClientType:'PC'`，有效期读取 SaaS 引擎 `SessionAuthTimeout`，单位分钟，默认 20 分钟。
- VS Code 传 `_ClientType:'VSCode'`，优先读取 `VSCodeAccessTokenLifetime`，否则读取 `AccessTokenLifetime`，单位天，默认 30 天。
- MCP 传 `_ClientType:'MCP'`，优先读取 `McpAccessTokenLifetime`，否则读取 `AccessTokenLifetime`，单位天，默认 30 天。
- Mobile、H5、App、各类小程序及其它非 PC 终端读取 `AccessTokenLifetime`，单位天，默认 30 天。
- `did` 通过请求头发送，同一安装或浏览器配置必须稳定持久化；不要每次请求生成新值。标准 SDK 使用 `V8.getDid()` 自动生成和复用。
- Token 优先从响应头 `authorization` 读取，并立即覆盖本地旧 Token；兼容接口才从响应体读取。每个受保护请求都要接收响应头中的新 Token，因为后端可能在普通请求中自动轮换。

### 续签时机

不要把本地固定 15 分钟当作所有终端的有效期。读取 JWT 的 `exp` 与 `MicroiTokenIssuedAt`，在到期前按以下规则触发以旧换新：

```text
提前量 = lifetime / 10
最少提前 5 分钟
最多提前 1 天
```

因此默认 PC 20 分钟会在约第 15 分钟续签；默认移动端、VS Code 30 天会在到期前 1 天进入续签窗口。调用：

```js
V8.startTokenMaintenance();

// UniApp/App/小程序每次回到前台
await V8.resumeAuthSession(false);

// 主动以旧换新
const result = await V8.refreshToken();
```

- Web 同时监听 `visibilitychange`、`focus`、`pageshow`。浏览器可能休眠后台标签页并暂停 `setInterval`，恢复可见时必须立即检查，不能等下一个定时周期。
- UniApp/App/小程序在 `App.onShow` 调用 `resumeAuthSession(false)`。
- VS Code 在扩展激活后维护 Token，并在 `vscode.window.onDidChangeWindowState` 恢复焦点时立即检查。
- 多请求、多 Tab 续签必须 single-flight。PC 后台可使用 Web Locks；收到响应时，如果本地 Token 已被其它 Tab 更新，旧请求不得把旧 Token 覆盖回来或清掉新登录态。
- 调用 `/api/SysUser/RefreshToken` 时同时传旧 `authorization`、当前 `OsClient`、原终端 `_ClientType`，请求头继续传稳定 `did`。不要频繁无条件换新。

### 失效提示与租户边界

受保护接口返回 `Code=1001/1002`，或 RefreshToken 返回登录失效时，必须原样展示后端 `Msg`，禁止覆盖成固定“登录已过期”。后端会返回 `DataAppend` 诊断：

| `ReasonCode` | 处理方式 |
|---|---|
| `JwtExpired` / `SessionExpired` | 展示已过期分钟、小时或天以及过期时间，然后清理当前终端会话并重新登录 |
| `TenantMismatch` | 提示 Token 所属租户与当前请求租户，切换租户或重新登录；禁止把该 Token 用于当前租户 |
| `TokenReplaced` | 先检查本地 Token 是否已被其它 Tab/并发请求更新；有新 Token 时重试一次，否则重新登录 |
| `SessionMissing` | 服务端登录态已退出、被管理员清除或缓存已重建；清理本地 Token 并重新登录 |
| `AuthVersionChanged` | 后端安全版本已升级，必须重新登录 |
| `MalformedToken` / `MissingClaims` | Token 无法继续使用，清理并重新登录 |

不要显示完整 Token、用户密码或密钥。日志只记录 `ReasonCode`、终端类型、脱敏 `did`、请求租户和 Token 租户。`TokenOsClient` 只用于提示和诊断，真正鉴权仍以服务端签名、租户和 Redis 当前终端列表为准。

### Token 验收

- PC、移动端、VS Code 分别登录，回读 JWT `ClientType`、`Did` 和有效期，确认命中对应 SaaS 配置。
- 模拟页面隐藏超过 PC 有效期后恢复，确认先执行续签；若已无法续签，提示精确显示过期时长。
- 使用 A 租户 Token 请求 B 租户，确认返回 `TenantMismatch`，提示同时包含 Token 租户与当前租户且不泄漏 Token。
- 同一旧 Token 并发调用两次 RefreshToken，确认复用同一新 Token，后续请求成功。
- 管理员调用 `ClearUserLoginInfo` 后，旧 Token 返回 `SessionMissing` 或等价明确原因，前端不再循环续签。

## 上传规则

`V8.uploadFile` 是 Microi 前端唯一允许的上传入口。SDK 实现必须：

- 使用 multipart 上传头。`uni.uploadFile` 或 `fetch(FormData)` 不得发送 `Content-Type: application/json`。
- 租户请求头只发送一个键：`osclient`。添加配置租户前，先移除传入的 `osclient` / `OsClient` 重复键。
- `formData` 中发送 `OsClient`；开启 `appendOsClientQuery` 时保留接口查询参数 `?OsClient=tenant`。
- 上传 `Path` 统一从 `options.path`、`formData.Path` 或 `formData.path` 归一化。
- 移动端上传路径必须是安全相对路径，例如 `mall/pay-proof` 或 `mall/member/avatar`。不要使用 `/mall/pay-proof`、完整 URL、磁盘路径、`..`、`:`、`//` 或 `~`。
- 项目薄封装要通过 `{ ...options, path: options.path || defaultPath }` 透传全部选项，避免丢失页面级 `headers`、`action`、`anonymous`、`file`、`formData` 和 `silentError`。
- H5 页面要保留 `uni.chooseImage` 返回的真实 `File` 对象（可用时为 `tempFiles[0].file`）。如果 H5 只返回 `tempFiles[0]` 或 `blob:` / `data:` 临时路径，也要继续传入，不要丢弃。调用 `V8.uploadFile(..., { file, preferFetch:true })`。SDK 必须识别 `File` / `Blob`、`file` / `raw` / `blob` / `originFileObj` 等常见嵌套字段，以及 `blob:` / `data:` 路径，然后优先使用 `fetch + FormData`，必要时在 `uni.uploadFile` 与 fetch 之间回退。
- 上传提交处理不得使用空 `catch`。要用 `body.Msg` / `error.message` 提示用户，记录错误便于诊断，并在 `finally` 中重置上传状态。
- 上传响应与普通请求一样可能通过 `Authorization` / `Token` 响应头轮换登录令牌；`fetch(FormData)` 和 `uni.uploadFile` 成功回调都必须先接收新 Token，再发起后续接口。

当上传突然报 `移动端文件上传路径不合法！` 时，先检查实际 multipart 表单字段和请求头。在 Microi 移动端/会员 Token 流程中，后端会在 HDFS 上传前校验 `Path`；错误的 `Content-Type` 会导致后端读不到表单字段，并表现为路径错误。

## 项目封装规则

面向业务页面的函数名要保持稳定。如果已有项目导出 `callEngine`、`formEngineGet`、`getImageUrl`、`parseImages` 或 `uploadFile`，保留这些导出，内部委托给 `V8`。这样既能统一 SDK，又能避免大面积改页面。

正确写法：

```js
export function callEngine(key, params = {}, options = {}) {
  return V8.ApiEngine.Run(key, params, { checkCode: true, ...options });
}

export function getImageUrl(value) {
  return V8.assetUrl(value);
}
```

避免写法：

```js
uni.request({ url: apiBase + '/apiengine/' + key, header: { Token: token } });
```

## 仅支持 Vue 3

新的 Microi 前端工作只支持 Vue 3。不要把 Vue2、Vuex、`Vue.prototype` 或 Vue2/uni-app 条件编译加入 `microi.v8.js`。状态管理属于项目本身，通常使用 Pinia 或本地组合函数；SDK 只负责平台访问、请求、鉴权、上传、资源 URL 和小工具。

## Key-Value 枚举的跨端约定（强制）

- PC、UniApp、小程序和 Web 页面遇到简单枚举时，应从字段元数据或业务接口返回的公开 `{Key,Value}` 选项获取数据源；`Value` 只负责展示，`Key` 才能进入表单值、URL、缓存键和接口筛选参数。
- 不得把中文 `Value` 当作查询条件，也不得在各端复制维护互相漂移的中文/英文映射。若业务接口已返回选项投影，优先直接消费；本地常量只能作为接口暂时不可用时的同 Key 兜底。
- 页面 URL 需要保存筛选状态时写入稳定英文 Key，返回页面后按 Key 恢复选中项；切换语言只替换 Value，不得改变 URL 和数据库值。
- 兼容历史数据时，客户端可以短期识别旧 Value，但提交和新 URL 必须立即归一为 Key；长期迁移由服务端完成并回读验证。

## 界面层独立

SDK 不得导入 Element Plus、uni-ui、uView、TDesign、FirstUI、Pinia、Vue Router 或 axios。界面反馈通过可配置适配器提供：

- `toast(message)`
- `confirm(message)`
- `onAuthExpired(body, V8)`
- optional `requestAdapter(options)`

这样同一个 SDK 才能同时用于 uni-app、PC 网站、后台扩展页面和文档演示。

## 验证

将项目改为使用 SDK 后：

- 运行相关构建或类型检查。
- 至少测试一次需要登录的 ApiEngine 调用和一次匿名调用。
- 用 `assetUrl` 测试一个图片或上传 JSON 字段。
- 如果任务涉及鉴权，测试 Token 过期行为。
- 对 uni-app H5，同时验证移动视口和 PC 浏览器手机壳下 SDK 正常工作。

### 复盘：生产构建被 `.env.local` 的 localhost 地址污染

- 触发场景：本地开发通过 `.env.local` 指向 `localhost` API，发布后的官网仍请求开发者电脑的 loopback 地址，线上出现 `Failed to fetch`。
- 根因：Vite 会在所有模式加载 `.env.local`；它不是仅开发模式文件。若生产模式没有更高优先级配置，loopback 地址会被编译进正式产物。
- 通用规则：本地 API 只写入 `.env.development.local`；生产项目必须提供 `.env.production`。独立官网还要在统一 ApiBase 解析层拒绝“生产构建或非本地域名 + localhost/127.0.0.1/::1”，并安全回退到明确的正式 API。
- 自动化检查：生产构建后扫描 JS 产物不得包含本地 ApiBase，并在正式域名上下文断言接口请求 origin 等于配置的生产 API；本地 `npm run dev` 仍应命中开发 API。

## 搭配 MCI-UI

SDK 负责平台能力，MCI-UI 负责产品界面。新的 Microi Vue3 项目应同时使用：

- `microi.skills/microi.v8.js`：请求、Token、上传、文件 URL、ApiEngine/FormEngine。
- `Microi.UI/src/theme`：`--mci-*` 设计变量。
- `Microi.UI/src/uniapp`：移动端/UniApp 组件。
- `Microi.UI/src/web`：PC 官网和响应式网站组件。

不要在 SDK 内解决界面状态、骨架屏、富文本间距或安全区布局。这一层应使用 MCI-UI 组件处理。

## MicroApp 宿主 Token 同步

Vue3 前端微服务通过 `window.microApp.getData()` 接收主平台上下文时，不能只把 `token` 放进普通配置对象后假设请求会自动携带。标准 `microi.v8.js` 必须支持 `config.token`，且 `getToken()` 要优先读取运行时 token，再回退到 `storage[tokenKey]`。微服务必须复用同一个 V8 客户端实例，不能在每次按钮点击时重新 `createMicroiV8()`。

`getData()` 中的 Token 是宿主传入的快照，只能用于首次引导或宿主确实下发了不同值时更新；不能在每次 `configureMicroiV8()` 时用旧快照覆盖 SDK 已从响应头取得的新 Token。推荐同时配置 `onTokenChanged`，把新 Token 与发起请求所用的旧 Token 回传宿主，宿主通过 `DiyCommon.ApplyAuthorizationToken(newToken, requestToken)` 接力并防止多标签页旧响应回写：

```js
const microiV8 = V8; // 模块级单例
let appliedHostToken = '';

microiV8.configure({
  apiBase: ctx.apiBase,
  osClient: ctx.osClient,
  onTokenChanged: (token, requestToken) => {
    window.microApp?.dispatch?.({ type: 'micro-app:token', data: { token, requestToken } });
  }
});
if (ctx.token && ctx.token !== appliedHostToken) {
  appliedHostToken = ctx.token;
  microiV8.setToken(ctx.token);
}
```

普通 `request`、浏览器 `fetch(FormData)` 上传和 `uni.uploadFile` 都必须读取响应头的新 Token。验收时必须连续执行至少两个需要登录态的请求（前一个允许发生 Token 轮换），确认后一个仍返回 `Code=1`；不能只看页面首屏渲染成功。
