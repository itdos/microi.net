export function withPreviewVersion(previewUrl, application = {}, baseUrl = 'https://microi.net', runtime = {}) {
  const value = String(previewUrl || '').trim()
  if (!value) return ''
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
