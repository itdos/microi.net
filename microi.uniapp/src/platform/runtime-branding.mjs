const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function normalizeRuntimeColor(value) {
  const source = String(value || '').trim()
  if (!HEX_COLOR_RE.test(source)) return ''
  if (source.length === 4) {
    return `#${source.slice(1).split('').map((char) => char + char).join('')}`.toUpperCase()
  }
  return source.toUpperCase()
}

export function mixRuntimeColor(color, target, weight) {
  const source = normalizeRuntimeColor(color)
  const destination = normalizeRuntimeColor(target)
  if (!source || !destination) return source || destination
  const ratio = Math.max(0, Math.min(1, Number(weight) || 0))
  const component = (hex, offset) => parseInt(hex.slice(offset, offset + 2), 16)
  const mixed = [1, 3, 5].map((offset) => {
    const value = Math.round(component(source, offset) * (1 - ratio) + component(destination, offset) * ratio)
    return value.toString(16).padStart(2, '0')
  })
  return `#${mixed.join('')}`.toUpperCase()
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }
  return ''
}

export function resolveRuntimeBranding(sysConfig = {}, fallback = {}, options = {}) {
  const model = sysConfig && typeof sysConfig === 'object' ? sysConfig : {}
  const fallbackTheme = fallback.theme || {}
  const tenantTitle = firstText(model.SysTitle, model.SysShortTitle)
  const explicitPrimary = normalizeRuntimeColor(model.ThemeColor)
  const menuPrimary = normalizeRuntimeColor(model.MenuBackgroundColor)
  const tenantPrimary = explicitPrimary || menuPrimary
  const fallbackPrimary = normalizeRuntimeColor(fallbackTheme.primary) || '#087DA8'
  const primary = tenantPrimary || fallbackPrimary
  const primaryLight = tenantPrimary
    ? mixRuntimeColor(primary, '#FFFFFF', 0.22)
    : (normalizeRuntimeColor(fallbackTheme.primaryLight) || mixRuntimeColor(primary, '#FFFFFF', 0.22))
  const primaryDark = tenantPrimary
    ? (menuPrimary && menuPrimary !== primary ? menuPrimary : mixRuntimeColor(primary, '#000000', 0.2))
    : (normalizeRuntimeColor(fallbackTheme.primaryDark) || mixRuntimeColor(primary, '#000000', 0.2))
  const brand = explicitPrimary || normalizeRuntimeColor(fallbackTheme.brand) || primary
  const resolveLogo = typeof options.resolveLogo === 'function' ? options.resolveLogo : (value => String(value || '').trim())
  const tenantLogo = resolveLogo(model.SysLogo)

  return {
    source: tenantTitle || tenantLogo || tenantPrimary ? 'tenant' : 'fallback',
    appName: tenantTitle || firstText(fallback.appName, 'Microi吾码'),
    platformName: tenantTitle || firstText(fallback.platformName, fallback.appName, 'Microi吾码'),
    servicePlatformName: tenantTitle
      ? `${tenantTitle}平台`
      : firstText(fallback.servicePlatformName, fallback.platformName, fallback.appName, 'Microi吾码'),
    appSubTitle: firstText(model.SystemSubTitle, fallback.appSubTitle),
    workspaceSubTitle: firstText(model.SystemSubTitle, fallback.workspaceSubTitle),
    companyName: firstText(model.CompanyName, fallback.companyName),
    logoUrl: tenantLogo || firstText(fallback.logoUrl, '/static/microi-blue-256.png'),
    theme: { primary, primaryLight, primaryDark, brand }
  }
}
