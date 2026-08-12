---
name: microi-frontend-sdk
description: Microi 前端 SDK 使用规范，适用于 Vue 3、uni-app、H5、PC 网站与 Microi.Client 扩展。用于创建或修改前端请求、登录态、Token 续签、终端会话、上传、文件 URL、ApiEngine、FormEngine 或应用启动代码。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi 前端 SDK

所有 Vue 3 前端项目都应使用 `microi.skills/microi.v8.js` 作为统一的 Microi 前端 SDK。新项目不要复制旧版 Vue2/Vuex 请求封装，也不要重新手写 token、上传、文件 URL、ApiEngine 或 FormEngine 层。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-000 sha256=06f944bc009a4e773ae6d5496d435d3e4a4fdb23d59107dac9cedffcfdf18f86 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-001 sha256=f1c2ab1fadc01dbe8ea4b9de98f7c02192c3f2cfed8b792fe62f8ef516b67d83 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-002 sha256=5842c30af751f60041e4435efe5c993144a874cb2e9d97c41fb37d1f06d6474e -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-003 sha256=d5d1984e6cd4efbb2340f984473146c66bb342d60bb571454c457f5673b1c68f -->
## 请求头规则

SDK 的 `buildHeaders` 必须集中处理所有请求头，不能让页面、业务 wrapper 或上传逻辑各自拼接租户和鉴权头。

- `osclient` 必须作为唯一租户请求头键，值来自当前运行期租户，例如 `demo`。写入前删除已有 `OsClient` / `osclient` / 任意大小写变体。
- `Authorization` 写入前也必须删除已有 `Authorization` / `authorization` 变体。需要同时兼容平台 Token 时，可以保留单独的 `Token` 请求头，但它也必须先做大小写去重。
- 页面传入的 `headers` / `header` 要先合并，再统一去重；禁止 `headers.OsClient = ...` 和 `headers.osclient = ...` 同时存在。
- 小程序授权登录、账号登录、刷新 Token、FormEngine、ApiEngine、上传都必须走同一套去重逻辑。
- 验收时检查真实网络请求：不得出现 `osclient: demo, demo`、`Authorization: Bearer xxx, Bearer xxx` 这类逗号合并值。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-004 sha256=c5f546fd4ef770459d42239b40af81d52399a3623340472b703cffe09a7b5d1e -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-frontend-sdk-005 sha256=1a9d0a33adbff849decf01d114e72cad96f80a6122f0b281cecf9092bbcd0c42 -->
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

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-token-当前登录用户与当前终端登录协议.md](references/progressive-01-token-当前登录用户与当前终端登录协议.md)：Token、当前登录用户与当前终端登录协议；仅支持 Vue 3；Key-Value 枚举的跨端约定（强制）；界面层独立；验证；搭配 MCI-UI；MicroApp 宿主 Token 同步
<!-- microi-progressive:end -->
