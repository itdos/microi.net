---
name: microi-frontend-sdk
description: Microi 前端 SDK 使用规范，适用于 Vue 3、uni-app、H5、PC 网站与 Microi.Client 扩展。用于创建或修改前端请求、登录态、上传、文件 URL、ApiEngine、FormEngine 或应用启动代码。
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
- JavaScript 需要平台安全区数值时使用 `V8.getSafeArea`；CSS 仍使用 `env(safe-area-inset-*)`。

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

## 请求头规则

SDK 的 `buildHeaders` 必须集中处理所有请求头，不能让页面、业务 wrapper 或上传逻辑各自拼接租户和鉴权头。

- `osclient` 必须作为唯一租户请求头键，值为当前租户，例如 `xjy`。写入前删除已有 `OsClient` / `osclient` / 任意大小写变体。
- `Authorization` 写入前也必须删除已有 `Authorization` / `authorization` 变体。需要同时兼容平台 Token 时，可以保留单独的 `Token` 请求头，但它也必须先做大小写去重。
- 页面传入的 `headers` / `header` 要先合并，再统一去重；禁止 `headers.OsClient = ...` 和 `headers.osclient = ...` 同时存在。
- 小程序授权登录、账号登录、刷新 Token、FormEngine、ApiEngine、上传都必须走同一套去重逻辑。
- 验收时检查真实网络请求：不得出现 `osclient: xjy, xjy`、`Authorization: Bearer xxx, Bearer xxx` 这类逗号合并值。

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

## 搭配 MCI-UI

SDK 负责平台能力，MCI-UI 负责产品界面。新的 Microi Vue3 项目应同时使用：

- `microi.skills/microi.v8.js`：请求、Token、上传、文件 URL、ApiEngine/FormEngine。
- `Microi.UI/src/theme`：`--mci-*` 设计变量。
- `Microi.UI/src/uniapp`：移动端/UniApp 组件。
- `Microi.UI/src/web`：PC 官网和响应式网站组件。

不要在 SDK 内解决界面状态、骨架屏、富文本间距或安全区布局。这一层应使用 MCI-UI 组件处理。

## MicroApp 宿主 Token 同步

Vue3 前端微服务通过 `window.microApp.getData()` 接收主平台上下文时，不能只把 `token` 放进普通配置对象后假设请求会自动携带。标准 `microi.v8.js` 必须支持 `config.token`，且 `getToken()` 要优先读取运行时 token，再回退到 `storage[tokenKey]`。

微服务项目的 `configureMicroiV8()` 必须同时执行：

```js
const next = { apiBase: ctx.apiBase, osClient: ctx.osClient, token: ctx.token };
microiV8.configure(next);
if (ctx.token) microiV8.setToken?.(ctx.token);
```

验收时必须点击一个需要登录态的 `V8.FormEngine` 或 `V8.ApiEngine` 按钮，确认返回 `Code=1`，不能只看页面首屏渲染成功。
