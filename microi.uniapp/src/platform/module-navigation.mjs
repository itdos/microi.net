function text(value) {
  return String(value || '').trim()
}

export function moduleEntryUrl(item) {
  if (!item) return ''
  if (item.target === 'page-engine') {
    const menuId = text(item.menuId || item.key)
    return menuId ? `/pages/page-engine/index?menuId=${encodeURIComponent(menuId)}` : ''
  }
  if (item.target === 'api-report') {
    const key = text(item.key)
    return key ? `/pages/module/api-report?key=${encodeURIComponent(key)}` : ''
  }
  const menuId = text(item.menuId || item.key)
  return menuId ? `/pages/module/list?menuId=${encodeURIComponent(menuId)}` : ''
}

export function openModuleEntry(item) {
  const url = moduleEntryUrl(item)
  if (!url) return false
  uni.navigateTo({ url })
  return true
}

export default { moduleEntryUrl, openModuleEntry }
