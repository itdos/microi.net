import { resolveOfficialPublicFileAlias } from './upload-resource-url.js'

// 官网只信任官方更新清单中的吾码 CDN 安装包，避免下载按钮跳到失效别名或第三方地址。
export function installerFromYaml(yaml, platform) {
  const extension = platform === 'mac' ? '.dmg' : '.exe'
  const matches = String(yaml).matchAll(/^\s*-\s*url:\s*(https:\/\/\S+)\s*$/gm)
  for (const match of matches) {
    try {
      const url = new URL(resolveOfficialPublicFileAlias(match[1]))
      if (url.hostname === 'file.microi.net' && url.protocol === 'https:' && url.pathname.toLowerCase().endsWith(extension)) return url.href
    } catch { /* 略过无效 URL，继续检查更新清单的其它文件。 */ }
  }
  return ''
}

export const WINDOWS_LATEST_URL = 'https://microi.net/download/microi-agent/latest.html?platform=windows'

function releaseParts(version) {
  if (typeof version !== 'string' || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) return null
  const parts = version.split('.').map(Number)
  return parts.every(Number.isSafeInteger) ? parts : null
}

export function compareReleaseVersions(left, right) {
  const a = releaseParts(left), b = releaseParts(right)
  if (!a || !b) return null
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1
  }
  return 0
}

function publicInstallerUrl(value) {
  try {
    const url = new URL(resolveOfficialPublicFileAlias(value))
    if (url.protocol === 'https:' && url.hostname === 'file.microi.net'
      && !url.port && !url.username && !url.password && !url.search && !url.hash
      && url.pathname.endsWith('.exe')) return url
  } catch { /* 无效下载记录不替代官方频道入口。 */ }
  return null
}

// 版本记录只在完成资源发布与字节回读后增加。候选、商店包、Mac 包和非不可变链接均不参与。
function publishedWindowsArchive(releases) {
  let selected = null
  for (const release of releases) {
    if (release?.platform !== 'Windows x64' || !releaseParts(release.version)
      || !/^[a-f0-9]{64}$/.test(release.sha256 || '')) continue
    const url = publicInstallerUrl(release.url)
    if (!url || !/^\/microi\/application-assets\/v3\/tenants\/itdos\/kinds\/runtime\/apps\/microi-code-downloads\/releases\/v[0-9.]+\/requests\/[a-f0-9]{64}\/assets\//.test(url.pathname)
      || url.pathname.split('/').at(-1) !== `Microi-Agent-${release.version}-windows-x64-setup.exe`) continue
    if (!selected || compareReleaseVersions(release.version, selected.version) > 0) {
      selected = { version: release.version, url: url.href, source: 'archive' }
    }
  }
  return selected
}

export function selectWindowsDownload(releases, feedYaml = '') {
  const archive = publishedWindowsArchive(releases)
  const versions = [...String(feedYaml).matchAll(/^version:[ \t]*([^\r\n]+?)[ \t]*\r?$/gm)]
  const version = versions.length === 1 ? versions[0][1] : ''
  const installer = publicInstallerUrl(installerFromYaml(feedYaml, 'windows'))
  const validFeed = releaseParts(version) && installer
    && installer.pathname.split('/').at(-1) === `Microi-Agent-${version}-windows-x64-setup.exe`
  // 频道赶上或超过手动发行后回到永久入口，后续正常升版无需再次修改官网。
  if (validFeed && (!archive || compareReleaseVersions(version, archive.version) >= 0)) {
    return { version, url: WINDOWS_LATEST_URL, source: 'channel' }
  }
  return archive || { version: '', url: WINDOWS_LATEST_URL, source: 'channel' }
}
