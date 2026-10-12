const providerGlyphs = Object.freeze({ microi: 'M', gitee: 'G', wechat: '微', github: 'GH' })

// 供应商来自后端能力投影；未知供应商使用通用标记，避免被误显示为 Gitee。
export function externalProviderGlyph(providerKey) {
  return providerGlyphs[String(providerKey || '').trim().toLowerCase()] || '◇'
}
