---
name: v8-http-integration
description: Microi V8 HTTP 集成指南。用于通过 V8.Http.Get/Post/Patch、对应 Response 方法及后端 Async 方法调用接口，处理请求头、JSON/form/XML 载荷、超时、文件和响应解析，并兼容前后端 V8。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 HTTP 外部接口集成

你正在开发 Microi 吾码平台的 V8 引擎代码，需要调用外部 HTTP API（微信、支付宝、短信、ERP 等第三方系统）。

文档维护时，前端用法更新现有 `microi.doc/docs/doc/v8-engine/v8-client.md`，后端用法更新现有 `microi.doc/docs/doc/v8-engine/v8-server.md`；不要新建重复的 V8.Http 文档页面或路由。只维护中文 `docs/doc/`，英文 `docs/en/` 由官网统一翻译生成。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-http-integration-000 sha256=c5600510764ba7a160557ef9acd34719d1ab8c65acf635f3d4183ed5ab2e2e1f -->
## V8.Http API

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `V8.Http.Get({...})` | GET 请求 | 字符串（响应体） |
| `V8.Http.Post({...})` | POST 请求 | 字符串（响应体） |
| `V8.Http.Patch({...})` | PATCH 请求 | 字符串（响应体） |
| `V8.Http.GetResponse({...})` | GET（完整响应） | `{ Content, Headers, StatusCode }` |
| `V8.Http.PostResponse({...})` | POST（完整响应） | `{ Content, Headers, StatusCode }` |
| `V8.Http.PatchResponse({...})` | PATCH（完整响应） | `{ Content, Headers, StatusCode }` |

后端接口引擎还提供真实异步方法：

| 方法 | 说明 |
|------|------|
| `await V8.Http.GetAsync({...})` | 异步 GET，返回响应字符串 |
| `await V8.Http.PostAsync({...})` | 异步 POST，返回响应字符串 |
| `await V8.Http.PatchAsync({...})` | 异步 PATCH，返回响应字符串 |
| `await V8.Http.GetResponseAsync({...})` | 异步 GET，返回完整响应 |
| `await V8.Http.PostResponseAsync({...})` | 异步 POST，返回完整响应 |
| `await V8.Http.PatchResponseAsync({...})` | 异步 PATCH，返回完整响应 |
| `await V8.Http.GetStreamAsync({...})` | 异步获取响应流，供当前请求内继续处理 |

前端与后端统一使用 PascalCase 对象参数格式。执行模型不同：后端既可调用同步方法，也可在本次请求内调用显式 `*Async` 方法并 `await`；前端浏览器调用无 `Async` 后缀的方法，但必须 `await` 其 `Promise`。旧版前端 `V8.Post/Get` 继续兼容，不得删除。

```javascript
// 后端接口引擎：请求内异步 I/O
var resp = await V8.Http.PostResponseAsync({
  Url: 'https://api.example.com/orders',
  PostParam: { OrderNo: V8.Param.orderNo },
  ParamType: 'json',
  Timeout: 10
});
if (resp.StatusCode < 200 || resp.StatusCode >= 300) {
  return { Code: 0, Msg: '上游接口调用失败' };
}
```

异步方法只保证当前请求内等待完成，不能替代 Job、MQ、outbox 或平台后台任务。不得用未等待的 Promise、`setTimeout` 或 `Task.Run` 实现“响应后继续处理”。

通用参数：

| 参数 | 说明 |
|---|---|
| `Url` | 必传。后端通常使用绝对地址；前端支持相对当前 `ApiBase` 的地址和绝对地址。 |
| `GetParam` | URL 查询参数；GET、POST、PATCH 均可使用。 |
| `PostParam` / `PatchParam` | POST / PATCH 对象请求体。 |
| `PostParamString` / `PatchParamString` | 已序列化的 JSON 或 XML 请求体，嵌套 JSON 优先使用。 |
| `ParamType` | `form`（默认）、`json`、`xml`、`binary`。 |
| `Timeout` / `TimeOut` | 超时秒数；默认 `600` 秒（10 分钟）。 |
| `Headers` / `Header` | 请求头对象，两种参数名兼容。 |
| `FilesByteBase64` / `FilesByteString` | 文件字段对象，键同时作为字段名和文件名。 |

`GetResponse/PostResponse/PatchResponse` 返回 `Content`、`Headers`、`RawBytes`、`StatusCode`、`ErrorMessage`。后端 `RawBytes` 是 `.NET byte[]`，前端是 `Uint8Array`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-001 sha256=4cbbdd385e24d19413b7534665333c07f2516067e9f34aa40e6adabe9e0506f4 -->
## V8.AI 与底层 HTTP

- 前端 V8 的平台 AI 普通调用优先 `await V8.AI.Chat(...)`。它自动使用当前 ApiBase 和平台登录头、接收响应 Token 轮换，并清除调用参数中的租户、身份、Endpoint、ApiKey 和认证头覆盖；只有确认问题适合进入 URL 日志时才用 `V8.AI.ChatGet(...)`。
- 浏览器打字机效果使用 `await V8.AI.ChatStream(param, onChunk, { Signal })`。它解析 `message/result/error/done` SSE，`onChunk` 接收真实增量；页面关闭时通过 `AbortController` 取消读取。
- 后端 V8 直接使用 `await V8.AI.Chat(...)`、`ChatStream(...)`、`NL2SQL(...)` 或管理员限定的 `NL2V8(...)`。对象在服务端绑定当前 `OsClient` 与认证用户，匿名上下文拒绝；禁止退回到自请求当前 API、转发 Token 或接受用户指定 Endpoint/ApiKey 的包装方式。
- MCP 使用专用 `microi_chat`，由 MCP 连接提供 Token 与租户，只接受对话白名单参数并返回最终 `DosResult`。它不是逐 token MCP 流；其它平台写操作继续使用对应写 Tool 的确认与回读规则。
- `Chat/ChatStream` 虽兼容 GET/POST，含问题、附件和会话上下文时一律优先 POST，避免敏感内容进入 URL、代理日志和浏览器历史。`V8.Http` 继续用于通用第三方 HTTP 集成，不要重复实现平台 AI 的认证或 SSE 解析器。

```javascript
// 前端或后端 V8：普通 AI 对话
var result = await V8.AI.Chat({
  UserChatMsg: '归纳当前工单',
  AiModel: 'MiniMax-M3',
  AiModelId: '当前租户启用的 mic_ai 记录Id'
});
if (result.Code != 1) V8.Tips(result.Msg || 'AI调用失败', false);
else V8.Result = result.Data;
```

完整授权矩阵、SSE、后端安全边界与 MCP 示例维护在官网现有 `system-engine/ai-engine.md`，不要新建重复文档。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-002 sha256=14439c586d3379c6976513df7b3c0b2f9d586ceb4d845d6f6a1abdcb1d58705a -->
## POST 请求（对象参数格式）

> V8 接口引擎中必须使用对象参数格式。尤其禁止 `V8.Http.Get(url)`：当前 .NET 同名重载包含 `Task<string> Get(string)`，Jint 可能把字符串调用解析为异步重载，脚本最终拿到 `[object Promise]`。GET 必须写成 `V8.Http.Get({ Url: url })`；第三方登录、微信 `jscode2session`、AccessToken 等链路保存后必须用无效 code 烟测，确认返回的是第三方明确错误而不是 Promise。

第三方授权链路还必须把身份交换、AccessToken、用户资料/手机号交换拆成独立阶段。每阶段分别捕获 HTTP 异常和第三方业务 `errcode/errmsg`，失败时写带追踪号的脱敏系统日志并把明确原因返回前端；禁止只在最外层返回固定“登录失败”。

```javascript
// POST JSON（推荐使用对象参数格式）
var result = V8.Http.Post({
  Url: 'https://api.example.com/users',          // 必传
  PostParam: { name: '张三', phone: '13800001234' }, // form 参数（不支持多级嵌套）
  ParamType: 'json',           // 请求类型：默认 form，可选 json / xml
  Timeout: 600,                // 超时秒数，默认 600 秒（10 分钟）
  Headers: { Authorization: 'Bearer ' + token }  // 请求头
});
var data = JSON.parse(result);
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-003 sha256=4c7c1346ea1e17b2c2ff096f1cc9b6502ae95b73087f62bc6b3531d01297eddf -->
## PATCH 请求

PATCH 与 POST 的参数完全对称，只需把请求体参数改为 `PatchParam` / `PatchParamString`：

```javascript
// 后端接口引擎：同步返回字符串
var result = V8.Http.Patch({
  Url: 'https://api.example.com/users/123',
  PatchParamString: JSON.stringify({ profile: { name: '新名字' } }),
  ParamType: 'json',
  Timeout: 10,
  Headers: { Authorization: 'Bearer ' + token }
});
var data = JSON.parse(result);

// 前端 V8：参数相同，但浏览器请求必须 await
var result = await V8.Http.Patch({
  Url: '/api/users/123',
  PatchParam: { Status: 1 },
  ParamType: 'json'
});
```

### POST 嵌套 JSON 对象

```javascript
// 多级嵌套对象需使用 PostParamString
var result = V8.Http.Post({
  Url: 'https://api.example.com/complex',
  PostParamString: JSON.stringify({
    user: { name: '张三', address: { city: '北京' } }
  }),
  ParamType: 'json'
});
```

### POST XML

```javascript
var result = V8.Http.Post({
  Url: 'https://api.example.com/xml',
  ParamType: 'xml',
  PostParamString: '<xml><text>内容</text></xml>'
});
```

### POST 上传文件

```javascript
var result = V8.Http.Post({
  Url: 'https://api.example.com/upload',
  PostParam: { name: '附件' },
  FilesByteBase64: { file: 'Base64编码的文件内容' }
  // 或 FilesByteString: { file: '文件字节字符串' }
});
```

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-get-请求.md](references/progressive-01-get-请求.md)：GET 请求；获取完整响应（含状态码和响应头）；前端 V8 行为与兼容性；下载远程文件（图片、PDF 等二进制）；第三方密钥不要硬编码；实战模式；V8.Office.SendEmail — 发送邮件
- [references/progressive-02-错误处理模式.md](references/progressive-02-错误处理模式.md)：错误处理模式；注意事项
<!-- microi-progressive:end -->
