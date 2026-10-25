// 翻译是开发工具进程，不是生产 API。凭据由运行环境注入，源码和诊断只包含字段名。
export function translationConfig(env = process.env) {
  const accessKeyId = String(env.ALIBABA_CLOUD_ACCESS_KEY_ID || '').trim()
  const accessKeySecret = String(env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '').trim()
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('翻译凭据未配置：请通过安全环境注入 ALIBABA_CLOUD_ACCESS_KEY_ID 与 ALIBABA_CLOUD_ACCESS_KEY_SECRET。')
  }
  const securityToken = String(env.ALIBABA_CLOUD_SECURITY_TOKEN || '').trim()
  return { accessKeyId, accessKeySecret, endpoint: 'mt.aliyuncs.com', ...(securityToken ? { securityToken } : {}) }
}
