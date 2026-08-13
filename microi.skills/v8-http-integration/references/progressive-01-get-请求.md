# v8-http-integration 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-http-integration-004 sha256=88c4d57c8f52d60f547b92fc14c0552fa9283e857c65fac4ae4b756f39997260 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-005 sha256=ae05f44b4857a7244fdeafab994ef41217252694228569a9701988a3857b5438 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-006 sha256=b5e8b317857ac4d81818ba230dadd927d12ef9cddb989921bdbeffe8e96527a3 -->
## 前端 V8 行为与兼容性

- 前端新代码应优先使用 `await V8.Http.Get/Post/Patch`，参数与后端一致；不要再把 `V8.Post/Get` 作为新功能首选。旧 `V8.Post/Get` 仅作为兼容 API 保留，其回调和 Promise 写法保持不变。
- 相对地址或当前 `ApiBase` 地址会沿用吾码登录头，并接收响应中的新 `authorization`；第三方绝对地址不会自动携带吾码 Token，避免凭据泄漏。
- 浏览器请求第三方地址受 CORS 限制；这是浏览器安全策略，后端 `V8.Http` 不受浏览器 CORS 限制。
- 前端字符串方法同后端一样返回原始响应文本，不会自动 `JSON.parse`；需要对象时显式解析。
- 浏览器端不支持后端的 `FilesStream`，可使用 `FilesByteBase64`、`FilesByteString` 或 `FilesByte`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-007 sha256=92a9eea0bf36292444a9aae6cc73c91eda6e9b5d8d8ce78f6b8ca50cc47c28f8 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-008 sha256=81da35a51dd4d8e43ddc5242045ca0b4590ed140d589b491e45b41231b7c13d2 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-009 sha256=a12a323aae2e4bb30c3a998e570b6ed8c7e76641afe0f54dffd7701611ff1c6e -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-010 sha256=34d6d62f7d02a585b17bc93f65c260be7c50529f65b4f9ea4ec12da4285f82da -->
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

<!-- /microi-progressive:chunk -->
