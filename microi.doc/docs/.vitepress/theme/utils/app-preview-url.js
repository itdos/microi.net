import { buildApplicationLaunchUrl } from './uniapp-preview-mode.js'

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

function normalizeUrlValue(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeUrlValue(item, depth + 1)
      if (normalized) return normalized
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['Url', 'url', 'Href', 'href', 'Path', 'path', 'FilePathName']) {
      const normalized = normalizeUrlValue(value[key], depth + 1)
      if (normalized) return normalized
    }
    return ''
  }
  const source = String(value).trim()
  if (!source) return ''
  if (/^[{[]/.test(source)) {
    try { return normalizeUrlValue(JSON.parse(source), depth + 1) } catch (_) {}
  }
  return source.replace(/^['"]|['"]$/g, '')
}

function applicationUrlCandidates(application) {
  const valuesByKey = new Map(
    Object.keys(application || {}).map(key => [String(key).toLowerCase(), application[key]])
  )
  return experienceUrlFields
    .map(field => ({ field, value: normalizeUrlValue(valuesByKey.get(field.toLowerCase())) }))
    .filter(candidate => candidate.value)
}

function candidateBaseUrl(candidate, baseUrl, runtime) {
  const fileServer = String(runtime?.fileServer || '').trim()
  if (!fileServer || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(candidate.value)) return baseUrl
  const isPublishedAsset = candidate.field === 'PublicPublishPath'
    || /(?:^|\/)(?:ai-app-publish|micro-app)(?:\/|$)/i.test(candidate.value)
  return isPublishedAsset ? `${fileServer.replace(/\/+$/, '')}/` : baseUrl
}

function canonicalStableUrl(candidate, baseUrl, runtime) {
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
    const stableUrl = canonicalStableUrl(candidate, baseUrl, runtime)
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
