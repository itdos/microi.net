# Microi V8 HTTP 外部接口集成

你正在开发 Microi 吾码平台的 V8 引擎代码，需要调用外部 HTTP API（微信、支付宝、短信、ERP 等第三方系统）。

## V8.Http API

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `V8.Http.Get(url, headers)` | GET 请求 | 字符串（响应体） |
| `V8.Http.Post(url, body, headers)` | POST 请求 | 字符串（响应体） |
| `V8.Http.Put(url, body, headers)` | PUT 请求 | 字符串（响应体） |
| `V8.Http.Delete(url, headers)` | DELETE 请求 | 字符串（响应体） |
| `V8.Http.PostResponse(url, body, headers)` | POST（完整响应） | `{ Content, Headers, StatusCode }` |
| `V8.Http.GetResponse({ Url })` | GET（完整响应） | `{ Content, Headers, StatusCode, RawBytes }` |

## 基本用法

### GET 请求

```javascript
var headers = { Authorization: 'Bearer ' + token };
var response = V8.Http.Get('https://api.example.com/users?page=1', headers);
var data = JSON.parse(response);
```

### POST JSON

```javascript
var body = JSON.stringify({
  name: V8.Param.name,
  phone: V8.Param.phone
});

var headers = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer ' + token
};

var response = V8.Http.Post('https://api.example.com/users', body, headers);
var result = JSON.parse(response);
```

### POST Form

```javascript
var body = 'grant_type=client_credentials&appid=' + appId + '&secret=' + appSecret;
var headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
var response = V8.Http.Post('https://api.example.com/oauth/token', body, headers);
```

### 获取完整响应（含状态码）

```javascript
var result = V8.Http.PostResponse(
  'https://api.example.com/submit',
  JSON.stringify({ orderId: V8.Param.orderId }),
  { 'Content-Type': 'application/json' }
);

if (result.StatusCode !== 200) {
  return { Code: 0, Msg: '第三方接口返回 ' + result.StatusCode };
}

var data = JSON.parse(result.Content);
```

## 实战模式

### 微信小程序 access_token

```javascript
// 从缓存获取 token，过期则重新请求
var cacheKey = 'wx_access_token';
var token = V8.Cache.Get(cacheKey);

if (!token) {
  var appId = 'your_appid';
  var secret = 'your_secret';
  var url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + appId + '&secret=' + secret;
  var response = V8.Http.Get(url, {});
  var result = JSON.parse(response);

  if (result.access_token) {
    token = result.access_token;
    V8.Cache.Set(cacheKey, token, 7000);  // 缓存 7000 秒（有效期 7200 秒）
  } else {
    return { Code: 0, Msg: '获取 access_token 失败: ' + (result.errmsg || '') };
  }
}

return { Code: 1, Data: { access_token: token } };
```

### 签名验证（HmacSHA256）

```javascript
var timestamp = V8.Action.GetTimestamp().toString();
var nonce = V8.Method.NewGuid().replace(/-/g, '').substring(0, 16);
var signStr = timestamp + '\n' + nonce + '\n' + body + '\n';
var signature = V8.EncryptHelper.HmacSha256(apiSecret, signStr);

var headers = {
  'Content-Type': 'application/json',
  'X-Timestamp': timestamp,
  'X-Nonce': nonce,
  'X-Signature': signature
};

var response = V8.Http.Post(url, body, headers);
```

### 调用其他 Microi 接口引擎

```javascript
// 不需要 HTTP，直接内部调用
var result = V8.ApiEngine.Run('calculate-price', {
  productId: V8.Param.productId,
  quantity: V8.Param.quantity
});

if (result.Code !== 1) {
  return { Code: 0, Msg: '价格计算失败: ' + result.Msg };
}
```

### Webhook 回调处理

```javascript
// 接收外部 Webhook（将此引擎作为 Webhook URL）
var payload = V8.Param;  // 外部系统 POST 过来的数据

V8.Method.AddSysLog('Webhook', JSON.stringify(payload), 'third-party');

if (payload.event === 'payment.success') {
  V8.FormEngine.UptFormDataByWhere('OrderHeader', {
    _Where: [['OrderNo', '=', payload.order_no]],
    PayStatus: 'paid',
    PayTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
}

return { Code: 1, Msg: 'ok' };
```

## 错误处理模式

```javascript
try {
  var response = V8.Http.Post(url, body, headers);
  var result = JSON.parse(response);

  if (result.code !== 0) {
    V8.Log.Error('Third-party API error: ' + response);
    return { Code: 0, Msg: '第三方接口错误: ' + (result.message || result.msg || '') };
  }

  return { Code: 1, Data: result.data };
} catch (ex) {
  V8.Log.Error('HTTP request failed: ' + ex.message);
  return { Code: 0, Msg: '请求第三方接口失败，请稍后重试' };
}
```

## 注意事项

- `V8.Http` 的 `body` 参数是字符串，发送 JSON 时需要 `JSON.stringify()`
- `headers` 参数是对象 `{ key: value }`，可以为空对象 `{}`
- 第三方 API 密钥建议存在数据库配置表中，不要硬编码
- 调用外部接口应加 try-catch，第三方服务不可控
- 对于需要缓存的 token（如微信 access_token），使用 `V8.Cache` 避免频繁请求
- 内部接口引擎之间的调用用 `V8.ApiEngine.Run()`，不需要 HTTP
