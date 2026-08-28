// Microi 上传字段历经多版：旧数据可能直接保存绝对或相对路径，
// 新单文件保存对象，多文件保存数组；数据库中还可能保存其 JSON 字符串。
// 统一在这里抽取路径，调用方不应把整个对象 String(...) 后拼接到 URL。
export const uploadPathKeys = Object.freeze([
  'Url', 'FileUrl', 'FileURL', 'PreviewUrl', 'PreviewURL', 'FullUrl',
  'Path', 'FilePathName', 'FilePath', 'FullPath', 'Src', 'Href',
  'url', 'fileUrl', 'previewUrl', 'fullUrl',
  'path', 'filePathName', 'filePath', 'fullPath', 'src', 'href'
])

export function normalizeUploadPath(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeUploadPath(item, depth + 1)
      if (normalized) return normalized
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const key of uploadPathKeys) {
      const normalized = normalizeUploadPath(value[key], depth + 1)
      if (normalized) return normalized
    }
    return ''
  }

  const source = String(value).trim()
  if (!source) return ''
  if (/^[{[]/.test(source)) {
    try { return normalizeUploadPath(JSON.parse(source), depth + 1) } catch (_) {}
  }
  return source.replace(/^['"]|['"]$/g, '')
}

function joinBase(base, path) {
  const normalizedBase = String(base || '').trim().replace(/\/+$/, '')
  return normalizedBase ? `${normalizedBase}/${path.replace(/^\/+/, '')}` : path
}

export function resolveUploadedResourceUrl(value, runtime = {}) {
  const path = normalizeUploadPath(value)
  if (!path) return ''
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path
  if (/^\/\//.test(path)) return `https:${path}`

  const apiBase = String(runtime.apiBase || runtime.baseUrl || '').trim()
  // /file/ 和协议 v3 的 /micro-app/v3/ 都是 API 动态解析路由，不是
  // HDFS 对象键；拼到 static/FileServer 会返回 NoSuchKey。
  if (/^\/?file\//i.test(path) || /^\/?micro-app\/v3(?:\/|$)/i.test(path)) {
    return joinBase(apiBase, path)
  }

  return joinBase(runtime.fileServer, path)
}
