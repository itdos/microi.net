# v8-http-integration 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-http-integration-011 sha256=b446647747ac6672f011f1cdc9bade6c6af774c7bf737472976f8ac49bbc7709 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-http-integration-012 sha256=5be87e89ec429dd9b79e89014485b7745c2a400f2066d0d989f71c9779de32fc -->
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
<!-- /microi-progressive:chunk -->
