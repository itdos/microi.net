import { buildApplicationLaunchUrl } from './uniapp-preview-mode.js'
import { normalizeUploadPath } from './upload-resource-url.js'

const stableApplicationEntries = Object.freeze({
  // The fixed query key bypasses the one legacy CDN object that cached a
  // redirect page. The entry shell itself is evergreen and resolves the
  // committed current release inside its full-screen iframe.
  'microi-unity-taoyuan': 'https://static.itdos.com/itdos/micro-app/microi-unity-taoyuan/index.html?stable-entry=current'
})

// 新字段排在前面，后续字段仅用于兼容旧商城记录。版本、发布任务字段
// 故意不在候选集合中，避免首页、应用广场和详情页各自选中不同历史产物。
const experienceUrlFields = Object.freeze([
  'StablePreviewUrl',
  'StableUrl',
  'ExperienceUrl',
  'LaunchUrl',
  'PublicUrl',
  'PublicPublishPath',
  'PreviewUrl',
  'AppUrl',
  'H5Url',
  'Url'
])

const immutableReleasePath = /\/(?:releases?|requests?)(?:\/|$)/i
const immutableVersionPath = /\/versions?(?:\/|$)/i
const legacyVersionSegment = /\/versions\/v?\d+(?:\.\d+){0,3}(?=\/)/gi

function applicationUrlCandidates(application) {
  const valuesByKey = new Map(
    Object.keys(application || {}).map(key => [String(key).toLowerCase(), application[key]])
  )
  return experienceUrlFields
    .map(field => ({ field, value: normalizeUploadPath(valuesByKey.get(field.toLowerCase())) }))
    .filter(candidate => candidate.value)
}

function candidateBaseUrl(candidate, baseUrl, runtime) {
  const fileServer = String(runtime?.fileServer || '').trim()
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(candidate.value)) return baseUrl
  // v3 StableResolverPath 是 API 路由，并不是对象存储中的文件键。
  if (/^\/?micro-app\/v3(?:\/|$)/i.test(candidate.value)) {
    return `${String(runtime?.apiBase || baseUrl).replace(/\/+$/, '')}/`
  }
  if (!fileServer) return baseUrl
  const isPublishedAsset = candidate.field === 'PublicPublishPath'
    || /(?:^|\/)(?:ai-app-publish|micro-app)(?:\/|$)/i.test(candidate.value)
  return isPublishedAsset ? `${fileServer.replace(/\/+$/, '')}/` : baseUrl
}

function normalizePublishedWebEntry(url, applicationKey, runtime) {
  const match = url.pathname.match(/^\/(?:([^/]+)\/)?ai-app-publish\/([^/]+)(?:\/index\.html|\/)?$/i)
  if (!match) return

  let [, tenant, pathAppKey] = match
  try {
    if (applicationKey && decodeURIComponent(pathAppKey).toLowerCase() !== applicationKey) return
  } catch (_) {
    return
  }

  // 早期发布记录可能省略 HDFS 租户目录，并只保存目录 URL；对象存储对
  // 目录 URL 返回的是默认彩蛋页而不是应用。官网已知当前来源租户，因此
  // 只对 ai-app-publish 的精确应用根补齐租户段和 index.html。
  tenant = tenant || String(runtime?.osClient || '').trim().toLowerCase()
  const tenantPrefix = tenant ? `${encodeURIComponent(tenant)}/` : ''
  url.pathname = `/${tenantPrefix}ai-app-publish/${pathAppKey}/index.html`
}

function normalizeProtocolV3ApplicationEntry(url, applicationKey, runtime) {
  const match = url.pathname.match(
    /^\/micro-app\/v3\/tenants\/([^/]+)\/kinds\/([^/]+)\/apps\/([^/]+)\/assets\/index\.html$/i
  )
  if (!match) return null

  let pathAppKey
  try {
    pathAppKey = decodeURIComponent(match[3]).trim().toLowerCase()
  } catch (_) {
    return false
  }
  if (applicationKey && pathAppKey !== applicationKey) return false

  let tenant
  try {
    tenant = String(runtime?.osClient || decodeURIComponent(match[1])).trim().toLowerCase()
  } catch (_) {
    return false
  }
  if (!tenant || !pathAppKey) return false

  url.pathname = `/micro-app/v3/tenants/${encodeURIComponent(tenant)}/kinds/runtime/apps/${encodeURIComponent(pathAppKey)}/assets/index.html`
  const apiBase = String(runtime?.apiBase || '').trim()
  if (apiBase) {
    try {
      const apiUrl = new URL(apiBase)
      if (!['http:', 'https:'].includes(apiUrl.protocol)) return false
      url.protocol = apiUrl.protocol
      url.host = apiUrl.host
      url.username = apiUrl.username
      url.password = apiUrl.password
    } catch (_) {
      return false
    }
  }
  return true
}

function canonicalStableUrl(candidate, baseUrl, runtime, applicationKey) {
  const value = candidate.value
  let url
  try {
    url = new URL(value, candidateBaseUrl(candidate, baseUrl, runtime))
  } catch (_) {
    return ''
  }
  if (!['http:', 'https:'].includes(url.protocol)) return ''
  // release/request 地址没有通用的“当前版本”推导规则，只能跳过并继续尝试
  // 其它稳定或旧字段；禁止把一次发布任务产物暴露为官网长期入口。
  if (immutableReleasePath.test(url.pathname)) return ''
  // 旧 Web/UniApp 发布器只保存过 versions/{version}/index.html。该结构的
  // 固定最新版入口是去掉版本段后的同一根目录，可以安全规范化。
  url.pathname = url.pathname.replace(legacyVersionSegment, '')
  if (immutableVersionPath.test(url.pathname)) return ''
  const protocolV3 = normalizeProtocolV3ApplicationEntry(url, applicationKey, runtime)
  if (protocolV3 === false) return ''
  normalizePublishedWebEntry(url, applicationKey, runtime)
  for (const key of ['v', 'version', 'release', 'request', 'requestId', 'apiBase', 'OsClient', 'osClient']) {
    url.searchParams.delete(key)
  }
  return url.href
}

export function resolveStableApplicationEntry(application = {}, baseUrl = 'https://microi.net', runtime = {}) {
  // Unity WebGL 使用公有桶稳定别名承接最新版；应用发布记录中的 v3 相对
  // PreviewUrl 属于构建内部入口，直接基于 microi.net 解析会落到错误域名。
  const applicationKey = String(
    application.AppKey || application.AppId || application.appKey || application.appId || application.Key || application.key || ''
  ).trim().toLowerCase()
  if (stableApplicationEntries[applicationKey]) return stableApplicationEntries[applicationKey]
  for (const candidate of applicationUrlCandidates(application)) {
    const stableUrl = canonicalStableUrl(candidate, baseUrl, runtime, applicationKey)
    if (stableUrl) return stableUrl
  }
  return ''
}

export function resolveApplicationExperienceUrl(application = {}, windowLike, runtime = {}) {
  const baseUrl = String(runtime.baseUrl || windowLike?.location?.origin || 'https://microi.net')
  const stableUrl = resolveStableApplicationEntry(application, baseUrl, runtime)
  if (!stableUrl) return ''
  return buildApplicationLaunchUrl({
    ...application,
    AppKey: application.AppKey || application.AppId || application.appKey || application.key || '',
    ApplicationType: application.ApplicationType || application.AppType || '',
    Name: application.Name || application.AppName || ''
  }, stableUrl, windowLike)
}

// 保留旧导出，供既有调用方逐步迁移；行为已统一委托给稳定入口解析器。
export function withPreviewVersion(previewUrl, application = {}, baseUrl = 'https://microi.net', runtime = {}) {
  return resolveStableApplicationEntry({ ...application, PreviewUrl: previewUrl }, baseUrl, runtime)
}
