export function withPreviewVersion(previewUrl, application = {}, baseUrl = 'https://microi.net', runtime = {}) {
  const value = String(previewUrl || '').trim()
  if (!value) return ''

  const version = application.AppUpdateTime
    || application.UpdateTime
    || application.LastBuildTaskId
    || application.CurrentVersion
    || application.AppVersion

  const url = new URL(value, baseUrl)
  if (version !== undefined && version !== null && String(version).trim()) {
    url.searchParams.set('v', String(version).trim())
  }
  if (runtime.apiBase) url.searchParams.set('apiBase', String(runtime.apiBase).trim())
  if (runtime.osClient) url.searchParams.set('OsClient', String(runtime.osClient).trim())
  return url.href
}
