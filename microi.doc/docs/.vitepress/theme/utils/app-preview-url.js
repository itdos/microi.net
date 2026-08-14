const stableApplicationEntries = Object.freeze({
  'microi-unity-taoyuan': 'https://static.itdos.com/itdos/micro-app/microi-unity-taoyuan/index.html'
})

export function withPreviewVersion(previewUrl, application = {}, baseUrl = 'https://microi.net', runtime = {}) {
  const value = String(previewUrl || '').trim()
  if (!value) return ''
  // Unity WebGL 使用公有桶稳定别名承接最新版；应用发布记录中的 v3 相对
  // PreviewUrl 属于构建内部入口，直接基于 microi.net 解析会落到错误域名。
  const applicationKey = String(application.AppKey || application.appKey || application.Key || application.key || '').trim().toLowerCase()
  if (stableApplicationEntries[applicationKey]) return stableApplicationEntries[applicationKey]
  const url = new URL(value, baseUrl)
  // 商城分享地址固定指向应用根目录的最新版入口；历史版本仍可通过
  // /versions/{version}/index.html 单独访问。运行租户在发布/安装时写入 HTML，
  // 不再把 apiBase、OsClient 和缓存时间戳暴露在分享 URL 中。
  url.pathname = url.pathname.replace(/\/versions\/v?\d+(?:\.\d+){0,3}(?=\/)/i, '')
  url.searchParams.delete('v')
  url.searchParams.delete('apiBase')
  url.searchParams.delete('OsClient')
  url.searchParams.delete('osClient')
  return url.href
}
