/*
 * 租户可修改的 CreateIfMissing 扩展点。只允许调整非敏感公开内容参数，
 * 禁止在此保存或解密第三方平台 Token、Cookie、clientId、apiKey 或密码。
 */
return {
  Code: 1,
  Data: {
    Platform: String(V8.Param.Platform || ''),
    ContentMode: String(V8.Param.ContentMode || ''),
    Payload: V8.Param.Payload || {},
    Changed: false
  }
};
