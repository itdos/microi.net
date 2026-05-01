# Microi V8 HTTP 外部接口集成

你正在开发 Microi 吾码平台的 V8 引擎代码，需要调用外部 HTTP API（微信、支付宝、短信、ERP 等第三方系统）。

## V8.Http API

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `V8.Http.Get({...})` | GET 请求 | 字符串（响应体） |
| `V8.Http.Post({...})` | POST 请求 | 字符串（响应体） |
| `V8.Http.GetResponse({...})` | GET（完整响应） | `{ Content, Headers, StatusCode }` |
| `V8.Http.PostResponse({...})` | POST（完整响应） | `{ Content, Headers, StatusCode }` |

## POST 请求（对象参数格式）

> `V8.Http.Get/Post` 还支持简洁形式：`V8.Http.Get(url)` / `V8.Http.Post(url, body, headers)`，但**对象参数格式更明确、推荐**。

```javascript
// POST JSON（推荐使用对象参数格式）
var result = V8.Http.Post({
  Url: 'https://api.example.com/users',          // 必传
  PostParam: { name: '张三', phone: '13800001234' }, // form 参数（不支持多级嵌套）
  ParamType: 'json',           // 请求类型：默认 form，可选 json / xml
  Timeout: 10,                 // 超时秒数，默认 5 秒
  Headers: { Authorization: 'Bearer ' + token }  // 请求头
});
var data = JSON.parse(result);
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
- `Headers` 参数也可以写成 `Header`（两者等效）
- 第三方 API 密钥建议存在 `V8.OsClientModel`（SaaS 引擎）中，不要硬编码
- 调用外部接口应加 try-catch，第三方服务不可控
- 对于需要缓存的 token（如微信 access_token），使用 `V8.Cache` 避免频繁请求
- 缓存过期时间格式为 `d.HH:mm:ss`，如 `0.01:00:00` 表示 1 小时
- 内部接口引擎之间的调用用 `V8.ApiEngine.Run()`，不需要 HTTP
