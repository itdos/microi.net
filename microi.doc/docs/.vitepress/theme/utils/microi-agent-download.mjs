// 官网只信任官方更新清单中的吾码 CDN 安装包，避免下载按钮跳到失效别名或第三方地址。
export function installerFromYaml(yaml, platform) {
  const extension = platform === 'mac' ? '.dmg' : '.exe'
  const matches = String(yaml).matchAll(/^\s*-\s*url:\s*(https:\/\/\S+)\s*$/gm)
  for (const match of matches) {
    try {
      const url = new URL(match[1])
      if (url.hostname === 'static.itdos.com' && url.protocol === 'https:' && url.pathname.toLowerCase().endsWith(extension)) return url.href
    } catch { /* 略过无效 URL，继续检查更新清单的其它文件。 */ }
  }
  return ''
}
