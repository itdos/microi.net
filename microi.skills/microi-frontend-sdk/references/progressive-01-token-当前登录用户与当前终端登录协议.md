# microi-frontend-sdk 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-frontend-sdk-006 sha256=a834ee9855361ec5ed3f466de8d8fef53de89e40a6882b563694471d060a0dfe -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-007 sha256=32ff522b3d30d94eb6cc1747b1f1238e35c1c3d43091f3ce308067e320ecb2a4 -->
## 仅支持 Vue 3

新的 Microi 前端工作只支持 Vue 3。不要把 Vue2、Vuex、`Vue.prototype` 或 Vue2/uni-app 条件编译加入 `microi.v8.js`。状态管理属于项目本身，通常使用 Pinia 或本地组合函数；SDK 只负责平台访问、请求、鉴权、上传、资源 URL 和小工具。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-008 sha256=0c59d00b2e54dd61d194d6246dd787a456ab8f12d4abe6dc330b002f41d7ee26 -->
## Key-Value 枚举的跨端约定（强制）

- PC、UniApp、小程序和 Web 页面遇到简单枚举时，应从字段元数据或业务接口返回的公开 `{Key,Value}` 选项获取数据源；`Value` 只负责展示，`Key` 才能进入表单值、URL、缓存键和接口筛选参数。
- 不得把中文 `Value` 当作查询条件，也不得在各端复制维护互相漂移的中文/英文映射。若业务接口已返回选项投影，优先直接消费；本地常量只能作为接口暂时不可用时的同 Key 兜底。
- 页面 URL 需要保存筛选状态时写入稳定英文 Key，返回页面后按 Key 恢复选中项；切换语言只替换 Value，不得改变 URL 和数据库值。
- 兼容历史数据时，客户端可以短期识别旧 Value，但提交和新 URL 必须立即归一为 Key；长期迁移由服务端完成并回读验证。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-009 sha256=2e428f404342ad21af261e5f5876e34e2b9fc9455791bf0ad73ff4ad5b3e2ed0 -->
## 界面层独立

SDK 不得导入 Element Plus、uni-ui、uView、TDesign、FirstUI、Pinia、Vue Router 或 axios。界面反馈通过可配置适配器提供：

- `toast(message)`
- `confirm(message)`
- `onAuthExpired(body, V8)`
- optional `requestAdapter(options)`

这样同一个 SDK 才能同时用于 uni-app、PC 网站、后台扩展页面和文档演示。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-010 sha256=ee237c45899f7204d3da1a2d589a89268c2db2a9b765f68fc7097eadf8da7104 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-011 sha256=81ac75e383ea5a32ae45aeff1276fc2b8f56141961e70cc3956ae818aaf2fa1d -->
## 搭配 MCI-UI

SDK 负责平台能力，MCI-UI 负责产品界面。新的 Microi Vue3 项目应同时使用：

- `microi.skills/microi.v8.js`：请求、Token、上传、文件 URL、ApiEngine/FormEngine。
- `Microi.UI/src/theme`：`--mci-*` 设计变量。
- `Microi.UI/src/uniapp`：移动端/UniApp 组件。
- `Microi.UI/src/web`：PC 官网和响应式网站组件。

不要在 SDK 内解决界面状态、骨架屏、富文本间距或安全区布局。这一层应使用 MCI-UI 组件处理。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-012 sha256=d869adb0abd87d9ba03b58faa84944a61895773a6c3642f5c20c8a03e315a2ce -->
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
<!-- /microi-progressive:chunk -->
