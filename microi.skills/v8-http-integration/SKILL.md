---
name: v8-http-integration
description: Microi V8 HTTP 集成指南。用于通过 V8.Http.Get/Post/Patch、对应 Response 方法及后端 Async 方法调用接口，处理请求头、JSON/form/XML 载荷、超时、文件和响应解析，并兼容前后端 V8。
---

# Microi V8 HTTP 外部接口集成

你正在开发 Microi 吾码平台的 V8 引擎代码，需要调用外部 HTTP API（微信、支付宝、短信、ERP 等第三方系统）。

文档维护时，前端用法更新现有 `microi.doc/docs/doc/v8-engine/v8-client.md`，后端用法更新现有 `microi.doc/docs/doc/v8-engine/v8-server.md`；不要新建重复的 V8.Http 文档页面或路由。只维护中文 `docs/doc/`，英文 `docs/en/` 由官网统一翻译生成。

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

## GET 请求

```javascript
// 对象参数格式
var result = V8.Http.Get({
  Url: 'https://api.example.com/users',
  GetParam: { page: 1, size: 20 },   // URL 查询参数
  Timeout: 10,
  Headers: { Authorization: 'Bearer ' + token }
});
var data = JSON.parse(result);
```

## 获取完整响应（含状态码和响应头）

```javascript
var resp = V8.Http.PostResponse({
  Url: 'https://api.example.com/submit',
  PostParamString: JSON.stringify({ orderId: V8.Param.orderId }),
  ParamType: 'json'
});

if (resp.StatusCode !== 200) {
  return { Code: 0, Msg: '第三方接口返回 ' + resp.StatusCode };
}
// resp.Content — 响应内容（字符串）
// resp.Headers — 响应头数组 [{ Name: '', Value: '' }]
// resp.StatusCode — HTTP 状态码

var data = JSON.parse(resp.Content);
```

PATCH 完整响应写法相同：

```javascript
var resp = V8.Http.PatchResponse({
  Url: 'https://api.example.com/users/123',
  PatchParam: { status: 'enabled' },
  ParamType: 'json'
});
```

前端调用时写为 `await V8.Http.PostResponse(...)` 或 `await V8.Http.PatchResponse(...)`。

### 后端 SSRF 与重定向边界

- 严格 SSRF 防护默认关闭；未配置时完全保留历史行为，不限制协议、URL 内嵌凭据、回环、私网、链路本地或云元数据地址，并继续自动处理重定向。
- 只有在 SaaS 引擎主租户启用 `SsrfProtectionEnabled` 后，后端才只允许 HTTP(S)，拒绝 URL 内嵌凭据、回环、私网、链路本地、云元数据和其它特殊地址，并禁止自动跟随 3xx。
- 严格模式需要跳转时读取完整响应的 `StatusCode` / `Headers`，经业务判断后显式发起下一次调用，使每一跳重新校验。
- 严格模式的 SaaS 字段 `SsrfAllowedHosts` 只能加入受控且固定的精确主机，不接受用户输入，不要配置通配。
- DNS 校验不能代替网络层出站 ACL。生产环境还应在容器、主机或网关阻断云元数据和非必要私网段。

## 前端 V8 行为与兼容性

- 前端新代码应优先使用 `await V8.Http.Get/Post/Patch`，参数与后端一致；不要再把 `V8.Post/Get` 作为新功能首选。旧 `V8.Post/Get` 仅作为兼容 API 保留，其回调和 Promise 写法保持不变。
- 相对地址或当前 `ApiBase` 地址会沿用吾码登录头，并接收响应中的新 `authorization`；第三方绝对地址不会自动携带吾码 Token，避免凭据泄漏。
- 浏览器请求第三方地址受 CORS 限制；这是浏览器安全策略，后端 `V8.Http` 不受浏览器 CORS 限制。
- 前端字符串方法同后端一样返回原始响应文本，不会自动 `JSON.parse`；需要对象时显式解析。
- 浏览器端不支持后端的 `FilesStream`，可使用 `FilesByteBase64`、`FilesByteString` 或 `FilesByte`。

## 下载远程文件（图片、PDF 等二进制）

```javascript
var resp = V8.Http.GetResponse({
  Url: 'https://example.com/file.png',
  Timeout: 30
});
if (resp.StatusCode !== 200) return { Code: 0, Msg: '下载失败' };

var bytes = resp.RawBytes;                            // .NET byte[]
var base64 = System.Convert.ToBase64String(bytes);

// 转存到 HDFS
var up = V8.Method.Upload({
  FilesByteBase64: { 'remote.png': base64 },
  Limit: false, Path: '/imported', OsClient: V8.OsClient
});
```

> 文件上传/下载完整模式见 `v8-file-upload/SKILL.md`

## 第三方密钥不要硬编码

```javascript
// ❌ 危险：密钥写死在代码
var apiKey = 'sk-xxxxxxxx';

// ✅ 正确：放在 SaaS 引擎的 OsClientModel
var apiKey = V8.OsClientModel.OpenAIKey;
var secret = V8.OsClientModel.WxPaySecret;
```

详见 `v8-saas-multi-tenant/SKILL.md`
```javascript
// GET 完整响应
var resp = V8.Http.GetResponse({
  Url: 'https://api.example.com/data',
  GetParam: { id: '123' }
});
```

## 实战模式

### 微信小程序 access_token

```javascript
var cacheKey = 'Microi:' + V8.OsClient + ':wx_access_token';
var token = V8.Cache.Get(cacheKey);

if (!token) {
  var appId = V8.OsClientModel.WxAppId;     // 敏感配置存在 SaaS 引擎中
  var secret = V8.OsClientModel.WxAppSecret;
  var result = V8.Http.Get({
    Url: 'https://api.weixin.qq.com/cgi-bin/token',
    GetParam: { grant_type: 'client_credential', appid: appId, secret: secret }
  });
  var data = JSON.parse(result);

  if (data.access_token) {
    token = data.access_token;
    V8.Cache.Set(cacheKey, token, '0.01:56:00');  // 缓存 1 小时 56 分钟
  } else {
    return { Code: 0, Msg: '获取 access_token 失败: ' + (data.errmsg || '') };
  }
}

return { Code: 1, Data: { access_token: token } };
```

### 签名验证（HmacSHA256）

```javascript
var timestamp = V8.Action.GetTimestamp().toString();
var nonce = System.Guid.NewGuid().ToString().replace(/-/g, '').substring(0, 16);
var body = JSON.stringify({ orderId: V8.Param.orderId });
var signStr = timestamp + '\n' + nonce + '\n' + body + '\n';
var signature = V8.EncryptHelper.HmacSha256(apiSecret, signStr);

var result = V8.Http.Post({
  Url: 'https://api.example.com/pay',
  PostParamString: body,
  ParamType: 'json',
  Headers: {
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signature
  }
});
```

### 调用其他 Microi 接口引擎

```javascript
// 不需要 HTTP，直接内部调用（可共享事务）
var result = V8.ApiEngine.Run('calculate-price', {
  productId: V8.Param.productId,
  quantity: V8.Param.quantity
}, V8.DbTrans);

if (result.Code !== 1) {
  return { Code: 0, Msg: '价格计算失败: ' + result.Msg };
}
```

### Webhook 回调处理

```javascript
// 接收外部 Webhook（将此引擎作为 Webhook URL）
var payload = V8.Param;

V8.Method.AddSysLog({
  Title: 'Webhook',
  Content: JSON.stringify(payload),
  Type: 'third-party'
});

if (payload.event === 'payment.success') {
  V8.FormEngine.UptFormDataByWhere('OrderHeader', {
    _Where: [['OrderNo', '=', payload.order_no]],
    PayStatus: 'paid',
    PayTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
}

return { Code: 1, Msg: 'ok' };
```

## V8.Office.SendEmail — 发送邮件

```javascript
V8.Office.SendEmail({
  SmtpServer: 'smtp.qq.com',
  SmtpPort: 587,
  EnableSSL: true,
  SystemEmail: 'admin@itdos.com',
  SystemEmailPwd: 'password',
  EmailSubject: '邮件标题',
  EmailBody: '<b>HTML内容</b>',
  Receivers: ['123@qq.com', '456@qq.com']
});
```

## 错误处理模式

```javascript
try {
  var response = V8.Http.Post({
    Url: url,
    PostParamString: body,
    ParamType: 'json',
    Timeout: 10
  });
  var result = JSON.parse(response);

  if (result.code !== 0) {
    console.error('Third-party API error: ' + response);
    return { Code: 0, Msg: '第三方接口错误: ' + (result.message || result.msg || '') };
  }

  return { Code: 1, Data: result.data };
} catch (ex) {
  console.error('HTTP request failed: ' + ex.message);
  return { Code: 0, Msg: '请求第三方接口失败，请稍后重试' };
}
```

## 注意事项

- `V8.Http.Post` 的 `PostParam` 不支持多级嵌套对象，嵌套需用 `PostParamString`
- `V8.Http.Patch` 的 `PatchParam` 不支持多级嵌套对象，嵌套需用 `PatchParamString`
- `Headers` 参数也可以写成 `Header`（两者等效）
- 前端 `V8.Http` 必须使用 `await`；后端接口引擎无需 `await`
- 旧版前端 `V8.Post/Get` 是兼容 API，不能删除；但新代码必须优先使用 `V8.Http`
- 第三方 API 密钥建议存在 `V8.OsClientModel`（SaaS 引擎）中，不要硬编码
- 调用外部接口应加 try-catch，第三方服务不可控
- 对于需要缓存的 token（如微信 access_token），使用 `V8.Cache` 避免频繁请求
- 缓存过期时间格式为 `d.HH:mm:ss`，如 `0.01:00:00` 表示 1 小时
- 内部接口引擎之间的调用用 `V8.ApiEngine.Run()`，不需要 HTTP
