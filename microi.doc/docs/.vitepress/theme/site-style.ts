import { ref } from 'vue'

export type SiteStyle = 'mainstream' | 'classic'

const STORAGE_KEY = 'mci-site-style'
const DEFAULT_STYLE: SiteStyle = 'mainstream'

export const siteStyle = ref<SiteStyle>(DEFAULT_STYLE)

function normalizeSiteStyle(value: unknown): SiteStyle {
  return value === 'classic' ? 'classic' : DEFAULT_STYLE
}

function applySiteStyle(value: SiteStyle) {
  siteStyle.value = value
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-mci-site-style', value)
  }
}

export function initSiteStyle() {
  if (typeof window === 'undefined') return DEFAULT_STYLE

  let saved: string | null = null
  try {
    saved = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // 隐私模式或存储受限时继续使用默认主题。
  }

  const next = normalizeSiteStyle(saved)
  applySiteStyle(next)
  return next
}

export function setSiteStyle(value: SiteStyle) {
  const next = normalizeSiteStyle(value)
  applySiteStyle(next)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 存储失败不影响本次切换。
    }
  }
  return next
}

export function toggleSiteStyle() {
  return setSiteStyle(siteStyle.value === 'mainstream' ? 'classic' : 'mainstream')
}

